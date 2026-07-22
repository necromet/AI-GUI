import type { AgentTask } from '@/components/ui/agent-plan';
import type { StitchProject, StitchBoard, StitchLayout, StitchProjectType, ModelConfig } from '../../types';

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

export interface StitchAgentSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  project: StitchProject;
  activeBoardIdx: number;
  currentHtml: string;
  currentSpec?: any;
  modelConfig?: ModelConfig;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  onHtmlGenerated?: (html: string) => void;
  onSpecGenerated?: (spec: any) => void;
  models?: Array<{ id: string; name: string }>;
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;
}
