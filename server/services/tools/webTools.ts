export async function toolWebBrowse(url: string): Promise<string> {
  if (!url) return 'Error: No URL provided';

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EdwardLabs/1.0)',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return `Error: HTTP ${response.status} ${response.statusText}`;
    }

    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 8000);

    return text || 'No readable content found';
  } catch (err: any) {
    return `Error fetching URL: ${err.message}`;
  }
}

export async function toolSearchWeb(query: string): Promise<string> {
  if (!query) return 'Error: No search query provided';

  try {
    const encoded = encodeURIComponent(query);
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EdwardLabs/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return `Search error: HTTP ${response.status}`;
    }

    const html = await response.text();
    const results: string[] = [];
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let count = 0;

    while ((match = resultRegex.exec(html)) !== null && count < 5) {
      const url = match[1];
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      if (title && url) {
        results.push(`${count + 1}. ${title}\n   ${url}`);
        count++;
      }
    }

    return results.length > 0
      ? `Search results for "${query}":\n\n${results.join('\n\n')}`
      : `No search results found for "${query}"`;
  } catch (err: any) {
    return `Search error: ${err.message}`;
  }
}
