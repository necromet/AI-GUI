import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { substituteVariables } from './variables.js';

export async function executeAgentNode(
  data: Record<string, any>,
  state: any,
  llmKeys: Record<string, string>
) {
  const { model, systemPrompt, userPrompt, maxTokens, temperature } = data;

  const resolvedPrompt = substituteVariables(systemPrompt || '', state);
  const resolvedUser = substituteVariables(userPrompt || '', state);

  const provider = detectProvider(model);

  if (provider === 'anthropic') {
    return executeAnthropic(model, resolvedPrompt, resolvedUser, llmKeys, data);
  } else {
    return executeOpenAI(model, resolvedPrompt, resolvedUser, llmKeys, data);
  }
}

function detectProvider(model: string): 'anthropic' | 'openai' | 'groq' {
  if (model?.startsWith('claude')) return 'anthropic';
  if (model?.startsWith('gpt') || model?.startsWith('o1') || model?.startsWith('o3')) return 'openai';
  return 'openai';
}

async function executeAnthropic(model: string, system: string, user: string, keys: any, data: any) {
  const client = new Anthropic({ apiKey: keys.anthropic || process.env.ANTHROPIC_API_KEY });

  const messages: Anthropic.MessageCreateParams['messages'] = [
    { role: 'user', content: user },
  ];

  const response = await client.messages.create({
    model: model || 'claude-sonnet-4-20250514',
    max_tokens: data.maxTokens || 4096,
    system,
    messages,
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return {
    response: textBlock?.text || '',
    usage: response.usage,
    model: response.model,
  };
}

async function executeOpenAI(model: string, system: string, user: string, keys: any, data: any) {
  const client = new OpenAI({ apiKey: keys.openai || process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: model || 'gpt-4o',
    max_tokens: data.maxTokens || 4096,
    temperature: data.temperature ?? 0.7,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  return {
    response: response.choices[0]?.message?.content || '',
    usage: response.usage,
    model: response.model,
  };
}
