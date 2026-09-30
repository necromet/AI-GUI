import type {
  HarnessConfig,
  HarnessEvent,
  LLMMessage,
  LLMResponse,
  LLMToolCall,
  PermissionAction,
  TaskNode,
  Usage,
} from './types';
import type { ToolContext } from './types';
import { mergeHarnessConfig } from './types';
import { ToolRegistry, createRegistry } from './toolRegistry';
import { buildHarnessSystemPrompt } from './promptAssembler';
import { getProviderConfig } from '../../services/mimoService';
import { createTaskStore, type TaskStore } from './tasks';
import { createTaskTool } from './tools/taskTool';
import { createQuestionTool } from './tools/questionTool';
import { createPendingPromise } from './tools/questionTool';

const DOOM_LOOP_THRESHOLD = 3;
const MAX_TOOL_OUTPUT_CHARS = 12_000;

export interface RunHarnessOptions {
  agentId: string;
  sessionId: string;
  workspaceRoot: string;
  messages: LLMMessage[];
  systemPrompt?: string;
  agentPrompt?: string;
  model?: string;
  provider?: string;
  config?: Partial<HarnessConfig>;
  registry?: ToolRegistry;
  skills?: Array<{ name: string; description: string }>;
  memorySummary?: string;
  /** Pass an existing task store to preserve state across rounds; one is created if absent. */
  taskStore?: TaskStore;
  /** Resolve 'ask' permissions. Default: deny + emit permission_request. */
  permissionResolver?: (
    tool: string,
    args: Record<string, any>,
  ) => Promise<PermissionAction> | PermissionAction;
  onEvent?: (event: HarnessEvent) => void;
  signal?: AbortSignal;
  /** Injected for tests */
  llmCall?: (req: LLMRequest) => Promise<LLMResponse>;
}

export interface LLMRequest {
  model: string;
  provider: string;
  system: string;
  messages: LLMMessage[];
  tools: Array<{ type: 'function'; function: { name: string; description: string; parameters: unknown } }>;
  maxTokens?: number;
}

export interface RunHarnessResult {
  output: string;
  usage?: Usage;
  toolCalls: Array<{ id: string; name: string; args: Record<string, any>; output: string; error?: string }>;
  stopped: 'done' | 'max_steps' | 'doom_loop' | 'error' | 'aborted';
}

function emit(onEvent: RunHarnessOptions['onEvent'], event: HarnessEvent): void {
  try {
    onEvent?.(event);
  } catch {
    /* ignore listener errors */
  }
}

function truncateOutput(text: string): string {
  if (text.length <= MAX_TOOL_OUTPUT_CHARS) return text;
  return text.slice(0, MAX_TOOL_OUTPUT_CHARS) + '\n…[truncated]';
}

function toolPathArg(name: string, args: Record<string, any>): string | undefined {
  if (name === 'read' || name === 'write' || name === 'edit') {
    return typeof args?.path === 'string' ? args.path : undefined;
  }
  return undefined;
}

