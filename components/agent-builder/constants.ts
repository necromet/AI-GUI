import type { WorkflowNodeType } from './types';
import { NODE_COLORS } from './shared/colors';

export interface NodeDefinition {
  type: WorkflowNodeType;
  label: string;
  color: string;
  icon: string;
  category: 'flow' | 'ai' | 'logic' | 'data' | 'io';
  description: string;
  defaults?: Record<string, any>;
}

export const DEFAULT_NODE_COLOR = '#6b7280';
export const AUTO_SAVE_DELAY_MS = 5000;
export const MAX_UNDO_STACK_SIZE = 50;
export const APPROVAL_POLL_INTERVAL_MS = 3000;
export const PANEL_MIN_WIDTH = 280;
export const PANEL_MAX_WIDTH = 500;
export const DEFAULT_AGENT_MODEL = 'mimo-v2.5';
export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_TEMPERATURE = 0.7;

export const NODE_DEFINITIONS: Record<WorkflowNodeType, NodeDefinition> = {
  start: { type: 'start', label: 'Start', color: NODE_COLORS.start, icon: 'play', category: 'flow', description: 'Workflow entry point', defaults: { inputVariables: [] } },
  end: { type: 'end', label: 'End', color: NODE_COLORS.end, icon: 'square', category: 'flow', description: 'Workflow completion' },
  agent: { type: 'agent', label: 'Agent', color: NODE_COLORS.agent, icon: 'bot', category: 'ai', description: 'AI reasoning with LLM', defaults: { model: DEFAULT_AGENT_MODEL, systemPrompt: '', userPrompt: '', maxTokens: DEFAULT_MAX_TOKENS, temperature: DEFAULT_TEMPERATURE } },
  mcp: { type: 'mcp', label: 'MCP Tool', color: NODE_COLORS.mcp, icon: 'wrench', category: 'ai', description: 'External tool call (Firecrawl, APIs)', defaults: { serverId: '', toolName: '', arguments: {} } },
  guardrails: { type: 'guardrails', label: 'Guardrails', color: NODE_COLORS.guardrails, icon: 'shield', category: 'ai', description: 'Content safety checks (PII, moderation, jailbreak)', defaults: { checks: { pii: true, moderation: true, jailbreak: true }, action: 'block' } },
  'if-else': { type: 'if-else', label: 'If/Else', color: NODE_COLORS['if-else'], icon: 'git-branch', category: 'logic', description: 'Conditional branching', defaults: { condition: '' } },
  while: { type: 'while', label: 'While Loop', color: NODE_COLORS.while, icon: 'repeat', category: 'logic', description: 'Iterate until condition', defaults: { condition: '', maxIterations: 10 } },
  'user-approval': { type: 'user-approval', label: 'User Approval', color: NODE_COLORS['user-approval'], icon: 'user-check', category: 'logic', description: 'Human-in-the-loop gate', defaults: { message: 'Approve to continue?' } },
  transform: { type: 'transform', label: 'Transform', color: NODE_COLORS.transform, icon: 'code', category: 'data', description: 'Run JavaScript to transform data', defaults: { code: 'return input;' } },
  'set-state': { type: 'set-state', label: 'Set State', color: NODE_COLORS['set-state'], icon: 'database', category: 'data', description: 'Set workflow variables', defaults: { variables: {} } },
  extract: { type: 'extract', label: 'Extract', color: NODE_COLORS.extract, icon: 'file-text', category: 'data', description: 'Extract fields from data', defaults: { fields: [] } },
  http: { type: 'http', label: 'HTTP Request', color: NODE_COLORS.http, icon: 'globe', category: 'io', description: 'Make HTTP API calls', defaults: { method: 'GET', url: '', headers: {}, body: '' } },
  note: { type: 'note', label: 'Note', color: NODE_COLORS.note, icon: 'sticky-note', category: 'flow', description: 'Sticky note for documentation', defaults: { text: '' } },
};

export const NODE_CATEGORIES = [
  { id: 'flow', label: 'Flow Control', types: ['start', 'end', 'note'] as WorkflowNodeType[] },
  { id: 'ai', label: 'AI & Tools', types: ['agent', 'mcp', 'guardrails'] as WorkflowNodeType[] },
  { id: 'logic', label: 'Logic', types: ['if-else', 'while', 'user-approval'] as WorkflowNodeType[] },
  { id: 'data', label: 'Data', types: ['transform', 'set-state', 'extract'] as WorkflowNodeType[] },
  { id: 'io', label: 'I/O', types: ['http'] as WorkflowNodeType[] },
];
