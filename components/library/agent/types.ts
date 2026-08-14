import type { AgentTask } from '@/components/ui/agent-plan';
import type { LibraryComponent, ModelConfig } from '../../../types';

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

export interface AgentSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  selectedComponent: LibraryComponent | null;
  modelConfig?: ModelConfig;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  onComponentUpdated?: (comp: LibraryComponent) => void;
  onComponentsReload?: () => void;
  models?: Array<{ id: string; name: string }>;
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;
  onUndoAgent?: () => void;
  onRedoAgent?: () => void;
  canUndoAgent?: boolean;
  canRedoAgent?: boolean;
}
