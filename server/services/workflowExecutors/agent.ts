import { substituteVariables } from './variables.js';

interface WorkflowState {
  variables: Record<string, any>;
  chatHistory: Array<{ role: string; content: string }>;
}

interface AgentResult {
  output: string;
  toolCalls?: Array<{ name: string; arguments: any; output?: any }>;
  chatHistoryUpdates?: Array<{ role: string; content: string }>;
  variableUpdates?: Record<string, any>;
  tokenUsage?: { prompt: number; completion: number };
}

const MAX_TOOL_ITERATIONS = 10;
const MAX_CHAT_HISTORY_MESSAGES = 20;

export async function executeAgentNode(
  nodeData: Record<string, any>,
  state: any,
  apiKeys: Record<string, string> = {}
): Promise<AgentResult> {
  const {
    model = 'mimo-v2.5',
    systemPrompt = '',
    userPrompt = '',
    instructions = '',
    maxTokens = 4096,
    temperature = 0.7,
    mcpTools = [],
    tools = [],
    outputFormat,
    jsonOutputSchema,
    includeChatHistory = false,
  } = nodeData;

  const variables = state.variables || {};

  const interpolatedSystem = substituteVariables(systemPrompt || instructions || '', state);
  const interpolatedUser = substituteVariables(userPrompt || '', state);

  const provider = detectProvider(model);
  const apiKey = apiKeys[provider] || apiKeys.anthropic || apiKeys.openai || apiKeys.groq || '';

  if (!apiKey) {
    return { output: `Error: No API key configured for provider '${provider}'. Add one in Settings → API Keys.` };
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (includeChatHistory && state.chatHistory?.length > 0) {
    messages.push(...state.chatHistory.slice(-20));
  }

  const contextParts: string[] = [];
  if (variables.lastOutput) {
    contextParts.push(`Previous output: ${typeof variables.lastOutput === 'string' ? variables.lastOutput : JSON.stringify(variables.lastOutput)}`);
  }

  const fullUserMessage = [interpolatedUser, ...contextParts].filter(Boolean).join('\n\n');
  if (fullUserMessage) {
    messages.push({ role: 'user', content: fullUserMessage });
  }

  const toolDefs = buildToolDefinitions(mcpTools, tools);

  const allToolCalls: Array<{ name: string; arguments: any; output?: any }> = [];
  const chatUpdates: Array<{ role: string; content: string }> = [];
  let finalOutput = '';
  let iterations = 0;
  let lastUsage: any;

  let currentMessages = [...messages];

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const response = await callLLM({
      provider,
      model,
      apiKey,
      system: interpolatedSystem,
      messages: currentMessages,
      maxTokens,
      temperature,
      tools: toolDefs.length > 0 ? toolDefs : undefined,
      responseFormat: outputFormat === 'json' ? { type: 'json_object' } : undefined,
    });

    if (response.error) {
      return { output: `Error: ${response.error}` };
    }

    finalOutput = response.text || '';
    lastUsage = response.usage;

    if (!response.toolCalls || response.toolCalls.length === 0) {
      chatUpdates.push({ role: 'user', content: fullUserMessage || '(no input)' });
      chatUpdates.push({ role: 'assistant', content: finalOutput });
      break;
    }

    chatUpdates.push({ role: 'user', content: fullUserMessage || '(no input)' });
    chatUpdates.push({ role: 'assistant', content: finalOutput || JSON.stringify(response.toolCalls) });

    for (const tc of response.toolCalls) {
      const toolResult = await executeToolCall(tc, mcpTools, state);
      allToolCalls.push({
        name: tc.name,
        arguments: tc.arguments,
        output: toolResult,
      });
      chatUpdates.push({
        role: 'user',
        content: `[Tool Result: ${tc.name}]\n${typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult)}`,
      });
    }

    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: finalOutput || '' },
      ...response.toolCalls.map((tc: any, i: number) => ({
        role: 'user',
        content: `[Tool Result: ${tc.name}]\n${JSON.stringify(allToolCalls[allToolCalls.length - response.toolCalls.length + i]?.output)}`,
      })),
    ];
  }

  if (outputFormat === 'json' && jsonOutputSchema) {
    try {
      const parsed = JSON.parse(finalOutput);
      finalOutput = JSON.stringify(parsed, null, 2);
    } catch {
      const jsonMatch = finalOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        finalOutput = jsonMatch[0];
      }
    }
  }

  return {
    output: finalOutput,
    toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
    chatHistoryUpdates: chatUpdates,
    variableUpdates: { [nodeData.nodeName || 'agent_output']: finalOutput },
    tokenUsage: lastUsage,
  };
}

function detectProvider(model: string): string {
  if (model.startsWith('mimo-') && model.includes('-direct')) return 'mimo-direct';
  if (model.startsWith('mimo-')) return 'mimo';
  if (model.startsWith('deepseek-')) return 'deepseek';
  if (model.startsWith('claude') || model.startsWith('anthropic')) return 'anthropic';
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) return 'openai';
  if (model.startsWith('groq') || model.startsWith('llama') || model.startsWith('mixtral')) return 'groq';
  if (model.startsWith('gemini')) return 'google';
  return 'mimo'; // default to mimo
}

