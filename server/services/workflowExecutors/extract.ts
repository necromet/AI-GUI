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
    extractModel,
  } = data;

  const variables = state.variables || {};
  const input = variables.lastOutput || variables.input;

  // LLM-based extraction when model is selected
  if (extractModel && schema) {
    return await extractWithLLM(extractModel, schema, input, apiKeys);
  }

  const firecrawlKey = apiKeys.firecrawl || (typeof process !== 'undefined' && process.env?.FIRECRAWL_API_KEY) || '';

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

function detectProvider(model: string): string {
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) return 'openai';
  if (model.startsWith('deepseek')) return 'deepseek';
  if (model.startsWith('gemini')) return 'google';
  if (model.startsWith('groq/') || model.includes('llama') || model.includes('mixtral')) return 'groq';
  return 'mimo';
}

async function extractWithLLM(
  model: string,
  schema: any,
  input: any,
  apiKeys: Record<string, string>
): Promise<any> {
  const provider = detectProvider(model);
  const apiKey = apiKeys[provider] || apiKeys.openai || '';

  if (!apiKey) {
    return { error: `No API key for provider '${provider}'. Add one in Settings → API Keys.` };
  }

  const inputStr = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
  const schemaStr = JSON.stringify(schema, null, 2);

  const systemPrompt = `You are a data extraction assistant. Extract structured data from the input according to the given JSON schema. Return ONLY valid JSON matching the schema, no explanations.`;
  const userPrompt = `Schema:\n${schemaStr}\n\nInput:\n${inputStr}`;

  try {
    let result: any;

    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 4096,
        }),
      });
      result = await response.json();
      const content = result.choices?.[0]?.message?.content;
      return JSON.parse(content);
    }

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
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      result = await response.json();
      const content = result.content?.[0]?.text;
      return JSON.parse(content);
    }

    // Fallback: OpenAI-compatible endpoint (deepseek, groq, mimo, etc.)
    const baseUrls: Record<string, string> = {
      deepseek: 'https://api.deepseek.com/v1',
      groq: 'https://api.groq.com/openai/v1',
      mimo: 'https://api.xiaomimimo.com/v1',
    };
    const baseUrl = baseUrls[provider] || 'https://api.openai.com/v1';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 4096,
      }),
    });
    result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    // Try to parse JSON from the response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[1] || jsonMatch[0] : content);
  } catch (err: any) {
    return { error: `LLM extraction failed: ${err.message}` };
  }
}
