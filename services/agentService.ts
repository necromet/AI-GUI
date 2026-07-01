const API_BASE = '/api';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string }>;
}

export interface ToolResult {
  name: string;
  input: Record<string, any>;
  output: string;
  error?: string;
}

export interface AgentStreamChunk {
  text: string;
  thinkingText?: string;
  toolCall?: { name: string; arguments: Record<string, any> };
  toolResult?: ToolResult;
  toolSummary?: ToolResult[];
}

export async function getAvailableTools(): Promise<ToolDefinition[]> {
  const response = await fetch(`${API_BASE}/agent/tools`);
  if (!response.ok) throw new Error(`Tools error ${response.status}`);
  const data = await response.json();
  return data.tools || [];
}

export async function* sendAgentMessage(
  messages: { role: string; content: string }[],
  tools: string[],
  model?: string,
  provider?: string,
  signal?: AbortSignal,
  context?: Record<string, any>,
): AsyncGenerator<AgentStreamChunk> {
  const response = await fetch(`${API_BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      tools,
      model,
      provider,
      stream: true,
      context,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Agent error ${response.status}: ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  if (signal?.aborted) {
    reader.cancel();
    throw new DOMException('Aborted', 'AbortError');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  const abortPromise = new Promise<never>((_, reject) => {
    signal?.addEventListener('abort', () => {
      reader.cancel();
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });

  while (true) {
    const { done, value } = await Promise.race([reader.read(), abortPromise]);
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);

        if (parsed.error) {
          throw new Error(parsed.error);
        }

        if (parsed.tool_call) {
          yield { text: '', toolCall: parsed.tool_call };
          continue;
        }

        if (parsed.tool_result) {
          yield { text: '', toolResult: parsed.tool_result };
          continue;
        }

        if (parsed.tool_summary) {
          yield { text: '', toolSummary: parsed.tool_summary };
          continue;
        }

        const content = parsed.content;
        const reasoning = parsed.reasoning;

        if (content || reasoning) {
          yield {
            text: content || '',
            thinkingText: reasoning || undefined,
          };
        }
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        // skip malformed
      }
    }
  }
}
