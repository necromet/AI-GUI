import { Request } from 'express';

export interface ChatMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  max_tokens?: number;
  tools?: Array<{ type: string; max_keyword?: number; force_search?: boolean }>;
  thinking?: { type: 'enabled' | 'disabled' };
}

export function getProviderConfig(provider?: string): { key: string; base: string } {
  const apiKey = process.env.MIMO_API_KEY || '';
  const baseUrl = process.env.MIMO_BASE_URL || 'https://token-plan-sgp.xiaomimimo.com/v1';
  const directApiKey = process.env.MIMO_DIRECT_API_KEY || '';
  const directBaseUrl = process.env.MIMO_DIRECT_BASE_URL || 'https://api.xiaomimimo.com/v1';

  if (provider === 'mimo-direct') {
    return { key: directApiKey, base: directBaseUrl };
  }
  return { key: apiKey, base: baseUrl };
}

export function detectLanguage(text: string): string {
  const patterns: Record<string, RegExp> = {
    zh: /[\u4e00-\u9fff\u3400-\u4dbf]/,
    ja: /[\u3040-\u309f\u30a0-\u30ff\u31f0-\u31ff]/,
    ko: /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/,
    ar: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/,
    ru: /[\u0400-\u04ff]/,
    th: /[\u0e00-\u0e7f]/,
    hi: /[\u0900-\u097f]/,
    he: /[\u0590-\u05ff]/,
    el: /[\u0370-\u03ff]/,
    uk: /[\u0400-\u04ff]/,
    bn: /[\u0980-\u09ff]/,
    ta: /[\u0b80-\u0bff]/,
    te: /[\u0c00-\u0c7f]/,
    vi: /[\u00c0-\u024f\u1ea0-\u1ef9]/,
  };

  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) return lang;
  }

  return 'en';
}

export function buildLanguageInstruction(detectedLang: string): string {
  const langNames: Record<string, string> = {
    zh: 'Chinese (Simplified)',
    ja: 'Japanese',
    ko: 'Korean',
    ar: 'Arabic',
    ru: 'Russian',
    th: 'Thai',
    hi: 'Hindi',
    he: 'Hebrew',
    el: 'Greek',
    uk: 'Ukrainian',
    bn: 'Bengali',
    ta: 'Tamil',
    te: 'Telugu',
    vi: 'Vietnamese',
    en: 'English',
  };

  const langName = langNames[detectedLang] || 'English';
  return `You MUST respond in ${langName}. If you cannot generate a proper response in ${langName}, fall back to English.`;
}

export async function streamChatCompletion(
  body: ChatCompletionRequest,
  provider?: string,
): Promise<Response> {
  const { key, base } = getProviderConfig(provider);
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  return response;
}

export async function chatCompletion(
  body: ChatCompletionRequest,
  provider?: string,
): Promise<any> {
  const { key, base } = getProviderConfig(provider);
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
    throw new Error(`MiMo API error ${response.status}: ${errorText}`);
  }

  return response.json();
}
