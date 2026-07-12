import type { ToolInfo, ToolContext } from './tool';
import { toolsToOpenAI } from './tool';
import { streamLLM, type LLMMessage, type LLMStreamEvent } from './llm';
import { evaluate, type Ruleset, DEFAULT_PERMISSIONS } from './permission';

export interface ProcessorConfig {
  model: string;
  systemPrompt: string;
  tools: ToolInfo[];
  permissions?: Ruleset;
  maxIterations?: number;
  maxTokens?: number;
  temperature?: number;
  provider?: string;
}

export interface ProcessorEvent {
  type:
    | 'text'
    | 'reasoning'
    | 'tool_start'
    | 'tool_progress'
    | 'tool_result'
    | 'tool_error'
    | 'iteration'
    | 'error'
    | 'done';
  text?: string;
  reasoning?: string;
  toolName?: string;
  toolId?: string;
  toolArgs?: Record<string, any>;
  toolOutput?: string;
  toolError?: string;
  iteration?: number;
  maxIterations?: number;
  error?: string;
  finishReason?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export async function* processAgent(
  config: ProcessorConfig,
  userMessages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
): AsyncGenerator<ProcessorEvent> {
  const {
    model,
    systemPrompt,
    tools,
    permissions = DEFAULT_PERMISSIONS,
    maxIterations = 10,
    maxTokens,
    temperature,
    provider,
  } = config;

  const openAITools = toolsToOpenAI(tools);
  const messages: LLMMessage[] = [{ role: 'system', content: systemPrompt }];

  for (const msg of userMessages) {
    messages.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    });
  }

  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    yield { type: 'iteration', iteration, maxIterations };

    const toolCallAccumulator: Map<string, { name: string; arguments: Record<string, any> }> = new Map();
    let fullText = '';
    let fullReasoning = '';
    let finishReason = '';

    const llmStream = streamLLM({
      model,
      messages,
      tools: openAITools.length > 0 ? openAITools : undefined,
      maxTokens,
      temperature,
      provider,
      signal,
    });

    for await (const event of llmStream) {
      if (event.type === 'error') {
        yield { type: 'error', error: event.error };
        return;
      }

      if (event.type === 'text' && event.text) {
        fullText += event.text;
        yield { type: 'text', text: event.text };
      }

      if (event.type === 'reasoning' && event.reasoning) {
        fullReasoning += event.reasoning;
        yield { type: 'reasoning', reasoning: event.reasoning };
      }

      if (event.type === 'tool_call' && event.toolCall) {
        toolCallAccumulator.set(event.toolCall.id, {
          name: event.toolCall.name,
          arguments: event.toolCall.arguments,
        });
      }

      if (event.type === 'finish') {
        finishReason = event.finishReason || 'stop';
      }
    }

    if (toolCallAccumulator.size === 0) {
      yield { type: 'done', finishReason };
      return;
    }

    const assistantMessage: LLMMessage = {
      role: 'assistant',
      content: fullText || '',
      tool_calls: Array.from(toolCallAccumulator.entries()).map(([id, tc]) => ({
        id,
        type: 'function' as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      })),
    };
    messages.push(assistantMessage);

    for (const [id, tc] of toolCallAccumulator) {
      const tool = tools.find((t) => t.name === tc.name);
      if (!tool) {
        yield {
          type: 'tool_error',
          toolName: tc.name,
          toolId: id,
          toolError: `Unknown tool: ${tc.name}`,
        };
        messages.push({
          role: 'tool',
          content: `Error: Unknown tool "${tc.name}"`,
          tool_call_id: id,
        });
        continue;
      }

      const perm = evaluate(tool.permission, '*', permissions);
      if (perm.action === 'deny') {
        yield {
          type: 'tool_error',
          toolName: tc.name,
          toolId: id,
          toolError: 'Permission denied',
        };
        messages.push({
          role: 'tool',
          content: 'Error: Permission denied for this tool',
          tool_call_id: id,
        });
        continue;
      }

      yield {
        type: 'tool_start',
        toolName: tc.name,
        toolId: id,
        toolArgs: tc.arguments,
      };

      const ctx: ToolContext = {
        sessionId: '',
        agent: 'library',
        abort: signal || new AbortController().signal,
        metadata: () => {},
        ask: async (q: string) => q,
      };

      try {
        const result = await tool.execute(tc.arguments, ctx);

        yield {
          type: 'tool_result',
          toolName: tc.name,
          toolId: id,
          toolOutput: result.output,
          toolError: result.error,
        };

        messages.push({
          role: 'tool',
          content: result.error
            ? `Error: ${result.error}\n${result.output}`
            : result.output,
          tool_call_id: id,
        });
      } catch (err: any) {
        const errorMsg = err.message || 'Tool execution failed';
        yield {
          type: 'tool_error',
          toolName: tc.name,
          toolId: id,
          toolError: errorMsg,
        };
        messages.push({
          role: 'tool',
          content: `Error: ${errorMsg}`,
          tool_call_id: id,
        });
      }
    }
  }

  yield { type: 'done', finishReason: 'max_iterations' };
}
