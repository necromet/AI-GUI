import Arcade from '@arcadeai/arcadejs';
import { substituteVariables } from './variables.js';

export async function executeArcadeNode(
  data: Record<string, any>,
  state: any,
  apiKeys: Record<string, string> = {},
): Promise<any> {
  const arcadeTool = data.arcadeTool;
  const arcadeUserId = substituteVariables(data.arcadeUserId || 'workflow-builder', state);
  const configuredInput = data.arcadeInput || data.arcadeParams || {};

  if (!arcadeTool) throw new Error('Arcade tool is not configured');
  if (!apiKeys.arcade) throw new Error('Arcade is not configured. Add ARCADE_API_KEY on the server.');

  const input: Record<string, any> = {};
  for (const [key, value] of Object.entries(configuredInput)) {
    input[key] = typeof value === 'string' ? substituteVariables(value, state) : value;
  }

  const client = new Arcade({ apiKey: apiKeys.arcade });
  const authorization = await client.tools.authorize({ tool_name: arcadeTool, user_id: arcadeUserId });
  if (!authorization?.id || authorization.status === 'failed') {
    throw new Error(`Arcade authorization failed for ${arcadeTool}`);
  }

  if (authorization.status !== 'completed') {
    return {
      __arcadePendingAuth: true,
      authUrl: authorization.url,
      authId: authorization.id,
      toolName: arcadeTool,
      userId: arcadeUserId,
      message: `Authorization required for ${arcadeTool}`,
    };
  }

  const result = await client.tools.execute({ tool_name: arcadeTool, input, user_id: arcadeUserId });
  return {
    result: result.output?.value ?? result.output ?? result,
    toolUsed: arcadeTool,
    userId: arcadeUserId,
  };
}
