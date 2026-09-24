const SECRET_KEY = /(password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|connection[_-]?string|credentials?|authorization)/i;

export function redactWorkflowSecrets(value: any, seen = new WeakSet<object>()): any {
  if (value == null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => redactWorkflowSecrets(item, seen));
  const output: Record<string, any> = {};
  for (const [key, child] of Object.entries(value)) output[key] = SECRET_KEY.test(key) ? '[redacted]' : redactWorkflowSecrets(child, seen);
  return output;
}
