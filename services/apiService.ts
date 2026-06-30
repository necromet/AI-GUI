import { Attachment } from '../types';

const API_BASE = '/api';

export interface ApiChatMessage {
  role: string;
  content: string;
  attachments?: Attachment[];
}

export interface StreamChunk {
  text: string;
  thinkingText?: string;
  annotations?: any[];
  usageMetadata?: any;
}

async function* parseSSEStream(response: Response, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  if (signal?.aborted) {
    reader.cancel();
    throw new DOMException('Aborted', 'AbortError');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let allAnnotations: any[] = [];

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
        const usageMetadata = parsed.usage;

        if (content || reasoning || usageMetadata) {
          yield {
            text: content || '',
            thinkingText: reasoning || undefined,
            usageMetadata: usageMetadata || undefined,
          };
        }
      } catch {
        // skip malformed lines
      }
    }
  }
}

export async function* generateResponseStream(
  modelId: string,
  prompt: string,
  history: { role: string; content: string; attachments?: Attachment[] }[],
  systemInstruction?: string,
  provider?: string,
  maxTokens?: number,
  signal?: AbortSignal,
  options?: { search?: boolean; think?: boolean },
): AsyncGenerator<StreamChunk> {
  const body = {
    model: modelId,
    messages: history,
    stream: true,
    max_tokens: maxTokens,
    systemInstruction,
    provider,
    search: options?.search,
    think: options?.think,
  };

  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = errorText;
    try {
      const parsed = JSON.parse(errorText);
      errorMsg = parsed.error || errorText;
    } catch {}
    throw new Error(`API error ${response.status}: ${errorMsg}`);
  }

  yield* parseSSEStream(response, signal);
}

export async function generateChatTitle(
  userMessage: string,
  assistantResponse: string,
  provider?: string,
): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/chat/title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMessage, assistantResponse, provider }),
    });

    if (!response.ok) throw new Error(`API error ${response.status}`);

    const data = await response.json();
    return data.title || userMessage.substring(0, 50);
  } catch (error) {
    console.error('Error generating chat title:', error);
    return userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');
  }
}

export async function generateSpeech(params: {
  model: string;
  text: string;
  voice?: string;
  style?: string;
  provider?: string;
}): Promise<string> {
  const response = await fetch(`${API_BASE}/chat/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const audioBase64 = data.audio;
  if (!audioBase64) throw new Error('No audio data in response');

  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/mp3' });
  return URL.createObjectURL(blob);
}

export async function transcribeAudio(params: {
  model: string;
  audioFile: File;
  provider?: string;
}): Promise<string> {
  const formData = new FormData();
  formData.append('model', params.model);
  formData.append('file', params.audioFile);
  formData.append('provider', params.provider || '');

  const response = await fetch(`${API_BASE}/chat/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ASR error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.text || '';
}

export const BUILT_IN_VOICES = [
  'mimo_default',
  'default_zh',
  'default_en',
  'Mia',
  'Chloe',
  'Milo',
  'Dean',
];
