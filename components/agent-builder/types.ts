// ─── Workflow Execution Engine Types ───

export type WorkflowNodeType =
  | 'start' | 'end'
  | 'agent' | 'mcp'
  | 'if-else' | 'while' | 'user-approval'
  | 'transform' | 'set-state'
  | 'extract' | 'http' | 'note';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: Record<string, any>;
  label?: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
  animated?: boolean;
}

export interface Workflow {
  id: string;
  customId?: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isTemplate: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NodeExecutionResult {
  nodeId: string;
  status: 'running' | 'completed' | 'failed';
  output?: any;
  error?: string;
  startedAt: string;
  completedAt?: string;
  toolCalls?: Array<{ name: string; input: any; output?: any }>;
}

export interface PendingApproval {
  approvalId: string;
  nodeId: string;
  message: string;
  status: 'pending' | 'completed' | 'failed';
  executionId?: string;
  threadId?: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  currentNodeId?: string;
  nodeResults: Record<string, NodeExecutionResult>;
  variables: Record<string, any>;
  input?: any;
  output?: any;
  error?: string;
  threadId?: string;
  startedAt: string;
  completedAt?: string;
}
