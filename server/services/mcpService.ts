/**
 * MCP Service - Model Context Protocol server management
 * Handles: tool discovery, connection testing, tool execution
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

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
  let transport: StreamableHTTPClientTransport | null = null;
  try {
    const connected = await connectClient(serverUrl, headers);
    transport = connected.transport;
    const response = await connected.client.listTools();
    return (response.tools || []).map((t: any) => ({
      name: t.name,
      description: t.description || '',
      inputSchema: t.inputSchema || { type: 'object', properties: {} },
    }));
  } catch (err: any) {
    console.error(`[mcp] Tool discovery error:`, err.message);
    return [];
  } finally {
    await transport?.close().catch(() => {});
  }
}

// ─── Tool Execution ───

export async function callTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, any>,
  headers?: Record<string, string>
): Promise<any> {
  let transport: StreamableHTTPClientTransport | null = null;
  try {
    const connected = await connectClient(serverUrl, headers);
    transport = connected.transport;
    const response: any = await connected.client.callTool({
      name: toolName,
      arguments: args,
    });

    const content = response.content;
    if (Array.isArray(content) && content.length > 0) {
      const textBlock = content.find((c: any) => c.type === 'text');
      if (textBlock) return textBlock.text;

      return content[0].text || content[0].data || JSON.stringify(content[0]);
    }

    return response.structuredContent || response.content || 'No output';
  } catch (err: any) {
    return { error: `Tool call failed: ${err.message}` };
  } finally {
    await transport?.close().catch(() => {});
  }
}

// ─── Connection Testing ───

export async function testConnection(serverUrl: string, headers?: Record<string, string>): Promise<MCPConnectionResult> {
  const startTime = Date.now();
  try {
    const tools = await discoverTools(serverUrl, headers);

    return {
      success: true,
      tools,
      latencyMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      latencyMs: Date.now() - startTime,
    };
  }
}

async function connectClient(serverUrl: string, headers?: Record<string, string>) {
  const client = new Client({ name: 'edward-labs-agent-builder', version: '1.0.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
    requestInit: {
      headers: { ...headers },
      signal: AbortSignal.timeout(30000),
    },
  });
  await client.connect(transport);
  return { client, transport };
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
