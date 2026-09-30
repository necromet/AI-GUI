import type { HarnessTool, ToolContext, ToolResult } from '../types';
import { toolWebBrowse, toolSearchWeb } from '../../../services/tools/webTools';

function truncate(text: string, max = 15_000): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\n…[truncated]';
}

async function webfetchTool(args: Record<string, any>, _ctx: ToolContext): Promise<ToolResult> {
  const url = String(args.url || '');
  if (!url) return { output: '', error: 'url is required' };
  const text = await toolWebBrowse(url);
  if (text.startsWith('Error')) return { output: '', error: text };
  return { output: truncate(text) };
}

async function websearchTool(args: Record<string, any>, _ctx: ToolContext): Promise<ToolResult> {
  const query = String(args.query || '');
  if (!query) return { output: '', error: 'query is required' };
  const text = await toolSearchWeb(query);
  if (text.startsWith('Error') || text.startsWith('Search error')) return { output: '', error: text };
  return { output: truncate(text) };
}

export const webTools: HarnessTool[] = [
  {
    name: 'webfetch',
    description: 'Fetch a web page and extract readable text.',
    capability: 'web',
    modes: ['build', 'plan'],
    defaultAction: 'allow',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
    execute: webfetchTool,
  },
  {
    name: 'websearch',
    description: 'Search the web for information.',
    capability: 'web',
    modes: ['build', 'plan'],
    defaultAction: 'allow',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
    execute: websearchTool,
  },
];
