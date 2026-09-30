/** Shared harness types — imported by server/lib/harness and components/harness. */

export type HarnessMode = 'build' | 'plan';

export type PermissionAction = 'allow' | 'deny' | 'ask';

export interface PermissionRule {
  /** Tool name or glob (e.g. "write", "fs.*", "*") */
  tool: string;
  /** Optional path glob for fs/shell tools */
  pattern?: string;
  action: PermissionAction;
}

export interface HarnessConfig {
  mode: HarnessMode;
  maxSteps: number;
  memoryEnabled: boolean;
  skillsEnabled: boolean;
  subagentsEnabled: boolean;
  tools: Record<string, boolean>;
  permissions: PermissionRule[];
}

export interface TaskNode {
  id: string;
  parentId: string | null;
  summary: string;
  status: 'open' | 'in_progress' | 'done' | 'blocked' | 'abandoned';
}

export interface Usage {
  prompt: number;
  completion: number;
  total: number;
}

export type HarnessEvent =
  | { type: 'content'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown }
  | { type: 'tool_result'; id: string; name: string; output: string; error?: string }
  | { type: 'permission_request'; id: string; tool: string; args: unknown; pattern?: string }
  | { type: 'task_update'; tasks: TaskNode[] }
  | { type: 'question'; id: string; question: string; options?: string[] }
  | { type: 'done'; output: string; usage?: Usage }
  | { type: 'error'; message: string };

export type ToolCapability = 'fs' | 'shell' | 'web' | 'meta';

export interface ToolMeta {
  name: string;
  description: string;
  capability: ToolCapability;
  /** Modes where the tool is available */
  modes: HarnessMode[];
  /** Default permission when no rules match */
  defaultAction: PermissionAction;
}

export const DEFAULT_HARNESS_CONFIG: HarnessConfig = {
  mode: 'build',
  maxSteps: 20,
  memoryEnabled: true,
  skillsEnabled: true,
  subagentsEnabled: false,
  tools: {},
  permissions: [],
};

export function mergeHarnessConfig(partial?: Partial<HarnessConfig> | null): HarnessConfig {
  return {
    ...DEFAULT_HARNESS_CONFIG,
    ...(partial || {}),
    tools: { ...(partial?.tools || {}) },
    permissions: [...(partial?.permissions || [])],
  };
}
