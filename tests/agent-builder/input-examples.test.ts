import assert from 'node:assert/strict';
import test from 'node:test';
import { exampleExecutionInput } from '../../lib/workflow/inputExamples.js';

test('published request examples include named Start inputs when configured', () => {
  assert.equal(exampleExecutionInput([{ type: 'start', data: { inputVariables: [] } }], 'hello'), 'hello');
  assert.deepEqual(exampleExecutionInput([{ type: 'start', data: { inputVariables: [{ name: 'question', required: true }, { name: 'context', required: true }] } }], 'hello'), {
    question: 'hello',
    context: 'hello',
  });
});
