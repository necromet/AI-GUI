import test from 'node:test';
import assert from 'node:assert/strict';
import { MemorySaver } from '@langchain/langgraph';
import { WorkflowExecutor } from '../../server/services/workflowExecutor.js';

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
