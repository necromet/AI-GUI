import { StateGraph, Annotation, START, END, MemorySaver } from '@langchain/langgraph';
import { executeAgentNode } from './workflowExecutors/agent.js';
import { executeTransformNode, executeIfElseNode, executeWhileNode, executeUserApprovalNode } from './workflowExecutors/logic.js';
import { executeMCPNode } from './workflowExecutors/mcp.js';
import { substituteVariables } from './workflowExecutors/variables.js';
import type { WorkflowNode, WorkflowEdge, NodeExecutionResult } from '../../components/agent-builder/types';

const WorkflowStateAnnotation = Annotation.Root({
  variables: Annotation<Record<string, any>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  chatHistory: Annotation<Array<{ role: string; content: string }>>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  currentNodeId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  nodeResults: Annotation<Record<string, NodeExecutionResult>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  pendingAuth: Annotation<any>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  loopResults: Annotation<any[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

type WorkflowState = typeof WorkflowStateAnnotation.State;

export interface ExecutorOptions {
  onNodeUpdate?: (nodeId: string, status: string, data?: any) => void;
  llmKeys?: Record<string, string>;
  threadId?: string;
  executionId?: string;
}

export class WorkflowExecutor {
  private nodes: WorkflowNode[];
  private edges: WorkflowEdge[];
  private options: ExecutorOptions;

  constructor(nodes: WorkflowNode[], edges: WorkflowEdge[], options: ExecutorOptions = {}) {
    this.nodes = nodes;
    this.edges = edges;
    this.options = options;
  }

  async *executeStream(input: Record<string, any> = {}) {
    const graph = this.buildGraph();
    const checkpointer = new MemorySaver();
    const compiled = graph.compile({ checkpointer });

    const config = {
      configurable: { thread_id: this.options.threadId || `thread_${Date.now()}` },
    };

    const initialState: Partial<WorkflowState> = {
      variables: { input },
      currentNodeId: '',
      nodeResults: {},
      chatHistory: [],
      pendingAuth: null,
      loopResults: [],
    };

    try {
      const stream = await compiled.stream(initialState, {
        ...config,
        streamMode: 'updates',
      });

      for await (const chunk of stream) {
        for (const [nodeName, update] of Object.entries(chunk)) {
          if (nodeName === '__start__' || nodeName === '__end__') continue;

          const state = update as Partial<WorkflowState>;
          if (state.currentNodeId) {
            this.options.onNodeUpdate?.(state.currentNodeId, 'running');
          }
          if (state.nodeResults) {
            for (const [nodeId, result] of Object.entries(state.nodeResults)) {
              this.options.onNodeUpdate?.(nodeId, result.status, result);
            }
          }
          if (state.pendingAuth) {
            yield { type: 'paused', pendingAuth: state.pendingAuth };
            return;
          }

          yield { type: 'state_update', state };
        }
      }

      yield { type: 'completed' };
    } catch (err: any) {
      yield { type: 'error', error: err.message };
    }
  }

  private buildGraph() {
    const graph = new StateGraph(WorkflowStateAnnotation);

    for (const node of this.nodes) {
      graph.addNode(node.id, this.createNodeExecutor(node));
    }

    const startNode = this.nodes.find(n => n.type === 'start');

    if (startNode) {
      const startTargets = this.edges.filter(e => e.source === startNode.id);
      for (const edge of startTargets) {
        graph.addEdge(START, edge.target);
      }
    }

    const edgesBySource = new Map<string, WorkflowEdge[]>();
    for (const edge of this.edges) {
      if (!edgesBySource.has(edge.source)) edgesBySource.set(edge.source, []);
      edgesBySource.get(edge.source)!.push(edge);
    }

    for (const node of this.nodes) {
      if (node.type === 'end') continue;
      const outEdges = edgesBySource.get(node.id) || [];

      if (outEdges.length === 0) {
        graph.addEdge(node.id, END);
      } else if (node.type === 'if-else') {
        graph.addConditionalEdges(
          node.id,
          (state: WorkflowState) => {
            const result = state.nodeResults[node.id];
            if (result?.output?.branch === 'else') return 'else';
            return 'if';
          },
          {
            if: outEdges.find(e => e.sourceHandle === 'if')?.target || END,
            else: outEdges.find(e => e.sourceHandle === 'else')?.target || END,
          }
        );
      } else if (node.type === 'while') {
        graph.addConditionalEdges(
          node.id,
          (state: WorkflowState) => {
            const result = state.nodeResults[node.id];
            if (result?.output?.shouldContinue) return 'continue';
            return 'break';
          },
          {
            continue: outEdges.find(e => e.sourceHandle === 'continue')?.target || END,
            break: outEdges.find(e => e.sourceHandle === 'break')?.target || END,
          }
        );
      } else if (outEdges.length === 1) {
        graph.addEdge(node.id, outEdges[0].target);
      } else {
        graph.addEdge(node.id, outEdges[0].target);
      }
    }

    return graph;
  }

  private createNodeExecutor(node: WorkflowNode) {
    return async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
      this.options.onNodeUpdate?.(node.id, 'running');

      const startTime = new Date().toISOString();
      let result: NodeExecutionResult;

      try {
        let output: any;

        switch (node.type) {
          case 'start':
            output = { message: 'Workflow started', input: state.variables.input };
            break;
          case 'end':
            output = { message: 'Workflow completed', finalOutput: state.variables };
            break;
          case 'agent':
            output = await executeAgentNode(node.data, state, this.options.llmKeys || {});
            break;
          case 'mcp':
            output = await executeMCPNode(node.data, state, this.options.llmKeys || {});
            break;
          case 'transform':
            output = await executeTransformNode(node.data, state);
            break;
          case 'if-else':
            output = await executeIfElseNode(node.data, state);
            break;
          case 'while':
            output = await executeWhileNode(node.data, state);
            break;
          case 'user-approval':
            output = await executeUserApprovalNode(node.data, state);
            break;
          default:
            output = { message: `Node ${node.type} not implemented` };
        }

        result = {
          nodeId: node.id,
          status: 'completed',
          output,
          startedAt: startTime,
          completedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        result = {
          nodeId: node.id,
          status: 'failed',
          error: err.message,
          startedAt: startTime,
          completedAt: new Date().toISOString(),
        };
      }

      this.options.onNodeUpdate?.(node.id, result.status, result);

      const updates: Partial<WorkflowState> = {
        currentNodeId: node.id,
        nodeResults: { [node.id]: result },
      };

      if (result.output?.__pendingApproval) {
        updates.pendingAuth = result.output;
      }

      if (result.output?.__chatHistoryUpdates) {
        updates.chatHistory = result.output.__chatHistoryUpdates;
      }

      return updates;
    };
  }
}
