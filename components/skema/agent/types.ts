import type { AgentTask } from '@/components/ui/agent-plan';

export type MessageBlock =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; id?: string; name: string; arguments: Record<string, any>; result?: { output: string; error?: string }; collapsed?: boolean; progress?: string }
  | { type: 'ask_user'; question: string }
  | { type: 'agent_plan'; tasks: AgentTask[] };

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isThinking?: boolean;
  blocks?: MessageBlock[];
}

export interface SkemaAgentSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  project: any;
  activeBoardIdx: number;
  currentHtml: string;
  currentFiles?: Array<{ path: string; content: string; language: string; isEntry?: boolean }>;
  modelConfig?: any;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  onFileCreated?: (file: { path: string; content: string; language: string; isEntry?: boolean }) => void;
  onFileUpdated?: (path: string, content: string) => void;
  onFileDeleted?: (path: string) => void;
  onPreviewSet?: (path: string) => void;
  models?: Array<{ id: string; name: string }>;
  selectedModelId?: string;
  onModelChange?: (id: string) => void;
}
