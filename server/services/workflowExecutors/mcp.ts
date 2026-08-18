import { substituteVariables } from './variables.js';

export async function executeMCPNode(
  data: Record<string, any>,
  state: any,
  _llmKeys: Record<string, string>
) {
  const { serverId, toolName, arguments: toolArgs } = data;

  if (!serverId || !toolName) {
    throw new Error('MCP node requires serverId and toolName');
  }

  const resolvedArgs: Record<string, any> = {};
  if (toolArgs && typeof toolArgs === 'object') {
    for (const [key, value] of Object.entries(toolArgs)) {
      if (typeof value === 'string') {
        resolvedArgs[key] = substituteVariables(value, state);
      } else {
        resolvedArgs[key] = value;
      }
    }
  }

  return {
    serverId,
    toolName,
    arguments: resolvedArgs,
    message: `MCP tool "${toolName}" called on server ${serverId}`,
    __mcpCall: true,
  };
}
