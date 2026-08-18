import type { WorkflowNodeType } from './types';

export interface NodeDefinition {
  type: WorkflowNodeType;
  label: string;
  color: string;
  icon: string;
  category: 'flow' | 'ai' | 'logic' | 'data' | 'io';
  description: string;
  defaults?: Record<string, any>;
}

export const NODE_DEFINITIONS: Record<WorkflowNodeType, NodeDefinition> = {
  start: { type: 'start', label: 'Start', color: '#34d399', icon: 'play', category: 'flow', description: 'Workflow entry point', defaults: { inputVariables: [] } },
  end: { type: 'end', label: 'End', color: '#f87171', icon: 'square', category: 'flow', description: 'Workflow completion' },
  agent: { type: 'agent', label: 'Agent', color: '#818cf8', icon: 'bot', category: 'ai', description: 'AI reasoning with LLM', defaults: { model: 'claude-sonnet-4-20250514', systemPrompt: '', userPrompt: '', maxTokens: 4096, temperature: 0.7 } },
  mcp: { type: 'mcp', label: 'MCP Tool', color: '#fbbf24', icon: 'wrench', category: 'ai', description: 'External tool call (Firecrawl, APIs)', defaults: { serverId: '', toolName: '', arguments: {} } },
  'if-else': { type: 'if-else', label: 'If/Else', color: '#fb923c', icon: 'git-branch', category: 'logic', description: 'Conditional branching', defaults: { condition: '' } },
  while: { type: 'while', label: 'While Loop', color: '#c084fc', icon: 'repeat', category: 'logic', description: 'Iterate until condition', defaults: { condition: '', maxIterations: 10 } },
  'user-approval': { type: 'user-approval', label: 'User Approval', color: '#ec4899', icon: 'user-check', category: 'logic', description: 'Human-in-the-loop gate', defaults: { message: 'Approve to continue?' } },
  transform: { type: 'transform', label: 'Transform', color: '#60a5fa', icon: 'code', category: 'data', description: 'Run JavaScript to transform data', defaults: { code: 'return input;' } },
  'set-state': { type: 'set-state', label: 'Set State', color: '#a78bfa', icon: 'database', category: 'data', description: 'Set workflow variables', defaults: { variables: {} } },
  extract: { type: 'extract', label: 'Extract', color: '#2dd4bf', icon: 'file-text', category: 'data', description: 'Extract fields from data', defaults: { fields: [] } },
  http: { type: 'http', label: 'HTTP Request', color: '#94a3b8', icon: 'globe', category: 'io', description: 'Make HTTP API calls', defaults: { method: 'GET', url: '', headers: {}, body: '' } },
  note: { type: 'note', label: 'Note', color: '#fbbf24', icon: 'sticky-note', category: 'flow', description: 'Sticky note for documentation', defaults: { text: '' } },
};

export const NODE_CATEGORIES = [
  { id: 'flow', label: 'Flow Control', types: ['start', 'end', 'note'] as WorkflowNodeType[] },
  { id: 'ai', label: 'AI & Tools', types: ['agent', 'mcp'] as WorkflowNodeType[] },
  { id: 'logic', label: 'Logic', types: ['if-else', 'while', 'user-approval'] as WorkflowNodeType[] },
  { id: 'data', label: 'Data', types: ['transform', 'set-state', 'extract'] as WorkflowNodeType[] },
  { id: 'io', label: 'I/O', types: ['http'] as WorkflowNodeType[] },
];
