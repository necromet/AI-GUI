import { substituteVariables } from './variables.js';

export async function executeMCPNode(
  data: Record<string, any>,
  state: any,
  apiKeys: Record<string, string> = {}
): Promise<any> {
  const {
    serverId,
    serverUrl,
    toolName,
    mcpAction,
    mcpServers = [],
    arguments: toolArgs = {},
    scrapeUrl,
    searchQuery,
    scrapeFormats = ['markdown'],
    mcpParams = {},
  } = data;

  const variables = state.variables || {};

  let url = serverUrl;
  let authToken: string | undefined;

  if (serverId && mcpServers.length > 0) {
    const server = mcpServers.find((s: any) => s.id === serverId);
    if (server) {
      url = server.url;
      authToken = server.accessToken;
    }
  }

  const isFirecrawl = url?.toLowerCase().includes('firecrawl') || toolName?.startsWith('firecrawl_');
  const firecrawlKey = apiKeys.firecrawl || (typeof process !== 'undefined' && process.env?.FIRECRAWL_API_KEY) || '';

  if (isFirecrawl && firecrawlKey) {
    return await executeFirecrawlAction(toolName || mcpAction || 'scrape', {
      url: scrapeUrl || variables.lastOutput || variables.input,
      query: searchQuery || variables.lastOutput,
      formats: scrapeFormats,
      ...mcpParams,
      ...interpolateArgs(toolArgs, variables),
    }, firecrawlKey);
  }

  if (url && toolName) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: interpolateArgs(toolArgs, variables),
          },
          id: Date.now(),
        }),
      });

      const data = await response.json();
      if (data.error) return { error: data.error.message || 'MCP call failed' };
      return data.result?.content?.[0]?.text || data.result || 'No output';
    } catch (err: any) {
      return { error: `MCP call failed: ${err.message}` };
    }
  }

  return { error: 'No MCP server or tool configured' };
}

async function executeFirecrawlAction(action: string, params: any, apiKey: string): Promise<any> {
  const baseUrl = 'https://api.firecrawl.dev/v1';

  try {
    if (action === 'scrape' || action === 'firecrawl_scrape') {
      const response = await fetch(`${baseUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url: params.url,
          formats: params.formats || ['markdown'],
        }),
      });
      const data = await response.json();
      return data.data || data;
    }

    if (action === 'search' || action === 'firecrawl_search') {
      const response = await fetch(`${baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: params.query,
          limit: params.limit || 5,
        }),
      });
      const data = await response.json();
      return data.data || data;
    }

    if (action === 'crawl' || action === 'firecrawl_crawl') {
      const response = await fetch(`${baseUrl}/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url: params.url,
          limit: params.limit || 10,
        }),
      });
      const data = await response.json();
      return data.data || data;
    }

    if (action === 'extract' || action === 'firecrawl_extract') {
      const response = await fetch(`${baseUrl}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          urls: params.urls || [params.url],
          schema: params.schema,
        }),
      });
      const data = await response.json();
      return data.data || data;
    }

    if (action === 'map' || action === 'firecrawl_map') {
      const response = await fetch(`${baseUrl}/map`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ url: params.url }),
      });
      const data = await response.json();
      return data.data || data;
    }

    return { error: `Unknown Firecrawl action: ${action}` };
  } catch (err: any) {
    return { error: `Firecrawl error: ${err.message}` };
  }
}

function interpolateArgs(args: Record<string, any>, variables: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(args)) {
    if (typeof val === 'string' && val.startsWith('{{') && val.endsWith('}}')) {
      const varName = val.slice(2, -2);
      result[key] = variables[varName] ?? val;
    } else {
      result[key] = val;
    }
  }
  return result;
}
