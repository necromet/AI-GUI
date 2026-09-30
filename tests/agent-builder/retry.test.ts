import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyOutputFailure,
  computeBackoffMs,
  isRetriableFailure,
  normalizeRetryPolicy,
} from '../../lib/workflow/retry.js';

test('normalizes retry policy defaults and clamps ranges', () => {
  assert.deepEqual(normalizeRetryPolicy(undefined), { maxAttempts: 1, backoffMs: 500, backoffMultiplier: 2 });
  assert.deepEqual(normalizeRetryPolicy({ maxAttempts: 99, backoffMs: -10, backoffMultiplier: 0 }), {
    maxAttempts: 5,
    backoffMs: 0,
    backoffMultiplier: 1,
  });
  assert.deepEqual(normalizeRetryPolicy({ maxAttempts: 3, backoffMs: 250, backoffMultiplier: 2 }), {
    maxAttempts: 3,
    backoffMs: 250,
    backoffMultiplier: 2,
  });
});

test('classifies retriable vs config failures', () => {
  assert.equal(isRetriableFailure('HTTP request failed: fetch failed'), true);
  assert.equal(isRetriableFailure('Fetch failed with status 503'), true);
  assert.equal(isRetriableFailure('rate limit exceeded'), true);
  assert.equal(isRetriableFailure('network timeout while connecting'), true);
  assert.equal(isRetriableFailure('No API key for provider'), false);
  assert.equal(isRetriableFailure('URL is empty or contains unresolved variables'), false);
  assert.equal(isRetriableFailure('Select a saved PostgreSQL connection.'), false);
  assert.equal(isRetriableFailure('Unsupported workflow node type'), false);
});

test('classifies soft HTTP failures and hard error outputs', () => {
  const soft = classifyOutputFailure({ ok: false, status: 503, data: 'down' });
  assert.equal(soft.failed, true);
  assert.equal(soft.retriable, true);
  assert.equal(soft.soft, true);

  const hard = classifyOutputFailure({ error: 'HTTP request failed: timeout' });
  assert.equal(hard.failed, true);
  assert.equal(hard.retriable, true);
  assert.equal(hard.soft, false);

  const config = classifyOutputFailure({ error: 'No MCP server or tool configured' });
  assert.equal(config.failed, true);
  assert.equal(config.retriable, false);

  const ok = classifyOutputFailure({ ok: true, status: 200, data: {} });
  assert.equal(ok.failed, false);

  const clientError = classifyOutputFailure({ ok: false, status: 404, data: {} });
  assert.equal(clientError.failed, false);
});

test('computes exponential backoff with a hard cap', () => {
  const policy = { maxAttempts: 5, backoffMs: 500, backoffMultiplier: 2 };
  assert.equal(computeBackoffMs(policy, 1), 500);
  assert.equal(computeBackoffMs(policy, 2), 1000);
  assert.equal(computeBackoffMs(policy, 3), 2000);
  assert.equal(computeBackoffMs({ maxAttempts: 5, backoffMs: 10_000, backoffMultiplier: 3 }, 4), 30_000);
});
