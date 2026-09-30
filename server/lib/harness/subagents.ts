import type { HarnessTool, ToolContext, ToolResult } from './types';
import { createRegistry, ToolRegistry } from './toolRegistry';
import { runHarness, type RunHarnessResult, type LLMRequest } from './runner';
import type { HarnessConfig, LLMMessage } from './types';
import type { TaskStore } from './tasks';

const READONLY_TOOLS = new Set(['read', 'glob', 'grep', 'webfetch', 'websearch', 'memory', 'skill', 'skill_search', 'task']);

function filterReadOnly(registry: ToolRegistry): ToolRegistry {
  const filtered = new ToolRegistry();
  for (const tool of registry.list('build')) {
    if (READONLY_TOOLS.has(tool.name)) {
      filtered.register(tool);
    }
  }
  return filtered;
}

export function createSubagentTool(opts: {
  workspaceRoot: string;
  agentId: string;
  sessionId: string;
  config?: Partial<HarnessConfig>;
  model?: string;
  provider?: string;
  taskStore?: TaskStore;
  llmCall?: (req: LLMRequest) => Promise<any>;
}): HarnessTool[] {
  async function subagentExecute(
    args: Record<string, any>,
    _ctx: ToolContext,
  ): Promise<ToolResult> {
    const prompt = String(args.prompt || '');
    if (!prompt) return { output: '', error: 'prompt is required' };
    const agentType = String(args.type || 'explore');
    const maxSteps = Number(args.max_steps) || 10;

    const parentRegistry = opts.config?.tools
      ? createRegistry()
      : createRegistry();

    let registry: ToolRegistry;
    if (agentType === 'explore') {
      registry = filterReadOnly(parentRegistry);
    } else {
      registry = parentRegistry;
    }

    const result = await runHarness({
      agentId: opts.agentId,
      sessionId: opts.sessionId + '_sub_' + Date.now(),
      workspaceRoot: opts.workspaceRoot,
      messages: [{ role: 'user', content: prompt }],
      model: opts.model,
      provider: opts.provider,
      config: {
        ...opts.config,
        mode: agentType === 'explore' ? 'plan' : (opts.config?.mode || 'build'),
        maxSteps,
      },
      registry,
      taskStore: opts.taskStore,
      llmCall: opts.llmCall,
    });

    return {
      output: result.output || '(no output from subagent)',
      error: result.stopped === 'error' ? 'Subagent stopped with error' : undefined,
    };
  }

  return [
    {
      name: 'subagent',
      description:
        'Spawn a child agent to handle a subtask. Types: "explore" (read-only analysis, safe) or "general" (full tools). Returns the subagent final output.',
      capability: 'meta' as const,
      modes: ['build' as const],
      defaultAction: 'ask' as const,
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'The task for the subagent to perform' },
          type: { type: 'string', description: '"explore" (read-only) or "general" (full tools)', enum: ['explore', 'general'] },
          max_steps: { type: 'number', description: 'Max steps for the subagent (default 10)' },
        },
        required: ['prompt'],
      },
      execute: subagentExecute,
    },
  ];
}