import { getAll, getOne, run, runReturning, pool } from './pg';
import { redactWorkflowSecrets } from '../services/workflowRedaction.js';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Workflows ───

export async function getWorkflows() {
  return getAll('SELECT * FROM workflows ORDER BY updated_at DESC');
}

export async function getWorkflow(id: string) {
  return getOne('SELECT * FROM workflows WHERE id = $1 OR custom_id = $1', [id]);
}

export async function getWorkflowByShareToken(token: string) {
  return getOne('SELECT * FROM workflows WHERE share_token = $1 AND chat_enabled = TRUE', [token]);
}

export async function createWorkflow(data: { name: string; nodes: string; edges: string; description?: string; category?: string; tags?: string }) {
  const id = 'wf_' + uid();
  await run(
    `INSERT INTO workflows (id, custom_id, name, nodes, edges, description, category, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, id, data.name, data.nodes, data.edges, data.description || null, data.category || 'custom', data.tags || '[]']
  );
  return getWorkflow(id);
}

export async function updateWorkflow(id: string, data: Partial<{ name: string; nodes: string; edges: string; description: string; published: boolean; api_key: string | null; endpoint_url: string | null; chat_enabled: boolean; share_token: string | null }>) {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name); }
  if (data.nodes !== undefined) { sets.push(`nodes = $${idx++}`); params.push(data.nodes); }
  if (data.edges !== undefined) { sets.push(`edges = $${idx++}`); params.push(data.edges); }
  if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description); }
  if (data.published !== undefined) { sets.push(`published = $${idx++}`); params.push(data.published); }
  if (data.api_key !== undefined) { sets.push(`api_key = $${idx++}`); params.push(data.api_key); }
  if (data.endpoint_url !== undefined) { sets.push(`endpoint_url = $${idx++}`); params.push(data.endpoint_url); }
  if (data.chat_enabled !== undefined) { sets.push(`chat_enabled = $${idx++}`); params.push(data.chat_enabled); }
  if (data.share_token !== undefined) { sets.push(`share_token = $${idx++}`); params.push(data.share_token); }
  sets.push('updated_at = NOW()');
  params.push(id);
  await run(`UPDATE workflows SET ${sets.join(', ')} WHERE id = $${idx}`, params);
  return getWorkflow(id);
}

export async function deleteWorkflow(id: string) {
  await run('DELETE FROM workflows WHERE id = $1', [id]);
}

// ─── Executions ───

export async function createExecution(data: {
  id?: string;
  workflowId: string;
  input?: any;
  threadId?: string;
  conversationId?: string;
  workflowSnapshot?: any;
}) {
  const id = data.id || 'exec_' + uid();
  await run(
    `INSERT INTO executions (id, workflow_id, input, thread_id, checkpoint_thread_id, conversation_id, workflow_snapshot)
     VALUES ($1, $2, $3, $4, $4, $5, $6)`,
    [id, data.workflowId, JSON.stringify(redactWorkflowSecrets(data.input ?? {})), data.threadId || id, data.conversationId || id, JSON.stringify(redactWorkflowSecrets(data.workflowSnapshot || null))]
  );
  return id;
}

export async function updateExecution(id: string, data: Record<string, any>) {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  const jsonColumns = new Set(['node_results', 'variables', 'input', 'output', 'workflow_snapshot', 'pending_action']);
  for (const [key, val] of Object.entries(data)) {
    sets.push(`${key} = $${idx++}`);
    const safeValue = jsonColumns.has(key) || typeof val === 'object' ? redactWorkflowSecrets(val) : val;
    params.push(safeValue !== null && (jsonColumns.has(key) || typeof safeValue === 'object') ? JSON.stringify(safeValue) : safeValue);
  }
  params.push(id);
  await run(`UPDATE executions SET ${sets.join(', ')} WHERE id = $${idx}`, params);
}

export async function getExecution(id: string) {
  return getOne('SELECT * FROM executions WHERE id = $1', [id]);
}

export async function getExecutionsByWorkflow(workflowId: string) {
  return getAll('SELECT * FROM executions WHERE workflow_id = $1 ORDER BY started_at DESC', [workflowId]);
}

export async function getWorkflowIdForExecution(executionId: string): Promise<string | null> {
  const exec = await getOne('SELECT workflow_id FROM executions WHERE id = $1', [executionId]);
  return exec?.workflow_id ?? null;
}

// ─── MCP Servers ───

export async function getMCPServers() {
  return getAll('SELECT * FROM mcp_servers WHERE enabled = TRUE ORDER BY name');
}

export async function getMCPServer(id: string) {
  return getOne('SELECT * FROM mcp_servers WHERE id = $1', [id]);
}

export async function createMCPServer(data: { id?: string; name: string; url: string; description?: string; category?: string; authType?: string; accessToken?: string; headers?: any; tools?: any[] }) {
  const id = 'mcp_' + uid();
  await run(
    `INSERT INTO mcp_servers (id, name, url, description, category, auth_type, access_token, headers, tools)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [data.id || id, data.name, data.url, data.description || null, data.category || 'custom', data.authType || 'none', data.accessToken || null, JSON.stringify(data.headers || {}), JSON.stringify(data.tools || [])]
  );
  return getMCPServer(data.id || id);
}

