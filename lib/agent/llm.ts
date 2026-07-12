import { getProviderConfig, type ChatMessage } from '../../server/services/mimoService';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface LLMStreamEvent {
  type: 'text' | 'reasoning' | 'tool_call' | 'finish' | 'error';
  text?: string;
  reasoning?: string;
  toolCall?: LLMToolCall;
  finishReason?: string;
  error?: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  tools?: any[];
  maxTokens?: number;
  temperature?: number;
  provider?: string;
  signal?: AbortSignal;
}

export async function* streamLLM(request: LLMRequest): AsyncGenerator<LLMStreamEvent> {
  const { key, base } = getProviderConfig(request.provider);

  const body: any = {
    model: request.model,
    messages: request.messages,
    stream: true,
  };

  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools;
  }
  if (request.maxTokens) {
    body.max_tokens = request.maxTokens;
  }
  if (request.temperature !== undefined) {
    body.temperature = request.temperature;
  }

  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal: request.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    yield { type: 'error', error: `LLM error ${response.status}: ${errorText}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error', error: 'No response body' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') {
        if (toolCalls.size > 0) {
          for (const tc of toolCalls.values()) {
            let parsed: Record<string, any> = {};
            try {
              parsed = JSON.parse(tc.arguments);
            } catch {}
            yield {
              type: 'tool_call',
              toolCall: { id: tc.id, name: tc.name, arguments: parsed },
            };
          }
        }
        yield { type: 'finish', finishReason: 'stop' };
        return;
      }

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        const finishReason = parsed.choices?.[0]?.finish_reason;

        if (delta?.content) {
          yield { type: 'text', text: delta.content };
        }

        if (delta?.reasoning_content) {
          yield { type: 'reasoning', reasoning: delta.reasoning_content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCalls.has(idx)) {
              toolCalls.set(idx, {
                id: tc.id || `call_${idx}`,
                name: tc.function?.name || '',
                arguments: tc.function?.arguments || '',
              });
            } else {
              const existing = toolCalls.get(idx)!;
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name = tc.function.name;
              if (tc.function?.arguments) existing.arguments += tc.function.arguments;
            }
          }
        }

        if (finishReason === 'tool_calls') {
          for (const tc of toolCalls.values()) {
            let parsed: Record<string, any> = {};
            try {
              parsed = JSON.parse(tc.arguments);
            } catch {}
            yield {
              type: 'tool_call',
              toolCall: { id: tc.id, name: tc.name, arguments: parsed },
            };
          }
          toolCalls.clear();
          yield { type: 'finish', finishReason: 'tool_calls' };
          return;
        }

        if (finishReason === 'stop') {
          yield { type: 'finish', finishReason: 'stop' };
          return;
        }
      } catch {
        // skip malformed
      }
    }
  }
}
