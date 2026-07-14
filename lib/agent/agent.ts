import { ToolLoopAgent, isStepCount } from 'ai';
import { createProvider } from './provider';
import { LIBRARY_TOOLS } from './tools/library';
import { LIBRARY_AGENT_SYSTEM_PROMPT } from './prompts/library';

export function createLibraryAgent(
  modelId: string,
  options?: { provider?: string; maxTokens?: number },
) {
  const providerInstance = createProvider(options?.provider);
  return new ToolLoopAgent({
    model: providerInstance(modelId),
    instructions: LIBRARY_AGENT_SYSTEM_PROMPT,
    tools: LIBRARY_TOOLS,
    stopWhen: isStepCount(10),
    allowSystemInMessages: true,
    maxOutputTokens: options?.maxTokens,
    toolApproval: {
      delete_component_file: 'user-approval',
    },
  });
}
