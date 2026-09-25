import test from 'node:test';
import assert from 'node:assert/strict';
import { canExecutePublishedWorkflow } from '../../lib/workflow/auth.js';

test('published execution accepts only the matching bearer key', () => {
  const workflow = { published: true, api_key: 'sk_wf_secret' };
  assert.equal(canExecutePublishedWorkflow('Bearer sk_wf_secret', workflow), true);
  assert.equal(canExecutePublishedWorkflow('Bearer wrong', workflow), false);
});

test('unpublished workflows reject bearer execution', () => {
  assert.equal(canExecutePublishedWorkflow('Bearer sk_wf_secret', { published: false, api_key: 'sk_wf_secret' }), false);
});