export async function runHarness(options: RunHarnessOptions): Promise<RunHarnessResult> {
  const config = mergeHarnessConfig(options.config);
  const registry = options.registry ?? createRegistry();
  const emitEvent = options.onEvent;

  const taskStore = options.taskStore ?? createTaskStore();
  if (!registry.get('task')) {
    for (const t of createTaskTool(taskStore, emitEvent)) registry.register(t);
  }
  if (!registry.get('question')) {
    for (const t of createQuestionTool(emitEvent)) registry.register(t);
  }

  const tools = registry.list(config.mode, config);
  const system = options.systemPrompt
    ?? buildHarnessSystemPrompt({
        agentPrompt: options.agentPrompt,
        mode: config.mode,
        workspaceRoot: options.workspaceRoot,
        tools,
        skills: options.skills,
        memorySummary: options.memorySummary,
        taskDump: taskStore.dump(),
      });

  const openAITools = registry.toOpenAITools(config.mode, config);
  const llmCall = options.llmCall ?? defaultLLMCall;

  const apiMessages: LLMMessage[] = [{ role: 'system', content: system }, ...options.messages];
  const toolCallsLog: RunHarnessResult['toolCalls'] = [];
  let lastOutput = '';
  let usage: Usage | undefined;
  let stopped: RunHarnessResult['stopped'] = 'done';

  const recentToolKeys: string[] = [];

  for (let step = 0; step < config.maxSteps; step++) {
    if (options.signal?.aborted) {
      stopped = 'aborted';
      break;
    }

    let response: LLMResponse;
    try {
      response = await llmCall({
        model: options.model || 'mimo-v2.5',
        provider: options.provider || 'mimo',
        system,
        messages: apiMessages,
        tools: openAITools,
      });
    } catch (err: any) {
      emit(emitEvent, { type: 'error', message: err?.message || String(err) });
      stopped = 'error';
      break;
    }

    if (response.error) {
      emit(emitEvent, { type: 'error', message: response.error });
      stopped = 'error';
      break;
    }

    if (response.reasoning) {
      emit(emitEvent, { type: 'reasoning', text: response.reasoning });
    }
    if (response.text) {
      lastOutput = response.text;
      emit(emitEvent, { type: 'content', text: response.text });
    }
    if (response.usage) {
      usage = {
        prompt: response.usage.prompt ?? 0,
        completion: response.usage.completion ?? 0,
        total: response.usage.total ?? 0,
      };
    }

    const toolCalls = response.toolCalls?.length
      ? response.toolCalls
      : parseFallbackToolCalls(response.text || '');

    if (toolCalls.length === 0) {
      stopped = 'done';
      break;
    }

    apiMessages.push({
      role: 'assistant',
      content: response.text || '',
    });

    for (const call of toolCalls) {
      const key = call.name + ':' + JSON.stringify(call.arguments);
      recentToolKeys.push(key);
      const repeats = recentToolKeys.filter(k => k === key).length;
      if (repeats >= DOOM_LOOP_THRESHOLD) {
        emit(emitEvent, {
          type: 'error',
          message: 'Doom loop detected: tool ' + call.name + ' repeated with identical arguments',
        });
        stopped = 'doom_loop';
        break;
      }

      emit(emitEvent, { type: 'tool_call', id: call.id, name: call.name, args: call.arguments });

      const pathArg = toolPathArg(call.name, call.arguments || {});
      let permission: PermissionAction = registry.permissionFor(
        call.name,
        pathArg,
        config.permissions,
      );

      if (permission === 'ask') {
        if (options.permissionResolver) {
          permission = await options.permissionResolver(call.name, call.arguments || {});
        } else {
          const answer = await createPendingPromise(
            'permission',
            {
              type: 'permission_request',
              id: call.id,
              tool: call.name,
              args: call.arguments,
              pattern: pathArg,
            },
            emitEvent,
          );
          if (answer.decision === 'allow' || answer.decision === 'allow_always') {
            permission = 'allow';
          } else {
            permission = 'deny';
          }
        }
      }

      if (permission === 'deny') {
        const msg = 'Permission denied for ' + call.name;
        emit(emitEvent, { type: 'tool_result', id: call.id, name: call.name, output: '', error: msg });
        apiMessages.push({ role: 'tool', content: msg, tool_call_id: call.id, name: call.name });
        toolCallsLog.push({ id: call.id, name: call.name, args: call.arguments, output: '', error: msg });
        continue;
      }

      const ctx: ToolContext = {
        workspaceRoot: options.workspaceRoot,
        agentId: options.agentId,
        sessionId: options.sessionId,
        mode: config.mode,
        signal: options.signal,
      };

      const result = await registry.execute(call.name, call.arguments || {}, ctx, config.permissions);
      const output = truncateOutput(result.output || result.error || '(empty)');
      const error = result.error;

      emit(emitEvent, {
        type: 'tool_result',
        id: call.id,
        name: call.name,
        output: result.output || '',
        error: result.error || undefined,
      });

      apiMessages.push({
        role: 'tool',
        content: error ? 'Error: ' + error : output,
        tool_call_id: call.id,
        name: call.name,
      });
      toolCallsLog.push({
        id: call.id,
        name: call.name,
        args: call.arguments,
        output: result.output,
        error: result.error,
      });
    }

    if (stopped === 'doom_loop') break;
    if (step === config.maxSteps - 1) stopped = 'max_steps';
  }

  const finalOutput = lastOutput || (toolCallsLog.length ? 'Completed ' + toolCallsLog.length + ' tool call(s)' : '');
  emit(emitEvent, { type: 'done', output: finalOutput, usage });

  return { output: finalOutput, usage, toolCalls: toolCallsLog, stopped };
}

/** Fallback: fenced ```tool / ```json blocks and bare {"name","arguments"} objects. */
export function parseFallbackToolCalls(response: string): LLMToolCall[] {
  const calls: LLMToolCall[] = [];
  const seen = new Set<string>();
  let seq = 0;

  const add = (name: string, args: Record<string, any>) => {
    const key = name + ':' + JSON.stringify(args);
    if (seen.has(key)) return;
    seen.add(key);
    calls.push({ id: 'call_fallback_' + (++seq), name, arguments: args });
  };

  const blockRe = /```(?:tool|json)\s*\n?([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(response)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (parsed?.name) add(parsed.name, parsed.arguments || {});
    } catch {
      /* ignore */
    }
  }

  if (calls.length === 0) {
    const bareRe = /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}/g;
    while ((m = bareRe.exec(response)) !== null) {
      try {
        add(m[1], JSON.parse(m[2]));
      } catch {
        /* ignore */
      }
    }
  }

  return calls;
}

async function defaultLLMCall(req: LLMRequest): Promise<LLMResponse> {
  const { key, base } = getProviderConfig(req.provider === 'mimo' ? undefined : req.provider);

  const body: Record<string, unknown> = {
    model: req.model,
    messages: [
      { role: 'system', content: req.system },
      ...req.messages
        .filter(m => m.role !== 'system')
        .map(m =>
          m.role === 'tool'
            ? {
                role: 'tool',
                content: m.content,
                tool_call_id: m.tool_call_id || 'call_unknown',
              }
            : { role: m.role, content: m.content },
        ),
    ],
    max_tokens: req.maxTokens || 4096,
    temperature: 0.7,
    stream: false,
  };

  if (req.tools.length) {
    body.tools = req.tools;
    body.tool_choice = 'auto';
  }

  const response = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + key,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const text = await response.text();
    return { text: '', error: 'LLM API error ' + response.status + ': ' + text.slice(0, 300) };
  }

  const data = await response.json();
  if (data.error) {
    return { text: '', error: data.error.message || 'LLM error' };
  }

  const choice = data.choices?.[0];
  const message = choice?.message || {};
  const toolCalls: LLMToolCall[] = (message.tool_calls || []).map((tc: any, i: number) => {
    let args: Record<string, any> = {};
    try {
      args = typeof tc.function?.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function?.arguments || {};
    } catch {
      args = {};
    }
    return {
      id: tc.id || 'call_' + i,
      name: tc.function?.name || 'unknown',
      arguments: args,
    };
  });

  return {
    text: message.content || '',
    reasoning: message.reasoning_content || undefined,
    toolCalls: toolCalls.length ? toolCalls : undefined,
    usage: {
      prompt: data.usage?.prompt_tokens,
      completion: data.usage?.completion_tokens,
      total: data.usage?.total_tokens,
    },
  };
}

export type { TaskNode };
