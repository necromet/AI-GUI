export const WORKFLOW_NODE_TYPES = [
  'start', 'end', 'agent', 'mcp', 'guardrails', 'arcade',
  'if-else', 'while', 'user-approval', 'transform', 'set-state',
  'extract', 'http', 'note',
] as const;

export type WorkflowNodeType = typeof WORKFLOW_NODE_TYPES[number];

export type ConditionMode = 'simple' | 'expression';

export type ConditionOperator =
  | 'eq' | 'neq' | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with'
  | 'empty' | 'not_empty' | 'truthy' | 'falsy'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'matches';

export interface ConditionRule {
  left: string;
  op: ConditionOperator;
  right?: string;
  caseSensitive?: boolean;
}

export interface ConditionEvaluationResult {
  result: boolean;
  branch: 'if' | 'else';
  source: ConditionMode;
  summary: string;
  leftValue?: unknown;
  rightValue?: unknown;
  error?: string;
}

export interface ConditionalNodeData extends Record<string, any> {
  conditionMode?: ConditionMode;
  conditionRule?: ConditionRule;
  condition?: string;
  truePath?: string;
  falsePath?: string;
  trueLabel?: string;
  falseLabel?: string;
}

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
  targetHandle?: string;
  label?: string;
  animated?: boolean;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowValidationIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface NodeExecutionResult {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  output?: any;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  toolCalls?: Array<{ name?: string; arguments?: any; output?: any }>;
}

export interface PendingWorkflowAction {
  kind: 'approval' | 'arcade-authorization';
  approvalId: string;
  nodeId: string;
  message: string;
  authUrl?: string | null;
  toolName?: string;
  executionId?: string;
  threadId?: string;
}