function buildToolDefinitions(mcpTools: any[], toolIds: string[]): any[] {
  const defs: any[] = [];

  for (const tool of mcpTools || []) {
    defs.push({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: tool.inputSchema || tool.parameters || { type: 'object', properties: {} },
      },
    });
  }

  for (const toolId of toolIds || []) {
    if (toolId === 'web_browse') {
      defs.push({
        type: 'function',
        function: {
          name: 'web_browse',
          description: 'Browse a web page and extract its content as markdown',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'The URL to browse' },
            },
            required: ['url'],
          },
        },
      });
    } else if (toolId === 'execute_code') {
      defs.push({
        type: 'function',
        function: {
          name: 'execute_code',
          description: 'Execute JavaScript code in a sandboxed environment',
          parameters: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'JavaScript code to execute' },
            },
            required: ['code'],
          },
        },
      });
    } else if (toolId === 'search_web') {
      defs.push({
        type: 'function',
        function: {
          name: 'search_web',
          description: 'Search the web for information',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              limit: { type: 'number', description: 'Number of results', default: 5 },
            },
            required: ['query'],
          },
        },
      });
    }
  }

  return defs;
}

async function executeToolCall(toolCall: { name: string; arguments: any }, mcpTools: any[], state: any): Promise<any> {
  const { name, arguments: args } = toolCall;

  const mcpTool = mcpTools?.find((t: any) => t.name === name);
  if (mcpTool) {
    try {
      const response = await fetch('/api/workflows/execute-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName: name, arguments: args, serverUrl: mcpTool.serverUrl }),
      });
      const result = await response.json();
      return result.output || result.error || 'No output';
    } catch (err: any) {
      return `Error calling MCP tool: ${err.message}`;
    }
  }

  if (name === 'web_browse') {
    try {
      const response = await fetch('/api/workflows/execute-firecrawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scrape', url: args.url }),
      });
      const result = await response.json();
      return result.markdown || result.output || result.error || 'No content';
    } catch (err: any) {
      return `Error browsing: ${err.message}`;
    }
  }

  if (name === 'search_web') {
    try {
      const response = await fetch('/api/workflows/execute-firecrawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', query: args.query, limit: args.limit }),
      });
      const result = await response.json();
      return result.results || result.output || result.error || 'No results';
    } catch (err: any) {
      return `Error searching: ${err.message}`;
    }
  }

  if (name === 'execute_code') {
    try {
      const fn = new Function('state', 'variables', args.code);
      const result = fn(state, state.variables);
      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (err: any) {
      return `Code execution error: ${err.message}`;
    }
  }

  return `Unknown tool: ${name}`;
}

async function callLLM(config: {
  provider: string;
  model: string;
  apiKey: string;
  system: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens: number;
  temperature: number;
  tools?: any[];
  responseFormat?: any;
}): Promise<{ text: string; toolCalls?: any[]; error?: string; usage?: any }> {
  const { provider, model, apiKey, system, messages, maxTokens, temperature, tools, responseFormat } = config;

  try {
    if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: system || undefined,
          messages: messages.map(m => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })),
          tools: tools?.map(t => ({
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters,
          })),
        }),
      });
      const data = await response.json();
      if (data.error) return { text: '', error: data.error.message };

      const textBlock = data.content?.find((b: any) => b.type === 'text');
      const toolBlocks = data.content?.filter((b: any) => b.type === 'tool_use') || [];

      return {
        text: textBlock?.text || '',
        toolCalls: toolBlocks.length > 0 ? toolBlocks.map((b: any) => ({
          name: b.name,
          arguments: b.input,
        })) : undefined,
        usage: data.usage,
      };
    }

    // MiMo provider (via proxy or direct)
    if (provider === 'mimo' || provider === 'mimo-direct') {
      const baseUrl = provider === 'mimo-direct'
        ? (process.env.MIMO_DIRECT_BASE_URL || 'https://api.xiaomimimo.com/v1')
        : (process.env.MIMO_BASE_URL || 'https://token-plan-sgp.xiaomimimo.com/v1');
      
      const body: any = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          ...messages,
        ],
      };
      if (tools?.length) body.tools = tools;
      if (responseFormat) body.response_format = responseFormat;

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.error) return { text: '', error: data.error.message };

      const choice = data.choices?.[0];
      const toolCalls = choice?.message?.tool_calls?.map((tc: any) => ({
        name: tc.function.name,
        arguments: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments,
      }));

      return {
        text: choice?.message?.content || '',
        toolCalls: toolCalls?.length ? toolCalls : undefined,
        usage: data.usage,
      };
    }

    // DeepSeek provider (OpenAI-compatible)
    if (provider === 'deepseek') {
      const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
      
      const body: any = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          ...messages,
        ],
      };
      if (tools?.length) body.tools = tools;
      if (responseFormat) body.response_format = responseFormat;

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.error) return { text: '', error: data.error.message };

      const choice = data.choices?.[0];
      const toolCalls = choice?.message?.tool_calls?.map((tc: any) => ({
        name: tc.function.name,
        arguments: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments,
      }));

      return {
        text: choice?.message?.content || '',
        toolCalls: toolCalls?.length ? toolCalls : undefined,
        usage: data.usage,
      };
    }

    // OpenAI-compatible fallback
    let baseUrl = 'https://api.openai.com/v1';
    if (provider === 'groq') baseUrl = 'https://api.groq.com/openai/v1';
    if (provider === 'google') baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';

    const body: any = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages,
      ],
    };
    if (tools?.length) body.tools = tools;
    if (responseFormat) body.response_format = responseFormat;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (data.error) return { text: '', error: data.error.message };

    const choice = data.choices?.[0];
    const toolCalls = choice?.message?.tool_calls?.map((tc: any) => ({
      name: tc.function.name,
      arguments: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments,
    }));

    return {
      text: choice?.message?.content || '',
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      usage: data.usage,
    };
  } catch (err: any) {
    return { text: '', error: err.message };
  }
}
