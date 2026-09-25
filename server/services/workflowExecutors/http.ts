import { substituteVariables } from './variables.js';

export async function executeHTTPNode(
  data: Record<string, any>,
  state: any
): Promise<any> {
  const {
    method = 'GET',
    url: rawUrl = '',
    headers: rawHeaders = {},
    body: rawBody,
    timeout = 30000,
    responseType = 'json',
  } = data;

  const variables = state.variables || {};
  const url = substituteVariables(rawUrl, state);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawHeaders)) {
    headers[substituteVariables(k, state)] = substituteVariables(v as string, state);
  }

  // Apply auth headers
  const authType = data.authType || 'none';
  if (authType === 'bearer' && data.authToken) {
    headers['Authorization'] = `Bearer ${substituteVariables(data.authToken, state)}`;
  } else if (authType === 'api-key' && data.apiKey) {
    const headerName = data.apiKeyHeader || 'X-API-Key';
    headers[headerName] = substituteVariables(data.apiKey, state);
  } else if (authType === 'basic' && data.basicUser) {
    const creds = Buffer.from(`${substituteVariables(data.basicUser, state)}:${substituteVariables(data.basicPassword || '', state)}`).toString('base64');
    headers['Authorization'] = `Basic ${creds}`;
  }

  let body: string | undefined;
  if (rawBody && method !== 'GET') {
    body = typeof rawBody === 'string' ? substituteVariables(rawBody, state) : JSON.stringify(rawBody);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const status = response.status;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => { responseHeaders[k] = v; });

    let responseData: any;
    if (responseType === 'json') {
      try { responseData = await response.json(); } catch { responseData = await response.text(); }
    } else if (responseType === 'text') {
      responseData = await response.text();
    } else {
      responseData = await response.arrayBuffer();
    }

    return {
      status,
      headers: responseHeaders,
      data: responseData,
      ok: response.ok,
    };
  } catch (err: any) {
    return {
      error: `HTTP request failed: ${err.message}`,
      url,
      method,
    };
  }
}
