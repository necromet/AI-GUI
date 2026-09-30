import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const PREFIX = 'gcm:v1:';
const IV_BYTES = 12;
const TAG_BYTES = 16;

function key(): Buffer {
  const secret = process.env.DB_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'insecure-fallback-key-do-not-use-in-production';
  return scryptSync(secret, 'workflow-provider-key-v1', 32);
}

export function isEncryptedWorkflowKey(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptWorkflowKey(value: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

export function decryptWorkflowKey(value: string): string {
  if (!isEncryptedWorkflowKey(value)) return Buffer.from(value, 'base64').toString('utf8');
  const data = Buffer.from(value.slice(PREFIX.length), 'base64');
  if (data.length < IV_BYTES + TAG_BYTES + 1) throw new Error('Invalid encrypted workflow key');
  const decipher = createDecipheriv('aes-256-gcm', key(), data.subarray(0, IV_BYTES));
  decipher.setAuthTag(data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(data.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
}