export async function updateMCPServer(id: string, data: Record<string, any>) {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  for (const [key, val] of Object.entries(data)) {
    sets.push(`${key} = $${idx++}`);
    params.push(typeof val === 'object' ? JSON.stringify(val) : val);
  }
  sets.push('updated_at = NOW()');
  params.push(id);
  await run(`UPDATE mcp_servers SET ${sets.join(', ')} WHERE id = $${idx}`, params);
  return getMCPServer(id);
}

export async function deleteMCPServer(id: string) {
  await run('DELETE FROM mcp_servers WHERE id = $1', [id]);
}

// ─── Approvals ───

export async function createApproval(data: { approvalId: string; workflowId: string; executionId: string; nodeId: string; message: string }) {
  await run(
    `INSERT INTO approvals (id, approval_id, workflow_id, execution_id, node_id, message)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [data.approvalId, data.approvalId, data.workflowId, data.executionId, data.nodeId, data.message]
  );
}

export async function getApproval(approvalId: string) {
  return getOne('SELECT * FROM approvals WHERE approval_id = $1', [approvalId]);
}

export async function respondApproval(approvalId: string, status: 'approved' | 'rejected') {
  await run(
    'UPDATE approvals SET status = $1, responded_at = NOW() WHERE approval_id = $2',
    [status, approvalId]
  );
  return getApproval(approvalId);
}

export async function getPendingApprovals() {
  return getAll('SELECT * FROM approvals WHERE status = $1 ORDER BY created_at DESC', ['pending']);
}

// ─── User LLM Keys ───

export async function getUserLLMKeys() {
  return getAll('SELECT * FROM user_llm_keys WHERE is_active = TRUE ORDER BY provider');
}

export async function getUserLLMKey(id: string) {
  return getOne('SELECT * FROM user_llm_keys WHERE id = $1', [id]);
}

export async function createUserLLMKey(data: { provider: string; encryptedKey: string; keyPrefix?: string }) {
  const id = 'key_' + uid();
  await run(
    'INSERT INTO user_llm_keys (id, provider, encrypted_key, key_prefix) VALUES ($1, $2, $3, $4)',
    [id, data.provider, data.encryptedKey, data.keyPrefix || null]
  );
  return getUserLLMKey(id);
}

export async function deleteUserLLMKey(id: string) {
  await run('DELETE FROM user_llm_keys WHERE id = $1', [id]);
}

// ─── MCP Servers (expanded) ───

export async function getAllMCPServers(): Promise<any[]> {
  const result = await pool.query('SELECT * FROM mcp_servers ORDER BY name');
  return result.rows;
}

// ─── User LLM Keys (expanded) ───

export async function saveUserLLMKey(data: {
  id: string;
  provider: string;
  encryptedKey: string;
  keyPrefix?: string;
}): Promise<any> {
  const updated = await pool.query(
    `UPDATE user_llm_keys
     SET encrypted_key = $2, key_prefix = $3, is_active = TRUE, updated_at = NOW()
     WHERE id = (SELECT id FROM user_llm_keys WHERE provider = $1 ORDER BY updated_at DESC LIMIT 1)
     RETURNING *`,
    [data.provider, data.encryptedKey, data.keyPrefix || null],
  );
  if (updated.rows[0]) return updated.rows[0];
  const inserted = await pool.query(
    `INSERT INTO user_llm_keys (id, provider, encrypted_key, key_prefix)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.id, data.provider, data.encryptedKey, data.keyPrefix || null],
  );
  return inserted.rows[0];
}

