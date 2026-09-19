/**
 * MCP Service - Model Context Protocol server management
 * Handles: tool discovery, connection testing, tool execution
 */

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  authType?: string;
  accessToken?: string;
  headers?: Record<string, string>;
}

interface MCPConnectionResult {
  success: boolean;
  tools?: MCPTool[];
  error?: string;
  latencyMs?: number;
}

// ─── Tool Discovery ───

export async function discoverTools(serverUrl: string, headers?: Record<string, string>): Promise<MCPTool[]> {
  try {
    const response = await mcpRequest(serverUrl, 'tools/list', {}, headers);
    if (response.error) {
      console.error(`[mcp] Tool discovery failed for ${serverUrl}:`, response.error);
      return [];
    }
    return (response.result?.tools || []).map((t: any) => ({
      name: t.name,
      description: t.description || '',
      inputSchema: t.inputSchema || { type: 'object', properties: {} },
    }));
  } catch (err: any) {
    console.error(`[mcp] Tool discovery error:`, err.message);
    return [];
  }
}

// ─── Tool Execution ───

export async function callTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, any>,
  headers?: Record<string, string>
): Promise<any> {
  try {
    const response = await mcpRequest(serverUrl, 'tools/call', {
      name: toolName,
      arguments: args,
    }, headers);

    if (response.error) {
      return { error: response.error.message || 'Tool call failed' };
    }

    const content = response.result?.content;
    if (Array.isArray(content) && content.length > 0) {
      const textBlock = content.find((c: any) => c.type === 'text');
      if (textBlock) return textBlock.text;

      return content[0].text || content[0].data || JSON.stringify(content[0]);
    }

    return response.result || 'No output';
  } catch (err: any) {
    return { error: `Tool call failed: ${err.message}` };
  }
}

// ─── Connection Testing ───

export async function testConnection(serverUrl: string, headers?: Record<string, string>): Promise<MCPConnectionResult> {
  const startTime = Date.now();
  try {
    const response = await mcpRequest(serverUrl, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'edward-labs', version: '1.0.0' },
    }, headers);

    const latencyMs = Date.now() - startTime;

    if (response.error) {
      return { success: false, error: response.error.message, latencyMs };
    }

    const tools = await discoverTools(serverUrl, headers);

    return {
      success: true,
      tools,
      latencyMs,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      latencyMs: Date.now() - startTime,
    };
  }
}

// ─── JSON-RPC Transport ───

async function mcpRequest(
  serverUrl: string,
  method: string,
  params: Record<string, any>,
  headers?: Record<string, string>
): Promise<any> {
  const requestId = Date.now();

  const body = {
    jsonrpc: '2.0',
    method,
    params,
    id: requestId,
  };

  const fetchHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...headers,
  };

  const response = await fetch(serverUrl, {
    method: 'POST',
    headers: fetchHeaders,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`MCP server returned ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

// ─── Firecrawl Tool Definitions ───

export function getFirecrawlToolDefinitions(): MCPTool[] {
  return [
    {
      name: 'firecrawl_scrape',
      description: 'Scrape a single URL and extract its content as markdown',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to scrape' },
          formats: { type: 'array', items: { type: 'string' }, default: ['markdown'] },
        },
        required: ['url'],
      },
    },
    {
      name: 'firecrawl_search',
      description: 'Search the web using Firecrawl',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Number of results', default: 5 },
        },
        required: ['query'],
      },
    },
    {
      name: 'firecrawl_crawl',
      description: 'Crawl a website and extract content from multiple pages',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The base URL to crawl' },
          limit: { type: 'number', description: 'Max pages to crawl', default: 10 },
        },
        required: ['url'],
      },
    },
    {
      name: 'firecrawl_extract',
      description: 'Extract structured data from URLs using an AI schema',
      inputSchema: {
        type: 'object',
        properties: {
          urls: { type: 'array', items: { type: 'string' }, description: 'URLs to extract from' },
          schema: { type: 'object', description: 'JSON schema for extraction' },
        },
        required: ['urls'],
      },
    },
    {
      name: 'firecrawl_map',
      description: 'Map a website to discover all its URLs',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to map' },
        },
        required: ['url'],
      },
    },
  ];
}

// ─── Built-in Tool Definitions ───

export function getBuiltinToolDefinitions(): MCPTool[] {
  return [
    {
      name: 'web_browse',
      description: 'Browse a web page and extract its content as markdown',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to browse' },
        },
        required: ['url'],
      },
    },
    {
      name: 'search_web',
      description: 'Search the web for information',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Number of results', default: 5 },
        },
        required: ['query'],
      },
    },
    {
      name: 'execute_code',
      description: 'Execute JavaScript code',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'JavaScript code to execute' },
        },
        required: ['code'],
      },
    },
  ];
}
