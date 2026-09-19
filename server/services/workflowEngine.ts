/**
 * Workflow Execution Engine — Standalone graph walker
 * No LangGraph dependency. Uses simple BFS traversal with state management.
 * 
 * Features:
 * - Graph traversal (BFS) with conditional routing
 * - If/else branching
 * - While loops with iteration cap
 * - Parallel fan-out execution
 * - User approval interrupts (pause/resume)
 * - Streaming execution via async generator
 * - Execution state persistence
 */

import { executeAgentNode } from './workflowExecutors/agent.js';
import { executeIfElseNode, executeWhileNode, executeUserApprovalNode, executeTransformNode as executeTransformLegacy } from './workflowExecutors/logic.js';
import { executeMCPNode } from './workflowExecutors/mcp.js';
import { executeSetStateNode } from './workflowExecutors/variables.js';
import { executeTransformNode } from './workflowExecutors/transform.js';
import { executeHTTPNode } from './workflowExecutors/http.js';
import { executeExtractNode } from './workflowExecutors/extract.js';
import { executeGuardrailsNode } from './workflowExecutors/tools.js';
import type { WorkflowNode, WorkflowEdge, NodeExecutionResult } from '../../components/agent-builder/types.js';

// ─── Types ───

export interface WorkflowState {
  variables: Record<string, any>;
  chatHistory: Array<{ role: string; content: string }>;
  currentNodeId: string;
  nodeResults: Record<string, NodeExecutionResult>;
  pendingAuth: PendingAuth | null;
  loopResults: any[];
}

export interface PendingAuth {
  authId: string;
  nodeId: string;
  toolName: string;
  message: string;
  status: 'pending' | 'completed' | 'failed';
  threadId?: string;
  executionId?: string;
}

export interface EngineConfig {
  apiKeys?: Record<string, string>;
  onNodeUpdate?: (nodeId: string, result: NodeExecutionResult) => void;
  executionId?: string;
  threadId?: string;
}

export interface ExecutionEvent {
  type: 'node_start' | 'node_complete' | 'node_error' | 'state_update' | 'pending_approval' | 'completed' | 'error';
  nodeId?: string;
  data?: any;
  error?: string;
  state?: Partial<WorkflowState>;
}

// ─── Engine ───

export class WorkflowEngine {
  private nodes: Map<string, WorkflowNode>;
  private edgesBySource: Map<string, WorkflowEdge[]>;
  private config: EngineConfig;

  constructor(nodes: WorkflowNode[], edges: WorkflowEdge[], config: EngineConfig = {}) {
    this.nodes = new Map(nodes.map(n => [n.id, n]));
    this.edgesBySource = new Map();
    this.config = config;

    for (const edge of edges) {
      if (!this.edgesBySource.has(edge.source)) {
        this.edgesBySource.set(edge.source, []);
      }
      this.edgesBySource.get(edge.source)!.push(edge);
    }
  }

  /**
   * Execute workflow with streaming events
   */
  async *executeStream(input: any = {}): AsyncGenerator<ExecutionEvent> {
    const state = this.createInitialState(input);
    const startNode = this.findStartNode();

    if (!startNode) {
      yield { type: 'error', error: 'No start node found in workflow' };
      return;
    }

    yield* this.traverseGraph(startNode.id, state);
  }

  /**
   * Resume execution after an approval
   */
  async *resumeExecution(
    state: WorkflowState,
    approvalResult: { approved: boolean; data?: any }
  ): AsyncGenerator<ExecutionEvent> {
    if (!state.pendingAuth) {
      yield { type: 'error', error: 'No pending approval to resume' };
      return;
    }

    const nodeId = state.pendingAuth.nodeId;
    state.pendingAuth = null;

    // The approval node's output becomes the approval result
    state.nodeResults[nodeId] = {
      ...state.nodeResults[nodeId],
      status: 'completed',
      output: { approved: approvalResult.approved, data: approvalResult.data },
      completedAt: new Date().toISOString(),
    };

    yield {
      type: 'node_complete',
      nodeId,
      data: state.nodeResults[nodeId],
    };

    // Continue from the next node
    const nextNodes = this.getNextNodes(nodeId);
    for (const nextNodeId of nextNodes) {
      yield* this.traverseGraph(nextNodeId, state);
    }

    yield { type: 'completed', state };
  }

