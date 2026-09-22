import {
  StateGraph,
  Annotation,
  START,
  END,
  Command,
  interrupt,
  isGraphInterrupt,
  type BaseCheckpointSaver,
} from '@langchain/langgraph';
import { executeAgentNode } from './workflowExecutors/agent.js';
import { executeIfElseNode, executeWhileNode } from './workflowExecutors/logic.js';
import { executeTransformNode } from './workflowExecutors/transform.js';
import { executeMCPNode } from './workflowExecutors/mcp.js';
import { executeSetStateNode } from './workflowExecutors/variables.js';
import { executeHTTPNode } from './workflowExecutors/http.js';
import { executeExtractNode } from './workflowExecutors/extract.js';
import { executeGuardrailsNode } from './workflowExecutors/tools.js';
import { executeArcadeNode } from './workflowExecutors/arcade.js';
import {
  getWorkflowNodeType,
  normalizeHandle,
  normalizeWorkflowGraph,
  resolveIfElseBranch,
} from '../../lib/workflow/graph.js';
import type { NodeExecutionResult, WorkflowEdge, WorkflowNode } from '../../lib/workflow/types.js';

const WorkflowStateAnnotation = Annotation.Root({
  variables: Annotation<Record<string, any>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  chatHistory: Annotation<Array<{ role: string; content: string }>>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  currentNodeId: Annotation<string>({ reducer: (_, next) => next, default: () => '' }),
  nodeResults: Annotation<Record<string, NodeExecutionResult>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  loopResults: Annotation<any[]>({ reducer: (prev, next) => [...prev, ...next], default: () => [] }),
});

type WorkflowState = typeof WorkflowStateAnnotation.State;

export interface ExecutorOptions {
  onNodeUpdate?: (nodeId: string, status: string, data?: any) => void;
  llmKeys?: Record<string, string>;
  threadId?: string;
  executionId?: string;
  checkpointer?: BaseCheckpointSaver;
  signal?: AbortSignal;
}

export interface WorkflowStreamOptions {
  resume?: Record<string, any>;
}

