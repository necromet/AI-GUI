import { substituteVariables } from './variables.js';

interface ExecutorContext {
  executionId?: string;
  threadId?: string;
  llmKeys?: Record<string, string>;
}

export async function executeWebSourceNode(
  data: Record<string, any>,
  state: any,
  context: ExecutorContext = {}
): Promise<any> {
  const fetchMode = data.fetchMode || 'fetch-url';

  switch (fetchMode) {
    case 'fetch-url':
      return fetchUrl(data, state);
    case 'search-web':
      return searchWeb(data, state, context);
    default:
      return { error: `Unknown web source mode: ${fetchMode}` };
  }
}

async function fetchUrl(data: Record<string, any>, state: any): Promise<any> {
  const rawUrl = data.url || '';
  const extractMode = data.extractMode || 'text';
  const maxContentLength = data.maxContentLength || 5000;
  const timeout = data.timeout || 15000;

  const url = substituteVariables(rawUrl, state);
  if (!url || url === rawUrl && rawUrl.includes('{{')) {
    return { error: 'URL is empty or contains unresolved variables' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EdwardLabs/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { error: `Fetch failed with status ${response.status}`, url, status: response.status };
    }

    const contentType = response.headers.get('content-type') || '';
    const rawBody = await response.text();

    let content: string;
    if (extractMode === 'html') {
      content = rawBody;
    } else if (extractMode === 'markdown') {
      content = htmlToMarkdown(rawBody);
    } else {
      content = htmlToText(rawBody);
    }

    if (content.length > maxContentLength) {
      content = content.slice(0, maxContentLength) + '\n\n[Content truncated...]';
    }

    return {
      content,
      url,
      contentType,
      status: response.status,
      length: content.length,
    };
  } catch (err: any) {
    return { error: `Web fetch failed: ${err.message}`, url };
  }
}

async function searchWeb(data: Record<string, any>, state: any, context: ExecutorContext): Promise<any> {
  const rawQuery = data.searchQuery || '';
  const maxResults = data.maxResults || 5;

  const query = substituteVariables(rawQuery, state);
  if (!query || query === rawQuery && rawQuery.includes('{{')) {
    return { error: 'Search query is empty or contains unresolved variables' };
  }

  const firecrawlKey = context.llmKeys?.firecrawl
    || (typeof process !== 'undefined' && process.env?.FIRECRAWL_API_KEY)
    || '';

  if (!firecrawlKey) {
    return { error: 'Web search requires Firecrawl. Add FIRECRAWL_API_KEY on the server or in Agent Builder settings.' };
  }

  const baseUrl = process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev/v1';

  try {
    const response = await fetch(`${baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${firecrawlKey}`,
      },
      body: JSON.stringify({
        query,
        limit: maxResults,
      }),
    });

    const result = await response.json();
    const results = result.data || result;

    const content = Array.isArray(results)
      ? results.map((r: any, i: number) => `[${i + 1}] ${r.title || ''}\n${r.url || ''}\n${r.description || r.snippet || ''}`).join('\n\n')
      : JSON.stringify(results, null, 2);

    return {
      content,
      results: Array.isArray(results) ? results : [],
      count: Array.isArray(results) ? results.length : 0,
    };
  } catch (err: any) {
    return { error: `Web search failed: ${err.message}` };
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function htmlToMarkdown(html: string): string {
  let md = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Headers
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n');
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');

  // Bold / italic
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');

  // Code blocks
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Links and images
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // Lists
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<\/(ul|ol)>/gi, '\n');

  // Blockquotes and horizontal rules
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n> $1\n');
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Paragraphs and line breaks
  md = md.replace(/<\/(p|div|tr)>/gi, '\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, '');

  // HTML entities
  md = md.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

  // Normalize whitespace
  md = md.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
  return md;
}
