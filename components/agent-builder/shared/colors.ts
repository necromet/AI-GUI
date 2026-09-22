export const NODE_COLORS = {
  start: '#2dd48a',
  end: '#f05252',
  agent: '#7c86f8',
  mcp: '#f5b91a',
  guardrails: '#0db87a',
  arcade: '#2eb6e8',
  'if-else': '#f07830',
  while: '#b45af0',
  'user-approval': '#e83d8c',
  transform: '#4a90f0',
  'set-state': '#9a6cf0',
  extract: '#14c8b0',
  http: '#8a96a8',
  note: '#e8a81c',
} as const;

export const STATUS_COLORS = {
  running: '#f5b91a',
  completed: '#2dd48a',
  failed: '#f05252',
  pending: '#6b7280',
} as const;

export const SEMANTIC_COLORS = {
  danger: 'var(--semantic-danger, #f87171)',
  warning: 'var(--semantic-warning, #fbbf24)',
  success: 'var(--semantic-success, #34d399)',
  info: 'var(--semantic-info, #60a5fa)',
  default: 'var(--text-400, #6b7280)',
} as const;

export const HTTP_METHOD_COLORS: Record<string, { bg: string; text: string }> = {
  GET: { bg: 'rgba(45,212,138,0.16)', text: '#2dd48a' },
  POST: { bg: 'rgba(124,134,248,0.16)', text: '#7c86f8' },
  PUT: { bg: 'rgba(245,185,26,0.16)', text: '#f5b91a' },
  PATCH: { bg: 'rgba(245,185,26,0.16)', text: '#f5b91a' },
  DELETE: { bg: 'rgba(240,82,82,0.16)', text: '#f05252' },
};

export const VARIABLE_TYPE_COLORS: Record<string, string> = {
  string: '#4a90f0',
  object: '#9a6cf0',
  array: '#14c8b0',
  any: '#8a96a8',
};

export const CATEGORY_COLORS: Record<string, string> = {
  scraping: '#f5b91a',
  ai: '#7c86f8',
  data: '#4a90f0',
  workflow: '#e83d8c',
  logic: '#f07830',
  automation: '#14c8b0',
};

export const DEFAULT_NODE_COLOR = '#8a96a8';