export function toMermaid(rawNodes: WorkflowNode[], rawEdges: WorkflowEdge[]): string {
  const { nodes, edges } = normalizeWorkflowGraph(rawNodes, rawEdges);
  const lines: string[] = ['graph TD'];
  const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9_]/g, '_');
  for (const node of nodes) {
    if (getWorkflowNodeType(node) === 'note') continue;
    const id = sanitize(node.id);
    const label = String(node.data?.label || node.label || node.type).replace(/"/g, "'");
    const type = getWorkflowNodeType(node);
    lines.push(type === 'if-else' || type === 'while' ? `  ${id}{${label}}` : `  ${id}[${label}]`);
  }
  for (const edge of edges) {
    const label = edge.label || edge.sourceHandle;
    lines.push(`  ${sanitize(edge.source)} -->${label ? `|${String(label).replace(/"/g, "'")}|` : ''} ${sanitize(edge.target)}`);
  }
  return lines.join('\n');
}

export class WorkflowExecutor {
  private nodes: WorkflowNode[];
  private edges: WorkflowEdge[];
  private options: ExecutorOptions;

  constructor(rawNodes: WorkflowNode[], rawEdges: WorkflowEdge[], options: ExecutorOptions = {}) {
    const normalized = normalizeWorkflowGraph(rawNodes, rawEdges);
    this.nodes = normalized.nodes.filter(node => getWorkflowNodeType(node) !== 'note');
    this.edges = normalized.edges.filter(edge => this.nodes.some(node => node.id === edge.source) && this.nodes.some(node => node.id === edge.target));
    this.options = options;
  }

  async *executeStream(input: Record<string, any> = {}, streamOptions: WorkflowStreamOptions = {}) {
    const threadId = this.options.threadId || this.options.executionId || `thread_${Date.now()}`;
    try {
      const checkpointer = this.options.checkpointer || await (await import('./workflowCheckpointer.js')).getWorkflowCheckpointer();
      const compiled = this.buildGraph().compile({ checkpointer });
      const config = { configurable: { thread_id: threadId }, recursionLimit: 250 };
      const initialState: Partial<WorkflowState> = {
        variables: { input, lastOutput: input },
        currentNodeId: '',
        nodeResults: {},
        chatHistory: [],
        loopResults: [],
      };
      const graphInput = streamOptions.resume ? new Command({ resume: streamOptions.resume }) : initialState;

      yield { type: streamOptions.resume ? 'workflow_resumed' : 'workflow_started', threadId, executionId: this.options.executionId };
      const stream = await compiled.stream(graphInput as any, { ...config, streamMode: 'updates', signal: this.options.signal });

      for await (const chunk of stream) {
        const interruptEntry = (chunk as any).__interrupt__;
        if (interruptEntry) {
          const first = Array.isArray(interruptEntry) ? interruptEntry[0] : interruptEntry;
          const pendingAction = first?.value || first;
          yield { type: 'workflow_paused', pendingAction, threadId, executionId: this.options.executionId };
          return;
        }

        for (const [nodeId, update] of Object.entries(chunk as Record<string, any>)) {
          if (nodeId.startsWith('__')) continue;
          yield { type: 'state_update', nodeId, state: update };
        }
      }

      const finalState = await compiled.getState(config);
      yield { type: 'workflow_completed', threadId, executionId: this.options.executionId, state: finalState.values };
    } catch (error: any) {
      yield { type: 'error', error: error?.message || 'Workflow execution failed', threadId, executionId: this.options.executionId };
    }
  }

  private buildGraph() {
    const graph = new StateGraph(WorkflowStateAnnotation);
    const edgesBySource = new Map<string, WorkflowEdge[]>();
    for (const edge of this.edges) edgesBySource.set(edge.source, [...(edgesBySource.get(edge.source) || []), edge]);

    for (const node of this.nodes) {
      const directTargets = (edgesBySource.get(node.id) || []).map(edge => edge.target);
      const pathTargets = getWorkflowNodeType(node) === 'if-else'
        ? (['if', 'else'] as const).map(handle => resolveIfElseBranch(node, handle, this.nodes, this.edges).targetId).filter(Boolean) as string[]
        : [];
      const possibleEnds = [...new Set([...directTargets, ...pathTargets])];
      graph.addNode(node.id, this.createNodeExecutor(node), possibleEnds.length > 1 ? { ends: possibleEnds as any } : undefined);
    }

    const startNode = this.nodes.find(node => getWorkflowNodeType(node) === 'start');
    if (startNode) graph.addEdge(START, startNode.id as any);

    for (const node of this.nodes) {
      const type = getWorkflowNodeType(node);
      const outgoing = edgesBySource.get(node.id) || [];
      if (type === 'end') {
        graph.addEdge(node.id as any, END);
        continue;
      }
      if (type === 'if-else') {
        const ifTarget = resolveIfElseBranch(node, 'if', this.nodes, this.edges).targetId || END;
        const elseTarget = resolveIfElseBranch(node, 'else', this.nodes, this.edges).targetId || END;
        graph.addConditionalEdges(
          node.id as any,
          (state: WorkflowState) => state.nodeResults[node.id]?.output?.branch === 'else' ? 'else' : 'if',
          { if: ifTarget, else: elseTarget } as any,
        );
      } else if (type === 'while') {
        graph.addConditionalEdges(node.id as any, (state: WorkflowState) => state.nodeResults[node.id]?.output?.shouldContinue ? 'continue' : 'break', branchMap(outgoing, ['continue', 'break']) as any);
      } else if (type === 'user-approval') {
        graph.addConditionalEdges(node.id as any, (state: WorkflowState) => state.nodeResults[node.id]?.output?.approved === false ? 'reject' : 'approve', branchMap(outgoing, ['approve', 'reject']) as any);
      } else {
        for (const edge of outgoing) graph.addEdge(node.id as any, edge.target as any);
      }
    }
    return graph;
  }

  private createNodeExecutor(node: WorkflowNode) {
    return async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
      const startedAt = new Date().toISOString();
      this.options.onNodeUpdate?.(node.id, 'started', { nodeId: node.id, status: 'running', startedAt });
      try {
        const type = getWorkflowNodeType(node);
        let output: any;
        if (type === 'user-approval') {
          const approvalId = `approval_${this.options.executionId || 'workflow'}_${node.id}`;
          const decision = interrupt({
            kind: 'approval', approvalId, nodeId: node.id,
            message: node.data.message || node.data.approvalMessage || 'Approve to continue?',
            executionId: this.options.executionId,
            threadId: this.options.threadId,
          }) as { approved?: boolean; data?: any };
          output = { approved: decision?.approved !== false, data: decision?.data };
        } else {
          output = await this.executeNode(node, state);
          if (output?.__arcadePendingAuth) {
            const authorization = interrupt({
              kind: 'arcade-authorization', approvalId: output.authId, nodeId: node.id,
              message: output.message, authUrl: output.authUrl, toolName: output.toolName,
              executionId: this.options.executionId, threadId: this.options.threadId,
            }) as { approved?: boolean };
            if (authorization?.approved === false) throw new Error(`Authorization rejected for ${output.toolName}`);
            output = await this.executeNode(node, state);
            if (output?.__arcadePendingAuth) throw new Error(`Authorization for ${output.toolName} is not complete yet`);
          }
        }

        if (output?.error) throw new Error(output.error);
        const result: NodeExecutionResult = {
          nodeId: node.id,
          status: 'completed',
          output: output?.output ?? output?.result ?? output,
          toolCalls: output?.toolCalls || output?.__agentToolCalls,
          startedAt,
          completedAt: new Date().toISOString(),
        };
        this.options.onNodeUpdate?.(node.id, 'completed', result);

        const actualOutput = result.output;
        const variables: Record<string, any> = { lastOutput: actualOutput, [node.id]: actualOutput, [`${node.id}_output`]: actualOutput };
        if (actualOutput && typeof actualOutput === 'object' && !Array.isArray(actualOutput)) Object.assign(variables, actualOutput);
        const nodeName = node.data?.nodeName || node.data?.name;
        if (nodeName) variables[nodeName] = actualOutput;
        Object.assign(variables, output?.variableUpdates || output?.stateUpdates || output?.__variableUpdates || {});
        if (type === 'while' && output?.__iteration !== undefined) variables[`${node.id}__iteration`] = output.__iteration;

        return {
          currentNodeId: node.id,
          nodeResults: { [node.id]: result },
          variables,
          chatHistory: output?.chatHistoryUpdates || output?.__chatHistoryUpdates || [],
        };
      } catch (error: any) {
        if (isGraphInterrupt(error)) throw error;
        const result: NodeExecutionResult = { nodeId: node.id, status: 'failed', error: error?.message || 'Node execution failed', startedAt, completedAt: new Date().toISOString() };
        this.options.onNodeUpdate?.(node.id, 'failed', result);
        throw error;
      }
    };
  }

  private async executeNode(node: WorkflowNode, state: WorkflowState): Promise<any> {
    const type = getWorkflowNodeType(node);
    const keys = this.options.llmKeys || {};
    switch (type) {
      case 'start': return { input: state.variables.input };
      case 'end': return { finalOutput: state.variables.lastOutput };
      case 'agent': return executeAgentNode(await this.hydrateAgentTools(node.data), state, keys);
      case 'mcp': return executeMCPNode(await this.hydrateMCPNode(node.data), state, keys);
      case 'arcade': return executeArcadeNode(node.data, state, keys);
      case 'guardrails': return executeGuardrailsNode(node.data, state);
      case 'if-else': return executeIfElseNode(node.data, state);
      case 'while': return executeWhileNode({ ...node.data, __iteration: state.variables[`${node.id}__iteration`] || 0 }, state);
      case 'transform': return executeTransformNode(node.data, state);
      case 'set-state': return executeSetStateNode(node.data, state);
      case 'http': return executeHTTPNode(node.data, state);
      case 'extract': return executeExtractNode(node.data, state, keys);
      default: throw new Error(`Unsupported workflow node type: ${type}`);
    }
  }

  private async hydrateAgentTools(data: Record<string, any>): Promise<Record<string, any>> {
    const ids = Array.isArray(data.mcpServerIds) ? data.mcpServerIds : [];
    if (ids.length === 0) return data;
    const workflowDB = await import('../db/workflows.js');
    const servers = (await Promise.all(ids.map((id: string) => workflowDB.getMCPServer(id)))).filter(Boolean) as any[];
    const mcpTools = servers.flatMap(server => {
      const tools = Array.isArray(server.tools) ? server.tools : [];
      return tools.map((tool: any) => ({
        name: typeof tool === 'string' ? tool : tool.name,
        description: typeof tool === 'string' ? `${server.name}: ${tool}` : tool.description,
        inputSchema: typeof tool === 'string' ? { type: 'object', properties: {} } : (tool.inputSchema || tool.input_schema),
        serverUrl: server.url,
        accessToken: server.access_token,
        headers: server.headers || {},
      }));
    });
    return { ...data, mcpTools };
  }

  private async hydrateMCPNode(data: Record<string, any>): Promise<Record<string, any>> {
    if (!data.serverId) return data;
    const workflowDB = await import('../db/workflows.js');
    const server = await workflowDB.getMCPServer(data.serverId);
    return server ? { ...data, serverUrl: server.url, accessToken: server.access_token, headers: server.headers || {} } : data;
  }
}

function branchMap(edges: WorkflowEdge[], handles: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const handle of handles) {
    const edge = edges.find(item => normalizeHandle(item.sourceHandle || item.label) === handle);
    if (edge) result[handle] = edge.target;
  }
  return result;
}
