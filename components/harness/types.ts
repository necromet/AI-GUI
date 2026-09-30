import type { TaskNode, Usage } from '@/lib/harnessTypes';
export type { TaskNode, Usage };

export interface HarnessMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  blocks: HarnessBlock[];
  usage?: Usage;
  isStreaming?: boolean;
}

export type HarnessBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown; status: 'running' | 'done' | 'error'; output?: string; error?: string; collapsed?: boolean }
  | { type: 'task_tree'; tasks: TaskNode[] }
  | { type: 'question'; id: string; question: string; options?: string[]; answered?: string }
  | { type: 'permission'; id: string; tool: string; args: unknown; pattern?: string; decision?: 'allow' | 'allow_always' | 'deny' }
  | { type: 'error'; message: string };

export interface PendingState {
  id: string;
  kind: 'question' | 'permission';
  block: HarnessBlock;
}
