import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptWorkflowKey, encryptWorkflowKey, isEncryptedWorkflowKey } from '../../server/services/workflowKeyCipher.js';

test('provider keys use authenticated encryption and legacy base64 remains readable', () => {
  const plaintext = 'provider-secret-for-test';
  const encrypted = encryptWorkflowKey(plaintext);
  assert.equal(isEncryptedWorkflowKey(encrypted), true);
  assert.equal(encrypted.includes(plaintext), false);
  assert.equal(decryptWorkflowKey(encrypted), plaintext);
  assert.equal(decryptWorkflowKey(Buffer.from(plaintext).toString('base64')), plaintext);
  const bytes = Buffer.from(encrypted.slice('gcm:v1:'.length), 'base64');
  bytes[bytes.length - 1] ^= 1;
  assert.throws(() => decryptWorkflowKey('gcm:v1:' + bytes.toString('base64')));
});
