import { getAll, getOne, run, runReturning } from './pg';

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

export async function createWorkflow(data: { name: string; nodes: string; edges: string }) {
  const id = 'wf_' + uid();
  await run(
    'INSERT INTO workflows (id, custom_id, name, nodes, edges) VALUES ($1, $2, $3, $4, $5)',
    [id, id, data.name, data.nodes, data.edges]
  );
  return getWorkflow(id);
}

export async function updateWorkflow(id: string, data: Partial<{ name: string; nodes: string; edges: string; description: string }>) {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name); }
  if (data.nodes !== undefined) { sets.push(`nodes = $${idx++}`); params.push(data.nodes); }
  if (data.edges !== undefined) { sets.push(`edges = $${idx++}`); params.push(data.edges); }
  if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description); }
  sets.push('updated_at = NOW()');
  params.push(id);
  await run(`UPDATE workflows SET ${sets.join(', ')} WHERE id = $${idx}`, params);
  return getWorkflow(id);
}

export async function deleteWorkflow(id: string) {
  await run('DELETE FROM workflows WHERE id = $1', [id]);
}

// ─── Executions ───

export async function createExecution(data: { workflowId: string; input?: string }) {
  const id = 'exec_' + uid();
  await run(
    'INSERT INTO executions (id, workflow_id, input) VALUES ($1, $2, $3)',
    [id, data.workflowId, data.input || '{}']
  );
  return id;
}

export async function updateExecution(id: string, data: Record<string, any>) {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  for (const [key, val] of Object.entries(data)) {
    sets.push(`${key} = $${idx++}`);
    params.push(typeof val === 'object' ? JSON.stringify(val) : val);
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

// ─── MCP Servers ───

export async function getMCPServers() {
  return getAll('SELECT * FROM mcp_servers WHERE enabled = TRUE ORDER BY name');
}

export async function getMCPServer(id: string) {
  return getOne('SELECT * FROM mcp_servers WHERE id = $1', [id]);
}

export async function createMCPServer(data: { name: string; url: string; description?: string; category?: string; authType?: string; accessToken?: string }) {
  const id = 'mcp_' + uid();
  await run(
    `INSERT INTO mcp_servers (id, name, url, description, category, auth_type, access_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, data.name, data.url, data.description || null, data.category || 'custom', data.authType || 'none', data.accessToken || null]
  );
  return getMCPServer(id);
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
