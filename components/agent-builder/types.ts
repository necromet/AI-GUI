// ─── Workflow Execution Engine Types ───

export type WorkflowNodeType =
  | 'start' | 'end'
  | 'agent' | 'mcp' | 'guardrails'
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

export interface WorkflowHeaderControls {
  name: string;
  onNameChange: (name: string) => void;
  nodes: any[];
  edges: any[];
  workflowId?: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  validationIssues: any[];
  onShowShortcuts: () => void;
  onBack?: () => void;
  // Handlers (managed by WorkflowToolbar)
  handleSave: () => void;
  saving: boolean;
  handleExport: () => void;
  handleExportCode: () => void;
  handleExportMermaid: () => void;
  handleShare: () => void;
  onLoadTemplate?: () => void;
  // Modal/popup state
  showValidation: boolean;
  setShowValidation: (v: boolean) => void;
  showSaveAsTemplate: boolean;
  setShowSaveAsTemplate: (v: boolean) => void;
  showPublish: boolean;
  setShowPublish: (v: boolean) => void;
}
