import { substituteVariables } from './variables.js';
import { callTool } from '../mcpService.js';

export async function executeMCPNode(
  data: Record<string, any>,
  state: any,
  apiKeys: Record<string, string> = {}
): Promise<any> {
  const {
    serverId,
    serverUrl,
    accessToken,
    headers: configuredHeaders = {},
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
  const resolvedScrapeUrl = typeof scrapeUrl === 'string' ? substituteVariables(scrapeUrl, state) : scrapeUrl;
  const resolvedSearchQuery = typeof searchQuery === 'string' ? substituteVariables(searchQuery, state) : searchQuery;

  let url = serverUrl;
  let authToken: string | undefined = accessToken;

  if (serverId && mcpServers.length > 0) {
    const server = mcpServers.find((s: any) => s.id === serverId);
    if (server) {
      url = server.url;
      authToken = server.accessToken;
    }
  }

  const action = toolName || mcpAction;
  const isFirecrawl = url?.toLowerCase().includes('firecrawl') || toolName?.startsWith('firecrawl_') || ['scrape', 'search', 'crawl', 'extract', 'map'].includes(action);
  const firecrawlKey = apiKeys.firecrawl || (typeof process !== 'undefined' && process.env?.FIRECRAWL_API_KEY) || '';

  if (isFirecrawl && !firecrawlKey) {
    return { error: 'Firecrawl is not configured. Add FIRECRAWL_API_KEY on the server or in Agent Builder settings.' };
  }

  if (isFirecrawl && firecrawlKey) {
    return await executeFirecrawlAction(action || 'scrape', {
      url: resolvedScrapeUrl || variables.lastOutput || variables.input,
      query: resolvedSearchQuery || variables.lastOutput,
      formats: scrapeFormats,
      ...mcpParams,
      ...interpolateArgs(toolArgs, variables),
    }, firecrawlKey);
  }

  if (url && toolName) {
    const headers: Record<string, string> = { ...configuredHeaders };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    return callTool(url, toolName, interpolateArgs(toolArgs, variables), headers);
  }

  return { error: 'No MCP server or tool configured' };
}

async function executeFirecrawlAction(action: string, params: any, apiKey: string): Promise<any> {
  const baseUrl = process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev/v1';

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
    if (typeof val === 'string') result[key] = substituteVariables(val, { variables });
    else if (Array.isArray(val)) result[key] = val.map(item => typeof item === 'string' ? substituteVariables(item, { variables }) : item);
    else if (val && typeof val === 'object') result[key] = interpolateArgs(val, variables);
    else result[key] = val;
  }
  return result;
}
