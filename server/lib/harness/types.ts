export type {
  HarnessMode,
  PermissionAction,
  PermissionRule,
  HarnessConfig,
  TaskNode,
  Usage,
  HarnessEvent,
  ToolCapability,
  ToolMeta,
} from '../../../lib/harnessTypes';

export { DEFAULT_HARNESS_CONFIG, mergeHarnessConfig } from '../../../lib/harnessTypes';

import type { HarnessMode, ToolMeta } from '../../../lib/harnessTypes';

export interface ToolContext {
  /** Absolute workspace root for this agent session */
  workspaceRoot: string;
  agentId: string;
  sessionId: string;
  mode: HarnessMode;
  signal?: AbortSignal;
}

export interface ToolResult {
  output: string;
  error?: string;
}

export interface HarnessTool extends ToolMeta {
  parameters: Record<string, unknown>;
  execute: (args: Record<string, any>, ctx: ToolContext) => Promise<ToolResult>;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface LLMResponse {
  text: string;
  reasoning?: string;
  toolCalls?: LLMToolCall[];
  usage?: { prompt?: number; completion?: number; total?: number };
  error?: string;
}