export async function getLLMKeyForProvider(provider: string): Promise<any> {
  const result = await pool.query(
    'SELECT * FROM user_llm_keys WHERE provider = $1 AND is_active = true LIMIT 1', [provider]
  );
  return result.rows[0] || null;
}

// ─── Template CRUD ───

export async function getWorkflowTemplates(): Promise<any[]> {
  const result = await pool.query('SELECT * FROM workflow_templates ORDER BY created_at DESC');
  return result.rows;
}

export async function createWorkflowTemplate(data: {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  nodes: any[];
  edges: any[];
  difficulty?: string;
  estimatedTime?: string;
}): Promise<any> {
  const result = await pool.query(
    `INSERT INTO workflow_templates (id, name, description, category, tags, nodes, edges, difficulty, estimated_time)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [data.id, data.name, data.description || null, data.category || 'general',
     JSON.stringify(data.tags || []), JSON.stringify(data.nodes), JSON.stringify(data.edges),
     data.difficulty || 'beginner', data.estimatedTime || null]
  );
  return result.rows[0];
}

export async function deleteWorkflowTemplate(id: string): Promise<void> {
  await pool.query('DELETE FROM workflow_templates WHERE id = $1', [id]);
}

// ─── Execution Logs ───

export async function createExecutionLog(data: {
  executionId: string;
  nodeId: string;
  eventType: string;
  data?: any;
}): Promise<void> {
  await pool.query(
    `INSERT INTO execution_logs (execution_id, node_id, event_type, data) VALUES ($1, $2, $3, $4)`,
    [data.executionId, data.nodeId, data.eventType, data.data ? JSON.stringify(redactWorkflowSecrets(data.data)) : null]
  );
}

export async function getExecutionLogs(executionId: string): Promise<any[]> {
  const result = await pool.query(
    'SELECT * FROM execution_logs WHERE execution_id = $1 ORDER BY created_at', [executionId]
  );
  return result.rows;
}

// ─── Seed Built-in Templates ───

export async function seedBuiltinTemplates(): Promise<void> {
  const { getBuiltinTemplates } = await import('../services/workflowTemplates.js');
  const templates = getBuiltinTemplates();
  for (const tpl of templates) {
    try {
      await pool.query(
        `INSERT INTO workflow_templates (id, name, description, category, tags, nodes, edges, difficulty, estimated_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          tags = EXCLUDED.tags,
          nodes = EXCLUDED.nodes,
          edges = EXCLUDED.edges,
          difficulty = EXCLUDED.difficulty,
          estimated_time = EXCLUDED.estimated_time`,
        [tpl.id, tpl.name, tpl.description, tpl.category,
         JSON.stringify(tpl.tags), JSON.stringify(tpl.nodes), JSON.stringify(tpl.edges),
         tpl.difficulty, tpl.estimatedTime]
      );
    } catch {}
  }
}
