export const NODE_COLORS = {
  start: '#34d399',
  end: '#f87171',
  agent: '#818cf8',
  mcp: '#fbbf24',
  'if-else': '#fb923c',
  while: '#c084fc',
  'user-approval': '#ec4899',
  transform: '#60a5fa',
  'set-state': '#a78bfa',
  extract: '#2dd4bf',
  http: '#94a3b8',
  note: '#fbbf24',
} as const;

export const STATUS_COLORS = {
  running: '#fbbf24',
  completed: '#34d399',
  failed: '#f87171',
  pending: '#6b7280',
} as const;

export const SEMANTIC_COLORS = {
  danger: '#f87171',
  warning: '#fbbf24',
  success: '#34d399',
  info: '#60a5fa',
  default: '#6b7280',
} as const;

export const HTTP_METHOD_COLORS: Record<string, { bg: string; text: string }> = {
  GET: { bg: '#34d39920', text: '#34d399' },
  POST: { bg: '#818cf820', text: '#818cf8' },
  PUT: { bg: '#fbbf2420', text: '#fbbf24' },
  PATCH: { bg: '#fbbf2420', text: '#fbbf24' },
  DELETE: { bg: '#f8717120', text: '#f87171' },
};

export const VARIABLE_TYPE_COLORS: Record<string, string> = {
  string: '#60a5fa',
  object: '#a78bfa',
  array: '#2dd4bf',
  any: '#94a3b8',
};

export const CATEGORY_COLORS: Record<string, string> = {
  scraping: '#fbbf24',
  ai: '#818cf8',
  data: '#60a5fa',
  workflow: '#ec4899',
  logic: '#fb923c',
};

export const DEFAULT_NODE_COLOR = '#94a3b8';