  /**
   * Core graph traversal — BFS with conditional routing
   */
  private async *traverseGraph(startNodeId: string, state: WorkflowState): AsyncGenerator<ExecutionEvent> {
    const queue: string[] = [startNodeId];
    const visited = new Set<string>();
    let iterations = 0;
    const MAX_ITERATIONS = 200; // Safety limit

    while (queue.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;
      const nodeId = queue.shift()!;

      // Skip if already visited (prevents infinite loops in non-loop paths)
      if (visited.has(nodeId)) {
        const node = this.nodes.get(nodeId);
        const nodeType = (node?.data as any)?.nodeType || node?.type;
        // Allow revisits for while loops
        if (nodeType !== 'while') continue;
      }
      visited.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (!node) continue;

      const nodeType = (node.data as any)?.nodeType || node.type;

      // Skip note nodes (visual only)
      if (nodeType === 'note') {
        const nextNodes = this.getNextNodes(nodeId);
        queue.push(...nextNodes);
        continue;
      }

      // Execute the node
      state.currentNodeId = nodeId;
      yield { type: 'node_start', nodeId, state: { currentNodeId: nodeId } };

      this.config.onNodeUpdate?.(nodeId, {
        nodeId,
        status: 'running',
        startedAt: new Date().toISOString(),
      });

      const startTime = new Date().toISOString();
      let result: NodeExecutionResult;

      try {
        const output = await this.executeNode(node, state);

        // Check for pending approval
        if (output && typeof output === 'object' && output.__pendingApproval) {
          const pendingAuth: PendingAuth = {
            authId: output.approvalId,
            nodeId,
            toolName: 'user-approval',
            message: output.message,
            status: 'pending',
            executionId: this.config.executionId,
            threadId: this.config.threadId,
          };

          result = {
            nodeId,
            status: 'completed',
            output,
            startedAt: startTime,
            completedAt: new Date().toISOString(),
          };

          state.nodeResults[nodeId] = result;
          state.pendingAuth = pendingAuth;

          this.config.onNodeUpdate?.(nodeId, result);
          yield { type: 'pending_approval', nodeId, data: pendingAuth, state: this.getSerializableState(state) };
          return; // Pause execution
        }

        // Process output
        result = {
          nodeId,
          status: 'completed',
          output: output?.__agentValue ?? output,
          toolCalls: output?.__agentToolCalls,
          startedAt: startTime,
          completedAt: new Date().toISOString(),
        };

        // Update state
        state.nodeResults[nodeId] = result;

        // Merge variable updates
        if (output?.variableUpdates) {
          Object.assign(state.variables, output.variableUpdates);
        }
        if (output?.stateUpdates) {
          Object.assign(state.variables, output.stateUpdates);
        }

        // Merge chat history updates
        if (output?.chatHistoryUpdates) {
          state.chatHistory.push(...output.chatHistoryUpdates);
        }

        // Store output in variables
        const nodeKey = (node.data as any)?.nodeName || (node.data as any)?.name || nodeId;
        const actualOutput = result.output;
        state.variables.lastOutput = actualOutput;
        state.variables[nodeKey] = actualOutput;
        state.variables[nodeId] = actualOutput;

        // Handle while loop iteration counter
        if (nodeType === 'while' && output?.__iteration !== undefined) {
          state.variables[`${nodeId}__iteration`] = output.__iteration;
        }

        this.config.onNodeUpdate?.(nodeId, result);
        yield { type: 'node_complete', nodeId, data: result, state: this.getSerializableState(state) };

      } catch (err: any) {
        result = {
          nodeId,
          status: 'failed',
          error: err.message,
          startedAt: startTime,
          completedAt: new Date().toISOString(),
        };
        state.nodeResults[nodeId] = result;
        this.config.onNodeUpdate?.(nodeId, result);
        yield { type: 'node_error', nodeId, error: err.message };

        // Don't continue past failed nodes
        continue;
      }

      // Determine next nodes
      const nextNodes = this.getNextNodes(nodeId, state);

      if (nodeType === 'if-else') {
        // Conditional routing — only queue the branch that was taken
        const branch = result.output?.branch || 'else';
        const handle = branch === 'if' ? 'if' : 'else';
        const target = this.getEdgeByHandle(nodeId, handle);
        if (target) queue.push(target);
      } else if (nodeType === 'while') {
        // While loop routing
        const shouldContinue = result.output?.shouldContinue ?? result.output?.condition;
        if (shouldContinue) {
          const continueTarget = this.getEdgeByHandle(nodeId, 'continue');
          if (continueTarget) queue.push(continueTarget);
        } else {
          const breakTarget = this.getEdgeByHandle(nodeId, 'break');
          if (breakTarget) queue.push(breakTarget);
        }
      } else {
        queue.push(...nextNodes);
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      yield { type: 'error', error: `Execution exceeded maximum iterations (${MAX_ITERATIONS})` };
      return;
    }

    yield { type: 'completed', state: this.getSerializableState(state) };
  }

  /**
   * Execute a single node
   */
  private async executeNode(node: WorkflowNode, state: WorkflowState): Promise<any> {
    const nodeType = (node.data as any)?.nodeType || node.type;
    const data = node.data as any;
    const apiKeys = this.config.apiKeys || {};

    const stateForExecutor = {
      variables: state.variables,
      chatHistory: state.chatHistory,
    };

    switch (nodeType) {
      case 'start':
        return {
          message: 'Workflow started',
          ...(typeof state.variables.input === 'object' ? state.variables.input : { input: state.variables.input }),
        };

      case 'end':
        return { message: 'Workflow completed', finalOutput: state.variables.lastOutput };

      case 'agent':
        return await executeAgentNode(data, stateForExecutor, apiKeys);

      case 'mcp':
        return await executeMCPNode(
          { ...data, mcpServers: data.mcpServers || [] },
          stateForExecutor,
          apiKeys
        );

      case 'if-else':
        return await executeIfElseNode(data, stateForExecutor);

      case 'while':
        return await executeWhileNode(
          { ...data, __iteration: state.variables[`${node.id}__iteration`] || 0 },
          stateForExecutor
        );

      case 'user-approval':
      case 'user approval':
      case 'approval':
        return await executeUserApprovalNode(data, stateForExecutor);

      case 'transform':
      case 'data-transform':
        return await executeTransformNode(data, stateForExecutor);

      case 'set-state':
      case 'set state':
        return await executeSetStateNode(data, stateForExecutor);

      case 'http':
      case 'http-request':
        return await executeHTTPNode(data, stateForExecutor);

      case 'extract':
        return await executeExtractNode(data, stateForExecutor, apiKeys);

      case 'guardrails':
      case 'guardrail':
        return await executeGuardrailsNode(data, stateForExecutor);

      default:
        console.warn(`[engine] Unknown node type '${nodeType}', attempting agent execution`);
        return await executeAgentNode(data, stateForExecutor, apiKeys);
    }
  }

  // ─── Graph Helpers ───

  private findStartNode(): WorkflowNode | undefined {
    for (const node of this.nodes.values()) {
      const nodeType = (node.data as any)?.nodeType || node.type;
      if (nodeType === 'start') return node;
    }
    return undefined;
  }

  private getNextNodes(nodeId: string, state?: WorkflowState): string[] {
    const edges = this.edgesBySource.get(nodeId) || [];
    return edges.map(e => e.target).filter(id => this.nodes.has(id));
  }

  private getEdgeByHandle(nodeId: string, handle: string): string | undefined {
    const edges = this.edgesBySource.get(nodeId) || [];
    const edge = edges.find(e => {
      const edgeHandle = (e.sourceHandle || e.label || '').toLowerCase();
      return edgeHandle === handle.toLowerCase() ||
        (handle === 'if' && ['if', 'true', 'yes'].includes(edgeHandle)) ||
        (handle === 'else' && ['else', 'false', 'no'].includes(edgeHandle)) ||
        (handle === 'continue' && ['continue', 'true', 'yes', 'loop', 'next'].includes(edgeHandle)) ||
        (handle === 'break' && ['break', 'false', 'no', 'exit', 'stop', 'end', 'complete'].includes(edgeHandle));
    });
    return edge?.target || edges[0]?.target;
  }

  private createInitialState(input: any): WorkflowState {
    return {
      variables: {
        input: typeof input === 'string' ? input : input,
        lastOutput: typeof input === 'string' ? input : '',
      },
      chatHistory: [],
      currentNodeId: '',
      nodeResults: {},
      pendingAuth: null,
      loopResults: [],
    };
  }

  private getSerializableState(state: WorkflowState): Partial<WorkflowState> {
    return {
      variables: { ...state.variables },
      currentNodeId: state.currentNodeId,
      nodeResults: { ...state.nodeResults },
      pendingAuth: state.pendingAuth ? { ...state.pendingAuth } : null,
    };
  }
}

// ─── Export helpers for API routes ───

export function createEngine(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  config?: EngineConfig
): WorkflowEngine {
  return new WorkflowEngine(nodes, edges, config);
}
