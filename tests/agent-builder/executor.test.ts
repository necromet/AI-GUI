import test from 'node:test';
import assert from 'node:assert/strict';
import { MemorySaver } from '@langchain/langgraph';
import { WorkflowExecutor, toMermaid } from '../../server/services/workflowExecutor.js';

const node = (id: string, type: string, data: Record<string, any> = {}) => ({
  id,
  type: type as any,
  position: { x: 0, y: 0 },
  data: { nodeType: type, label: id, ...data },
});

async function collect(stream: AsyncGenerator<any>) {
  const events: any[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

test('streams a simple workflow to completion', async () => {
  const executor = new WorkflowExecutor(
    [node('start', 'start'), node('end', 'end')],
    [{ id: 'edge', source: 'start', target: 'end' }],
    { executionId: 'exec_linear', threadId: 'thread_linear', checkpointer: new MemorySaver() },
  );
  const events = await collect(executor.executeStream({ message: 'hello' }));
  assert.equal(events.at(-1)?.type, 'workflow_completed');
  assert.equal(events.at(-1)?.state?.nodeResults?.end?.status, 'completed');
});

test('pauses and resumes an approval node on the same checkpoint thread', async () => {
  const checkpointer = new MemorySaver();
  const executor = new WorkflowExecutor(
    [node('start', 'start'), node('approval', 'user-approval', { message: 'Ship it?' }), node('end', 'end')],
    [
      { id: 'a', source: 'start', target: 'approval' },
      { id: 'b', source: 'approval', sourceHandle: 'approve', target: 'end' },
      { id: 'c', source: 'approval', sourceHandle: 'reject', target: 'end' },
    ],
    { executionId: 'exec_approval', threadId: 'thread_approval', checkpointer },
  );
  const first = await collect(executor.executeStream({ value: 1 }));
  assert.equal(first.at(-1)?.type, 'workflow_paused');
  assert.equal(first.at(-1)?.pendingAction?.nodeId, 'approval');

  const resumed = await collect(executor.executeStream({}, { resume: { approved: true } }));
  assert.equal(resumed.at(-1)?.type, 'workflow_completed');
  assert.equal(resumed.at(-1)?.state?.nodeResults?.approval?.output?.approved, true);
});

test('routes a simple condition through an explicit branch edge', async () => {
  const executor = new WorkflowExecutor(
    [
      node('start', 'start'),
      node('condition', 'if-else', { conditionMode: 'simple', conditionRule: { left: 'input.score', op: 'gte', right: '8' } }),
      node('truthy', 'end'),
      node('falsy', 'end'),
    ],
    [
      { id: 'a', source: 'start', target: 'condition' },
      { id: 'b', source: 'condition', sourceHandle: 'if', target: 'truthy' },
      { id: 'c', source: 'condition', sourceHandle: 'else', target: 'falsy' },
    ],
    { executionId: 'exec_simple_condition', threadId: 'thread_simple_condition', checkpointer: new MemorySaver() },
  );
  const events = await collect(executor.executeStream({ score: 8 }));
  const state = events.at(-1)?.state;
  assert.equal(state?.nodeResults?.condition?.output?.branch, 'if');
  assert.equal(state?.nodeResults?.truthy?.status, 'completed');
  assert.equal(state?.nodeResults?.falsy, undefined);
});

test('routes legacy expressions and string destinations, and allows an unconnected branch to terminate', async () => {
  const legacy = new WorkflowExecutor(
    [node('start', 'start'), node('condition', 'if-else', { condition: 'input.score > 5', truePath: 'done' }), node('done', 'end')],
    [{ id: 'a', source: 'start', target: 'condition' }],
    { executionId: 'exec_path_condition', threadId: 'thread_path_condition', checkpointer: new MemorySaver() },
  );
  const trueEvents = await collect(legacy.executeStream({ score: 9 }));
  assert.equal(trueEvents.at(-1)?.state?.nodeResults?.condition?.output?.conditionSource, 'expression');
  assert.equal(trueEvents.at(-1)?.state?.nodeResults?.done?.status, 'completed');

  const falseEvents = await collect(new WorkflowExecutor(
    [node('start', 'start'), node('condition', 'if-else', { condition: 'false' }), node('done', 'end')],
    [
      { id: 'a', source: 'start', target: 'condition' },
      { id: 'b', source: 'condition', sourceHandle: 'if', target: 'done' },
    ],
    { executionId: 'exec_terminal_condition', threadId: 'thread_terminal_condition', checkpointer: new MemorySaver() },
  ).executeStream({}));
  assert.equal(falseEvents.at(-1)?.type, 'workflow_completed');
  assert.equal(falseEvents.at(-1)?.state?.nodeResults?.condition?.output?.branch, 'else');
});

test('for-each loops over each item and collects body results', async () => {
  const executor = new WorkflowExecutor(
    [
      node('start', 'start'),
      node('each', 'for-each', { items: 'input.items', itemVar: 'item', indexVar: 'index', maxItems: 100 }),
      node('body', 'transform', { code: 'return { value: variables.item, i: variables.index };' }),
      node('end', 'end'),
    ],
    [
      { id: 'a', source: 'start', target: 'each' },
      { id: 'b', source: 'each', sourceHandle: 'continue', target: 'body' },
      { id: 'c', source: 'body', target: 'each' },
      { id: 'd', source: 'each', sourceHandle: 'break', target: 'end' },
    ],
    { executionId: 'exec_foreach', threadId: 'thread_foreach', checkpointer: new MemorySaver() },
  );
  const events = await collect(executor.executeStream({ items: ['a', 'b', 'c'] }));
  const state = events.at(-1)?.state;
  assert.equal(events.at(-1)?.type, 'workflow_completed');
  const output = state?.nodeResults?.each?.output;
  assert.equal(output?.shouldContinue, false);
  assert.equal(output?.processed, 3);
  assert.deepEqual(output?.results, [
    { value: 'a', i: 0 },
    { value: 'b', i: 1 },
    { value: 'c', i: 2 },
  ]);
});

test('for-each finishes immediately on empty lists and respects maxItems', async () => {
  const empty = await collect(new WorkflowExecutor(
    [
      node('start', 'start'),
      node('each', 'for-each', { items: 'input.items' }),
      node('body', 'transform', { code: 'return { value: variables.item };' }),
      node('end', 'end'),
    ],
    [
      { id: 'a', source: 'start', target: 'each' },
      { id: 'b', source: 'each', sourceHandle: 'continue', target: 'body' },
      { id: 'c', source: 'body', target: 'each' },
      { id: 'd', source: 'each', sourceHandle: 'break', target: 'end' },
    ],
    { executionId: 'exec_foreach_empty', threadId: 'thread_foreach_empty', checkpointer: new MemorySaver() },
  ).executeStream({ items: [] }));
  assert.equal(empty.at(-1)?.type, 'workflow_completed');
  assert.equal(empty.at(-1)?.state?.nodeResults?.each?.output?.stoppedReason, 'empty');
  assert.equal(empty.at(-1)?.state?.nodeResults?.body, undefined);

  const capped = await collect(new WorkflowExecutor(
    [
      node('start', 'start'),
      node('each', 'for-each', { items: 'input.items', maxItems: 2 }),
      node('body', 'transform', { code: 'return { value: variables.item };' }),
      node('end', 'end'),
    ],
    [
      { id: 'a', source: 'start', target: 'each' },
      { id: 'b', source: 'each', sourceHandle: 'continue', target: 'body' },
      { id: 'c', source: 'body', target: 'each' },
      { id: 'd', source: 'each', sourceHandle: 'break', target: 'end' },
    ],
    { executionId: 'exec_foreach_cap', threadId: 'thread_foreach_cap', checkpointer: new MemorySaver() },
  ).executeStream({ items: ['a', 'b', 'c', 'd'] }));
  const cappedOutput = capped.at(-1)?.state?.nodeResults?.each?.output;
  assert.equal(cappedOutput?.stoppedReason, 'max_items');
  assert.equal(cappedOutput?.processed, 2);
});

test('retries retriable failures up to maxAttempts then fails', async () => {
  const updates: Array<{ nodeId: string; status: string; attempts?: number }> = [];
  const executor = new WorkflowExecutor(
    [
      node('start', 'start'),
      node('flaky', 'transform', {
        code: 'return { error: "HTTP request failed: network timeout" };',
        retry: { maxAttempts: 3, backoffMs: 0, backoffMultiplier: 1 },
      }),
      node('end', 'end'),
    ],
    [
      { id: 'a', source: 'start', target: 'flaky' },
      { id: 'b', source: 'flaky', target: 'end' },
    ],
    {
      executionId: 'exec_retry_fail',
      threadId: 'thread_retry_fail',
      checkpointer: new MemorySaver(),
      onNodeUpdate: (nodeId, status, data) => updates.push({ nodeId, status, attempts: data?.attempts }),
    },
  );
  const events = await collect(executor.executeStream({}));
  assert.equal(events.at(-1)?.type, 'error');
  const flakyUpdates = updates.filter(u => u.nodeId === 'flaky');
  assert.equal(flakyUpdates.filter(u => u.status === 'started').length, 1);
  const failed = flakyUpdates.find(u => u.status === 'failed');
  assert.equal(failed?.attempts, 3);
});

test('does not retry config/validation failures', async () => {
  const updates: Array<{ nodeId: string; status: string; attempts?: number }> = [];
  const executor = new WorkflowExecutor(
    [
      node('start', 'start'),
      node('bad', 'transform', {
        code: 'return { error: "No API key for provider" };',
        retry: { maxAttempts: 3, backoffMs: 0, backoffMultiplier: 1 },
      }),
      node('end', 'end'),
    ],
    [
      { id: 'a', source: 'start', target: 'bad' },
      { id: 'b', source: 'bad', target: 'end' },
    ],
    {
      executionId: 'exec_retry_config',
      threadId: 'thread_retry_config',
      checkpointer: new MemorySaver(),
      onNodeUpdate: (nodeId, status, data) => updates.push({ nodeId, status, attempts: data?.attempts }),
    },
  );
  const events = await collect(executor.executeStream({}));
  assert.equal(events.at(-1)?.type, 'error');
  const badUpdates = updates.filter(u => u.nodeId === 'bad');
  assert.equal(badUpdates.filter(u => u.status === 'started').length, 1);
  assert.equal(badUpdates.find(u => u.status === 'failed')?.attempts, 1);
});

test('treats HTTP 5xx as retriable failure only when retry is configured', async () => {
  const legacy = await collect(new WorkflowExecutor(
    [
      node('start', 'start'),
      node('httpish', 'transform', { code: 'return { ok: false, status: 503, data: "down" };' }),
      node('end', 'end'),
    ],
    [
      { id: 'a', source: 'start', target: 'httpish' },
      { id: 'b', source: 'httpish', target: 'end' },
    ],
    { executionId: 'exec_soft_legacy', threadId: 'thread_soft_legacy', checkpointer: new MemorySaver() },
  ).executeStream({}));
  assert.equal(legacy.at(-1)?.type, 'workflow_completed');
  assert.equal(legacy.at(-1)?.state?.nodeResults?.httpish?.output?.ok, false);

  const retried = await collect(new WorkflowExecutor(
    [
      node('start', 'start'),
      node('httpish', 'transform', {
        code: 'return { ok: false, status: 503, data: "down" };',
        retry: { maxAttempts: 2, backoffMs: 0, backoffMultiplier: 1 },
      }),
      node('end', 'end'),
    ],
    [
      { id: 'a', source: 'start', target: 'httpish' },
      { id: 'b', source: 'httpish', target: 'end' },
    ],
    { executionId: 'exec_soft_retry', threadId: 'thread_soft_retry', checkpointer: new MemorySaver() },
  ).executeStream({}));
  assert.equal(retried.at(-1)?.type, 'error');
});

test('records attempts on successful nodes that recovered after retries', async () => {
  const updates: Array<{ nodeId: string; status: string; attempts?: number }> = [];
  const executor = new WorkflowExecutor(
    [
      node('start', 'start'),
      node('ok', 'transform', {
        code: 'return { value: 1 };',
        retry: { maxAttempts: 3, backoffMs: 0, backoffMultiplier: 1 },
      }),
      node('end', 'end'),
    ],
    [
      { id: 'a', source: 'start', target: 'ok' },
      { id: 'b', source: 'ok', target: 'end' },
    ],
    {
      executionId: 'exec_retry_ok',
      threadId: 'thread_retry_ok',
      checkpointer: new MemorySaver(),
      onNodeUpdate: (nodeId, status, data) => updates.push({ nodeId, status, attempts: data?.attempts }),
    },
  );
  const events = await collect(executor.executeStream({}));
  assert.equal(events.at(-1)?.type, 'workflow_completed');
  assert.equal(updates.find(u => u.nodeId === 'ok' && u.status === 'completed')?.attempts, 1);
});

test('routes failures to an error edge without killing the workflow', async () => {
  const updates: Array<{ nodeId: string; status: string; errorRouted?: boolean }> = [];
  const executor = new WorkflowExecutor(
    [
      node('start', 'start'),
      node('flaky', 'transform', {
        code: 'return { error: "HTTP request failed: network timeout" };',
        retry: { maxAttempts: 2, backoffMs: 0, backoffMultiplier: 1 },
      }),
      node('fallback', 'set-state', { variables: { recovered: true } }),
      node('end', 'end'),
    ],
    [
      { id: 'a', source: 'start', target: 'flaky' },
      { id: 'b', source: 'flaky', target: 'end' },
      { id: 'c', source: 'flaky', sourceHandle: 'error', target: 'fallback' },
      { id: 'd', source: 'fallback', target: 'end' },
    ],
    {
      executionId: 'exec_error_route',
      threadId: 'thread_error_route',
      checkpointer: new MemorySaver(),
      onNodeUpdate: (nodeId, status, data) => updates.push({ nodeId, status, errorRouted: data?.errorRouted }),
    },
  );
  const events = await collect(executor.executeStream({}));
  assert.equal(events.at(-1)?.type, 'workflow_completed');
  const flaky = updates.find(u => u.nodeId === 'flaky' && u.status === 'failed');
  assert.equal(flaky?.errorRouted, true);
  assert.equal(events.at(-1)?.state?.nodeResults?.fallback?.status, 'completed');
  assert.equal(events.at(-1)?.state?.variables?.recovered, true);
});

test('still fails the workflow when no error edge is connected', async () => {
  const events = await collect(new WorkflowExecutor(
    [
      node('start', 'start'),
      node('flaky', 'transform', { code: 'return { error: "HTTP request failed: network timeout" };' }),
      node('end', 'end'),
    ],
    [
      { id: 'a', source: 'start', target: 'flaky' },
      { id: 'b', source: 'flaky', target: 'end' },
    ],
    { executionId: 'exec_hard_fail', threadId: 'thread_hard_fail', checkpointer: new MemorySaver() },
  ).executeStream({}));
  assert.equal(events.at(-1)?.type, 'error');
});

test('normalizes error handle aliases for routing', async () => {
  const events = await collect(new WorkflowExecutor(
    [
      node('start', 'start'),
      node('flaky', 'transform', { code: 'return { error: "network timeout" };' }),
      node('fallback', 'set-state', { variables: { recovered: true } }),
      node('end', 'end'),
    ],
    [
      { id: 'a', source: 'start', target: 'flaky' },
      { id: 'b', source: 'flaky', target: 'end' },
      { id: 'c', source: 'flaky', sourceHandle: 'on-error', target: 'fallback' },
      { id: 'd', source: 'fallback', target: 'end' },
    ],
    { executionId: 'exec_error_alias', threadId: 'thread_error_alias', checkpointer: new MemorySaver() },
  ).executeStream({}));
  assert.equal(events.at(-1)?.type, 'workflow_completed');
  assert.equal(events.at(-1)?.state?.nodeResults?.fallback?.status, 'completed');
});

test('mermaid export marks loops as diamonds and labels error edges', () => {
  const mermaid = toMermaid(
    [
      node('start', 'start'),
      node('each', 'for-each', { items: 'input.items', label: 'Each Item' }),
      node('fetch', 'http', { url: 'https://example.com', label: 'Fetch' }),
      node('end', 'end'),
    ],
    [
      { id: 'a', source: 'start', target: 'each' },
      { id: 'b', source: 'each', target: 'fetch', sourceHandle: 'continue' },
      { id: 'c', source: 'fetch', target: 'each' },
      { id: 'd', source: 'each', target: 'end', sourceHandle: 'break' },
      { id: 'e', source: 'fetch', target: 'end', sourceHandle: 'error' },
    ],
  );
  assert.ok(mermaid.includes('each{Each Item}'));
  assert.ok(mermaid.includes('|error|'));
  assert.ok(mermaid.includes('|continue|') || mermaid.includes('|break|'));
});
