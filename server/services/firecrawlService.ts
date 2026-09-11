/**
 * Firecrawl Service - Web scraping and extraction
 * Wraps the Firecrawl REST API
 */

const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v1';

function getApiKey(overrideKey?: string): string {
  return overrideKey || process.env.FIRECRAWL_API_KEY || '';
}

export async function scrape(url: string, options?: { formats?: string[]; apiKey?: string }): Promise<any> {
  const apiKey = getApiKey(options?.apiKey);
  if (!apiKey) return { error: 'No Firecrawl API key configured' };

  const response = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: options?.formats || ['markdown'],
    }),
  });

  const data = await response.json();
  return data.data || data;
}

export async function search(query: string, options?: { limit?: number; apiKey?: string }): Promise<any> {
  const apiKey = getApiKey(options?.apiKey);
  if (!apiKey) return { error: 'No Firecrawl API key configured' };

  const response = await fetch(`${FIRECRAWL_BASE}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      limit: options?.limit || 5,
    }),
  });

  const data = await response.json();
  return data.data || data;
}

export async function crawl(url: string, options?: { limit?: number; apiKey?: string }): Promise<any> {
  const apiKey = getApiKey(options?.apiKey);
  if (!apiKey) return { error: 'No Firecrawl API key configured' };

  const response = await fetch(`${FIRECRAWL_BASE}/crawl`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      limit: options?.limit || 10,
    }),
  });

  const data = await response.json();
  return data.data || data;
}

export async function extract(urls: string[], schema?: Record<string, any>, options?: { apiKey?: string }): Promise<any> {
  const apiKey = getApiKey(options?.apiKey);
  if (!apiKey) return { error: 'No Firecrawl API key configured' };

  const response = await fetch(`${FIRECRAWL_BASE}/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      urls,
      schema,
    }),
  });

  const data = await response.json();
  return data.data || data;
}

export async function mapSite(url: string, options?: { apiKey?: string }): Promise<any> {
  const apiKey = getApiKey(options?.apiKey);
  if (!apiKey) return { error: 'No Firecrawl API key configured' };

  const response = await fetch(`${FIRECRAWL_BASE}/map`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ url }),
  });

  const data = await response.json();
  return data.data || data;
}
