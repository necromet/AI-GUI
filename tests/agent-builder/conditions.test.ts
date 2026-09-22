import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateConditionRule,
  resolveConditionMode,
  resolveConditionValue,
  validateConditionNode,
} from '../../lib/workflow/conditions.js';
import type { ConditionOperator } from '../../lib/workflow/types.js';

const state = {
  variables: {
    input: { status: 'Ready', score: 8, empty: '' },
    lastOutput: { message: 'Hello ERROR world', items: [] },
    threshold: 7,
    agent_1: { approved: true },
  },
};

test('resolves built-in, state, array, and node output paths', () => {
  assert.equal(resolveConditionValue('input.status', state), 'Ready');
  assert.equal(resolveConditionValue('lastOutput.message', state), 'Hello ERROR world');
  assert.equal(resolveConditionValue('state.threshold', state), 7);
  assert.equal(resolveConditionValue('variables.threshold', state), 7);
  assert.equal(resolveConditionValue('agent_1.output.approved', state), true);
});

test('evaluates all simple condition operators', () => {
  const cases: Array<[ConditionOperator, string, string | undefined, boolean]> = [
    ['eq', 'input.status', 'ready', true],
    ['neq', 'input.status', 'blocked', true],
    ['contains', 'lastOutput.message', 'error', true],
    ['not_contains', 'lastOutput.message', 'success', true],
    ['starts_with', 'input.status', 'rea', true],
    ['ends_with', 'input.status', 'DY', true],
    ['empty', 'lastOutput.items', undefined, true],
    ['not_empty', 'lastOutput.message', undefined, true],
    ['truthy', 'agent_1.output.approved', undefined, true],
    ['falsy', 'input.empty', undefined, true],
    ['gt', 'input.score', '7', true],
    ['gte', 'input.score', '8', true],
    ['lt', 'input.score', '9', true],
    ['lte', 'input.score', '{{threshold}}', false],
    ['matches', 'lastOutput.message', '^hello', true],
  ];
  for (const [op, left, right, expected] of cases) {
    const evaluation = evaluateConditionRule({ left, op, right }, state);
    assert.equal(evaluation.result, expected, op);
    assert.equal(evaluation.branch, expected ? 'if' : 'else', op);
  }
});

test('supports case sensitivity and exact variable right operands', () => {
  assert.equal(evaluateConditionRule({ left: 'input.status', op: 'eq', right: 'ready', caseSensitive: true }, state).result, false);
  assert.equal(evaluateConditionRule({ left: 'input.score', op: 'gt', right: '{{threshold}}' }, state).result, true);
});

test('returns explicit evaluation errors for invalid numbers and regexes', () => {
  assert.match(evaluateConditionRule({ left: 'input.status', op: 'gt', right: 'nope' }, state).error || '', /valid numbers/);
  assert.ok(evaluateConditionRule({ left: 'lastOutput.message', op: 'matches', right: '[' }, state).error);
});

test('resolves stored condition mode compatibly and rejects incomplete active modes', () => {
  assert.equal(resolveConditionMode({ condition: 'input === 1' }), 'expression');
  assert.equal(resolveConditionMode({ conditionRule: { left: 'input', op: 'truthy' } }), 'simple');
  assert.equal(resolveConditionMode({ conditionMode: 'expression', condition: 'true', conditionRule: { left: 'input', op: 'truthy' } }), 'expression');
  assert.ok(validateConditionNode({ conditionMode: 'simple', conditionRule: { left: 'lastOutput', op: 'contains', right: '' } }));
  assert.ok(validateConditionNode({ conditionMode: 'expression', condition: '' }));
  assert.equal(validateConditionNode({ condition: 'true' }), null);
});
