import type { Node, Edge } from '@xyflow/react';

export interface AgentBuilderTool {
  id: string;
  name: string;
  description: string;
  parameters_schema: Record<string, any>;
  implementation?: string;
  icon: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface AgentBuilderAgent {
  id: string;
  name: string;
  description?: string;
  system_prompt: string;
  model: string;
  provider?: string;
  color: string;
  icon: string;
  tools?: AgentBuilderTool[];
  created_at: string;
  updated_at: string;
}

export interface AgentBuilderWorkflow {
  id: string;
  name: string;
  description?: string;
  graph_json: { nodePositions?: Record<string, { x: number; y: number }>; edges: Edge[]; nodes?: Node[] };
  created_at: string;
  updated_at: string;
}

export interface WorkflowDetail extends AgentBuilderWorkflow {
  agents: (AgentBuilderAgent & { tools: AgentBuilderTool[] })[];
  tools: AgentBuilderTool[];
}

export interface AgentBuilderSession {
  id: string;
  agent_id: string;
  title?: string;
  messages_json: AgentBuilderMessage[];
  created_at: string;
  updated_at: string;
}

export interface AgentBuilderMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool_calls?: AgentBuilderToolCall[];
  tool_call_id?: string;
  tool_name?: string;
  timestamp?: number;
}

export interface AgentBuilderToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface AgentBuilderToolResult {
  name: string;
  input: Record<string, any>;
  output: string;
  error?: string;
}

export interface AgentStreamChunk {
  text: string;
  toolCall?: { id: string; name: string; arguments: Record<string, any> };
  toolResult?: { toolCallId: string; name: string; output: string };
}

export const DEFAULT_PARAMETERS_SCHEMA = {
  type: 'object',
  properties: {
    input: { type: 'string', description: 'Input text' },
  },
  required: ['input'],
};

export const TOOL_COLORS: Record<string, string> = {
  web_browse: '#66A0C8',
  execute_code: '#DFB431',
  search_web: '#A699D0',
  http_request: '#EC8B49',
  read_file: '#A0AF54',
  write_file: '#E47DA8',
};

export const AGENT_COLORS: Record<string, string> = {
  default: '#5ABDAC',
  researcher: '#66A0C8',
  coder: '#DFB431',
  writer: '#A699D0',
  analyst: '#EC8B49',
};
