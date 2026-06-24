import { Attachment } from '../types';

const apiKey = process.env.MIMO_API_KEY || '';
const baseUrl = '/mimo-api';
const directApiKey = process.env.MIMO_DIRECT_API_KEY || '';
const directBaseUrl = '/mimo-direct-api';

function getProviderConfig(provider?: string): { key: string; base: string } {
  if (provider === 'mimo-direct') {
    return { key: directApiKey, base: directBaseUrl };
  }
  return { key: apiKey, base: baseUrl };
}

interface MiMoStreamChunk {
  text: string;
  thinkingText?: string;
  annotations?: any[];
}

function isQuotaError(errorText: string): boolean {
  try {
    const parsed = JSON.parse(errorText);
    return parsed?.error?.type === 'limitation' || parsed?.error?.code === '429';
  } catch {
    return false;
  }
}

function getRetryAfterMs(response: Response): number {
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) return seconds * 1000;
  }
  return 5000;
}

async function* parseSSEStream(response: Response, signal?: AbortSignal): AsyncGenerator<MiMoStreamChunk> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let allAnnotations: any[] = [];

  while (true) {
    if (signal?.aborted) {
      reader.cancel();
      throw new DOMException('Aborted', 'AbortError');
    }

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
        if (allAnnotations.length > 0) {
          yield { text: '', annotations: allAnnotations };
        }
        return;
      }

      try {
        const parsed = JSON.parse(data);
        const choice = parsed.choices?.[0];
        const delta = choice?.delta;

        const annotationSources = [
          delta?.annotations,
          choice?.message?.annotations,
          choice?.annotations,
          parsed.annotations,
        ];
        for (const anns of annotationSources) {
          if (Array.isArray(anns) && anns.length > 0) {
            allAnnotations.push(...anns);
            break;
          }
        }

        if (!delta) continue;

        const content = delta.content;
        const reasoning = delta.reasoning_content;

        if (content || reasoning) {
          yield {
            text: content || '',
            thinkingText: reasoning || undefined,
          };
        }
      } catch {
        // skip malformed lines
      }
    }
  }
}

export const generateResponseStream = async (
  modelId: string,
  prompt: string,
  history: { role: string; content: string; attachments?: Attachment[] }[],
  systemInstruction?: string,
  provider?: string,
  retries = 3,
  maxTokens?: number,
  signal?: AbortSignal,
  options?: { search?: boolean; think?: boolean },
) => {
  const { key, base } = getProviderConfig(provider);
  const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];

  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  for (const msg of history) {
    const role = msg.role === 'model' ? 'assistant' : msg.role;
    if (msg.attachments && msg.attachments.length > 0) {
      const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
      if (msg.content) {
        content.push({ type: 'text', text: msg.content });
      }
      for (const att of msg.attachments) {
        content.push({ type: 'image_url', image_url: { url: att.data } });
      }
      messages.push({ role, content });
    } else {
      messages.push({ role, content: msg.content });
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const body: any = {
      model: modelId,
      messages,
      stream: true,
    };
    if (maxTokens && maxTokens > 0) {
      body.max_tokens = maxTokens;
    }
    if (options?.search) {
      body.tools = [{ type: 'web_search', max_keyword: 3, force_search: true }];
    }
    if (options?.think !== undefined) {
      body.thinking = { type: options.think ? 'enabled' : 'disabled' };
    }

    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (response.ok) {
      return parseSSEStream(response, signal);
    }

    const errorText = await response.text();

    if (response.status === 429) {
      if (isQuotaError(errorText)) {
        throw new Error('API quota exhausted. Please wait for your quota to reset or use a different API key.');
      }
      if (attempt < retries) {
        const delay = getRetryAfterMs(response) * (attempt + 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        lastError = new Error(`Rate limited (attempt ${attempt + 1}/${retries + 1}), retrying...`);
        continue;
      }
    }

    throw new Error(`MiMo API error ${response.status}: ${errorText}`);
  }

  throw lastError || new Error('Max retries exceeded');
};

export const generateChatTitle = async (
  userMessage: string,
  assistantResponse: string,
  provider?: string,
): Promise<string> => {
  try {
    const { key, base } = getProviderConfig(provider);
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'mimo-v2.5',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates concise, descriptive titles for conversations. Create a title that is 3-7 words long and captures the main topic of the conversation. Do not use quotes or punctuation except hyphens. Return only the title text.',
          },
          {
            role: 'user',
            content: `Based on this conversation, generate a short, descriptive title (3-7 words):\n\nUser: ${userMessage.substring(0, 200)}\n\nAssistant: ${assistantResponse.substring(0, 200)}`,
          },
        ],
        stream: false,
        thinking: { type: 'disabled' },
      }),
    });

    if (!response.ok) {
      throw new Error(`MiMo API error ${response.status}`);
    }

    const data = await response.json();
    let title = data.choices?.[0]?.message?.content?.trim() || '';
    title = title.replace(/["']/g, '');

    if (!title || title.length > 100) {
      return userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');
    }

    return title;
  } catch (error) {
    console.error('Error generating MiMo chat title:', error);
    return userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');
  }
};

export const BUILT_IN_VOICES = [
  'mimo_default',
  'default_zh',
  'default_en',
  'Mia',
  'Chloe',
  'Milo',
  'Dean',
];

export async function generateSpeech(params: {
  model: string;
  text: string;
  voice?: string;
  style?: string;
  provider?: string;
}): Promise<string> {
  const { key, base } = getProviderConfig(params.provider);
  const messages: Array<{ role: string; content: string }> = [];

  if (params.style) {
    messages.push({ role: 'user', content: params.style });
  }

  messages.push({ role: 'assistant', content: params.text });

  const body: any = {
    model: params.model,
    messages,
    stream: false,
    audio: {
      format: 'mp3',
    },
  };

  if (params.voice) {
    body.audio.voice = params.voice;
  }

  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiMo TTS error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const audioBase64 = data.choices?.[0]?.message?.audio?.data;
  if (!audioBase64) {
    throw new Error('No audio data in response');
  }

  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'audio/mp3' });
  return URL.createObjectURL(blob);
}

export async function transcribeAudio(params: {
  model: string;
  audioFile: File;
  provider?: string;
}): Promise<string> {
  const { key, base } = getProviderConfig(params.provider);
  const formData = new FormData();
  formData.append('model', params.model);
  formData.append('file', params.audioFile);

  const response = await fetch(`${base}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiMo ASR error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.text || '';
}
