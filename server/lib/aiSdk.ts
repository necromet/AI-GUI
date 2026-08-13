import { type CoreMessage } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { getProviderConfig } from '../services/mimoService';

export function createProvider(providerName?: string) {
  const config = getProviderConfig(providerName);
  return createOpenAICompatible({
    apiKey: config.key,
    baseURL: config.base,
  });
}

export function convertToCoreMessages(messages: any[]): CoreMessage[] {
  const result: CoreMessage[] = [];

  for (const msg of messages) {
    const role = msg.role === 'model' ? 'assistant' : msg.role;

    if (role === 'user') {
      result.push({ role: 'user', content: msg.content || '' });
    } else if (role === 'assistant') {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const parts: any[] = [];
        if (msg.content) {
          parts.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.tool_calls) {
          let input: any;
          try {
            input = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
          } catch {
            input = {};
          }
          parts.push({
            type: 'tool-call',
            toolCallId: tc.id || `tc_${Math.random().toString(36).slice(2)}`,
            toolName: tc.function.name,
            input,
          });
        }
        result.push({ role: 'assistant', content: parts } as any);
      } else {
        result.push({ role: 'assistant', content: msg.content || '' });
      }
    } else if (role === 'tool') {
      result.push({
        role: 'tool',
        content: [{
          type: 'tool-result',
          toolCallId: msg.tool_call_id || '',
          toolName: msg.tool_name || msg.name || '',
          output: { type: 'text', value: msg.content || '' },
        }],
      } as any);
    }
  }

  return result;
}
