const API_BASE = '/api/agent/opencode';

export interface OpenCodeEvent {
  type: string;
  text?: string;
  thinkingText?: string;
  toolCall?: { id: string; name: string; arguments: Record<string, any> };
  toolResult?: { id: string; name: string; result: any; error?: string };
  sessionId?: string;
  error?: string;
}

export async function createSession(): Promise<string> {
  const resp = await fetch(`${API_BASE}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Create session failed ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  if (data.name === 'ConfigJsonError' || data.name === 'ConfigInvalidError') {
    throw new Error(`OpenCode config error: ${data.data?.message || data.name}`);
  }
  return data.id;
}

export async function* sendOpenCodeMessage(
  sessionId: string,
  text: string,
  signal?: AbortSignal,
): AsyncGenerator<OpenCodeEvent> {
  const resp = await fetch(`${API_BASE}/session/${sessionId}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parts: [{ type: 'text', text }],
    }),
    signal,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenCode error ${resp.status}: ${errText}`);
  }

  const reader = resp.body?.getReader();
  if (!reader) throw new Error('No response body');

  if (signal?.aborted) {
    reader.cancel();
    throw new DOMException('Aborted', 'AbortError');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let currentPartType: Record<string, string> = {};

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
        const eventType = parsed.type || '';
        const props = parsed.properties || {};

        if (eventType === 'session.error') {
          throw new Error(props.error || 'Session error');
        }

        if (eventType === 'session.idle') {
          return;
        }

        if (eventType === 'message.part.updated') {
          const part = props.part || {};
          const partId = part.id || '';

          if (part.type) {
            currentPartType[partId] = part.type;
          }

          if (part.type === 'text' && part.text) {
            yield { type: 'text', text: part.text };
          }

          if (part.type === 'reasoning' && part.text) {
            yield { type: 'reasoning', thinkingText: part.text };
          }

          if (part.type === 'tool-call') {
            yield {
              type: 'tool-call',
              toolCall: {
                id: partId,
                name: part.toolName || part.name || '',
                arguments: part.input || part.arguments || {},
              },
            };
          }

          if (part.type === 'tool-result') {
            yield {
              type: 'tool-result',
              toolResult: {
                id: partId,
                name: part.toolName || part.name || '',
                result: part.result,
                error: part.error,
              },
            };
          }
        }

        if (eventType === 'message.part.delta') {
          const partId = props.partID || '';
          const field = props.field || '';
          const delta = props.delta || '';
          const partType = currentPartType[partId] || '';

          if (field === 'text') {
            if (partType === 'reasoning') {
              yield { type: 'reasoning', thinkingText: delta };
            } else {
              yield { type: 'text', text: delta };
            }
          }

          if (field === 'input' || field === 'arguments') {
            // Tool call argument deltas — accumulate in caller
          }
        }

        if (eventType === 'message.updated') {
          const info = props.info || {};
          if (info.finish === 'stop' || info.finish === 'error') {
            // Message complete
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        // skip malformed JSON
      }
    }
  }
}
