import assert from 'node:assert/strict';
import test from 'node:test';
import { executeDbQuery } from '../../services/apiDatabaseAdapter.js';

test('database query forwards cancellation and omits the old force flag', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let requestBody: any;
  globalThis.fetch = (async (_url: string | URL | Request, options?: RequestInit) => {
    requestBody = JSON.parse(String(options?.body));
    assert.equal(options?.signal, controller.signal);
    return new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
  }) as typeof fetch;
  try {
    const request = executeDbQuery('connection', 'SELECT 1', 100, 5000, controller.signal);
    controller.abort();
    await assert.rejects(request, { name: 'AbortError' });
    assert.deepEqual(requestBody, { connectionId: 'connection', sql: 'SELECT 1', maxRows: 100, timeout: 5000 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
