import { getAll, run } from './pg.js';

export type WorkflowScope = { type: 'conversation' | 'workflow'; id: string };

function uid(): string { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function assertScope(scope: WorkflowScope) {
  if (!scope || !['conversation', 'workflow'].includes(scope.type) || !String(scope.id || '').trim()) throw new Error('A valid workflow persistence scope is required.');
}

export async function saveChatMessages(workflowId: string, scope: WorkflowScope, executionId: string | null, messages: Array<{ role: string; content: string }>): Promise<void> {
  assertScope(scope);
  for (const message of messages) await run(
    'INSERT INTO workflow_chat_history (id, workflow_id, execution_id, scope_type, scope_id, role, content) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    ['wch_' + uid(), workflowId, executionId, scope.type, scope.id, message.role, message.content],
  );
}

export async function getChatHistory(workflowId: string, scope: WorkflowScope, opts?: { limit?: number; roleFilter?: 'all' | 'user' | 'assistant' }) {
  assertScope(scope);
  const limit = Math.max(1, Math.min(opts?.limit ?? 50, 200));
  let sql = 'SELECT role, content, created_at FROM workflow_chat_history WHERE workflow_id = $1 AND scope_type = $2 AND scope_id = $3';
  const params: any[] = [workflowId, scope.type, scope.id];
  if (opts?.roleFilter === 'user') { params.push('user'); sql += ` AND role = $${params.length}`; }
  else if (opts?.roleFilter === 'assistant') { params.push('assistant', 'model'); sql += ` AND role IN ($${params.length - 1}, $${params.length})`; }
  params.push(limit); sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;
  return (await getAll(sql, params)).reverse();
}

export async function clearChatHistory(workflowId: string, scope: WorkflowScope): Promise<void> {
  assertScope(scope); await run('DELETE FROM workflow_chat_history WHERE workflow_id = $1 AND scope_type = $2 AND scope_id = $3', [workflowId, scope.type, scope.id]);
}

export async function saveMemory(workflowId: string, scope: WorkflowScope, key: string, value: any, executionId?: string | null): Promise<void> {
  assertScope(scope);
  await run(`INSERT INTO workflow_chat_memory (id, workflow_id, scope_type, scope_id, memory_key, memory_value, execution_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (workflow_id, scope_type, scope_id, memory_key)
    DO UPDATE SET memory_value = EXCLUDED.memory_value, execution_id = EXCLUDED.execution_id, updated_at = NOW()`,
  ['wcm_' + uid(), workflowId, scope.type, scope.id, key, JSON.stringify(value), executionId ?? null]);
}

export async function getMemory(workflowId: string, scope: WorkflowScope, key?: string) {
  assertScope(scope);
  const params: any[] = [workflowId, scope.type, scope.id];
  let sql = 'SELECT memory_key, memory_value, updated_at FROM workflow_chat_memory WHERE workflow_id = $1 AND scope_type = $2 AND scope_id = $3';
  if (key) { params.push(key); sql += ` AND memory_key = $${params.length}`; }
  sql += ' ORDER BY updated_at DESC';
  return (await getAll(sql, params)).map(row => ({ key: row.memory_key, value: safeJsonParse(row.memory_value), updatedAt: row.updated_at }));
}

export async function deleteMemory(workflowId: string, scope: WorkflowScope, key: string): Promise<void> {
  assertScope(scope); await run('DELETE FROM workflow_chat_memory WHERE workflow_id = $1 AND scope_type = $2 AND scope_id = $3 AND memory_key = $4', [workflowId, scope.type, scope.id, key]);
}

export async function clearMemory(workflowId: string, scope: WorkflowScope): Promise<void> {
  assertScope(scope); await run('DELETE FROM workflow_chat_memory WHERE workflow_id = $1 AND scope_type = $2 AND scope_id = $3', [workflowId, scope.type, scope.id]);
}

function safeJsonParse(value: string): any { try { return JSON.parse(value); } catch { return value; } }
