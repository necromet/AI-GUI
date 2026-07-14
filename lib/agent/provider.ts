import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export function createProvider(provider?: string) {
  const apiKey = process.env.MIMO_API_KEY || '';
  const baseUrl = process.env.MIMO_BASE_URL || 'https://token-plan-sgp.xiaomimimo.com/v1';
  const directApiKey = process.env.MIMO_DIRECT_API_KEY || '';
  const directBaseUrl = process.env.MIMO_DIRECT_BASE_URL || 'https://api.xiaomimimo.com/v1';
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY || '';
  const deepseekBaseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

  if (provider === 'mimo-direct') {
    return createOpenAICompatible({ name: 'mimo-direct', apiKey: directApiKey, baseURL: directBaseUrl });
  }
  if (provider === 'deepseek') {
    return createOpenAICompatible({ name: 'deepseek', apiKey: deepseekApiKey, baseURL: deepseekBaseUrl });
  }
  return createOpenAICompatible({ name: 'mimo', apiKey, baseURL: baseUrl });
}
