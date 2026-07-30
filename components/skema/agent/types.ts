import type { AgentTask } from '@/components/ui/agent-plan';
import type { SkemaProject, ModelConfig } from '../../types';
import type { GridComponent, GridState } from '../../canvas/types';

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
  project: SkemaProject;
  activeBoardIdx: number;
  currentHtml: string;
  modelConfig?: ModelConfig;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  onHtmlGenerated?: (html: string) => void;
  models?: Array<{ id: string; name: string }>;
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;
  gridState?: GridState;
  onComponentPlaced?: (component: GridComponent) => void;
  onComponentRemoved?: (componentId: string) => void;
  onComponentUpdated?: (component: GridComponent) => void;
}
