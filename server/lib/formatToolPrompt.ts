/**
 * Shared tool definition interface used by the prompt formatter.
 */
export interface PromptToolDef {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string }>;
}

/**
 * Format a list of tool definitions into a prompt-friendly string.
 *
 * Output format per tool:
 *   ### tool_name
 *   Description text
 *   Parameters:
 *     - param (type): description
 */
export function formatToolList(tools: PromptToolDef[]): string {
  return tools.map(t => {
    const params = Object.entries(t.parameters)
      .map(([name, p]) => `  - ${name} (${p.type}): ${p.description}`)
      .join('\n');
    return `### ${t.name}\n${t.description}${params ? '\nParameters:\n' + params : ''}`;
  }).join('\n\n');
}

/**
 * Build a complete tool-calling system prompt from a list of tool definitions.
 * Includes the tool call format instructions and the formatted tool list.
 */
export function buildToolPrompt(tools: PromptToolDef[], options?: {
  /** Extra instructions before the tool list */
  prefix?: string;
  /** Extra instructions after the tool list */
  suffix?: string;
  /** Whether to include the "announce intent" instruction (default: false) */
  announceIntent?: boolean;
}): string {
  if (tools.length === 0) return '';

  const toolDescriptions = formatToolList(tools);

  const parts: string[] = [];

  parts.push(`You have access to the following tools. To use a tool, respond with a JSON block in this exact format:

\`\`\`tool
{"name": "tool_name", "arguments": {"param": "value"}}
\`\`\`

You can use multiple tools in sequence. After using a tool, you will receive the result and can continue reasoning or provide a final answer.`);

  if (options?.announceIntent) {
    parts.push('Before EVERY tool call, output a short sentence describing what you are about to do and why.');
  }

  if (options?.prefix) parts.push(options.prefix);

  parts.push(`Available tools:\n${toolDescriptions}`);

  if (options?.suffix) parts.push(options.suffix);

  parts.push('Important: Only use tools when necessary. When you have enough information, provide a clear final answer without using more tools.');

  return parts.join('\n\n');
}
