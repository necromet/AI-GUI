export async function executeExtractNode(
  data: Record<string, any>,
  state: any,
  apiKeys: Record<string, string> = {}
): Promise<any> {
  const {
    extractConfig,
    extractTool = 'firecrawl',
    fields = [],
    schema,
  } = data;

  const firecrawlKey = apiKeys.firecrawl || (typeof process !== 'undefined' && process.env?.FIRECRAWL_API_KEY) || '';
  const variables = state.variables || {};
  const input = variables.lastOutput || variables.input;

  if (!firecrawlKey && extractTool === 'firecrawl') {
    return { error: 'No Firecrawl API key configured. Add one in Settings → API Keys.' };
  }

  if (schema || extractConfig?.schema) {
    try {
      const firecrawlBase = process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev/v1';
      const response = await fetch(`${firecrawlBase}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          urls: Array.isArray(input) ? input : [input],
          schema: schema || extractConfig?.schema,
        }),
      });
      const result = await response.json();
      return result.data || result;
    } catch (err: any) {
      return { error: `Extract failed: ${err.message}` };
    }
  }

  if (fields.length > 0 && typeof input === 'object' && input !== null) {
    const extracted: Record<string, any> = {};
    for (const field of fields) {
      if (typeof field === 'string') {
        extracted[field] = input[field];
      } else if (field.name) {
        extracted[field.name] = input[field.name] ?? field.default;
      }
    }
    return extracted;
  }

  if (fields.length > 0 && typeof input === 'string') {
    const extracted: Record<string, any> = {};
    for (const field of fields) {
      const name = typeof field === 'string' ? field : field.name;
      const pattern = typeof field === 'object' ? field.pattern : null;
      if (pattern) {
        const match = input.match(new RegExp(pattern, 'i'));
        extracted[name] = match ? match[1] || match[0] : (field.default || null);
      }
    }
    return extracted;
  }

  return { error: 'No extraction schema or fields configured' };
}
