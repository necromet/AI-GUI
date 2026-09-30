import test from 'node:test';
import assert from 'node:assert/strict';
import { canExecutePublishedWorkflow } from '../../lib/workflow/auth.js';
import { requireModeAuth } from '../../server/middleware/auth.js';

test('published execution accepts only the matching bearer key', () => {
  const workflow = { published: true, api_key: 'sk_wf_secret' };
  assert.equal(canExecutePublishedWorkflow('Bearer sk_wf_secret', workflow), true);
  assert.equal(canExecutePublishedWorkflow('Bearer wrong', workflow), false);
});

test('unpublished workflows reject bearer execution', () => {
  assert.equal(canExecutePublishedWorkflow('Bearer sk_wf_secret', { published: false, api_key: 'sk_wf_secret' }), false);
});

test('Agent Builder unlock grants only the Database and RAG resources used by its node editor', () => {
  const statusFor = (method: string, path: string, modes: string[]) => {
    let status = 200;
    const request = { method, originalUrl: path, headers: {}, session: { unlockedModes: modes } } as any;
    const response = { status(code: number) { status = code; return this; }, json() { return this; } } as any;
    requireModeAuth(request, response, (() => {}) as any);
    return status;
  };
  const agentOnly = ['agent-builder'];
  assert.equal(statusFor('GET', '/api/database/connections', agentOnly), 200);
  assert.equal(statusFor('GET', '/api/rag/documents', agentOnly), 200);
  assert.equal(statusFor('POST', '/api/database/test', agentOnly), 200);
  assert.equal(statusFor('POST', '/api/database/connections', agentOnly), 200);
  assert.equal(statusFor('POST', '/api/database/connections/connection-id/ping', agentOnly), 200);
  assert.equal(statusFor('POST', '/api/database/query', agentOnly), 401);
  assert.equal(statusFor('GET', '/api/database/schema', agentOnly), 401);
  assert.equal(statusFor('GET', '/api/database/connections', []), 401);
  assert.equal(statusFor('GET', '/api/rag/documents', []), 401);
});

test('published workflow validation reaches bearer-key verification', () => {
  let nextCalled = false;
  const request = { method: 'POST', originalUrl: '/api/workflows/wf_123/validate', headers: { authorization: 'Bearer candidate' }, session: { unlockedModes: [] } } as any;
  const response = { status() { throw new Error('Middleware should defer bearer verification to the route'); } } as any;
  requireModeAuth(request, response, (() => { nextCalled = true; }) as any);
  assert.equal(nextCalled, true);
});
