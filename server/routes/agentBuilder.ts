import { Router } from 'express';
import { pool } from '../db/pg';
import { setupSSEHeaders, createEmitter, setupCloseDetection, sendSSEError } from '../lib/sseHelpers';
import { ensureWorkspace, discoverSkills, getMemorySummary, runHarness, detectPromptLanguage, mergeHarnessConfig } from '../lib/harness/index';
import { resolvePending, getPendingStore } from '../lib/harness/tools/questionTool';
import type { LLMMessage } from '../lib/harness/types';

const router = Router();

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function jsonbParse<T>(val: unknown, fallback: T): T {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return fallback; } }
  if (val && typeof val === 'object') return val as T;
  return fallback;
}

// ─── Tools CRUD ───

router.get('/tools', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM agent_builder_tools ORDER BY created_at DESC'
    );
    res.json({ tools: rows.map(r => ({ ...r, parameters_schema: jsonbParse(r.parameters_schema, {}) })) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tools', async (req, res) => {
  try {
    const { name, description, parameters_schema, implementation, icon, color } = req.body;
    if (!name) { res.status(400).json({ error: 'name is required' }); return; }
    const id = uid();
    await pool.query(
      `INSERT INTO agent_builder_tools (id, name, description, parameters_schema, implementation, icon, color)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, name, description, JSON.stringify(parameters_schema || {}), implementation || null, icon || 'wrench', color || '#66A0C8']
    );
    const { rows } = await pool.query('SELECT * FROM agent_builder_tools WHERE id=$1', [id]);
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/tools/:id', async (req, res) => {
  try {
    const { name, description, parameters_schema, implementation, icon, color } = req.body;
    const fields: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name=$${idx++}`); vals.push(name); }
    if (description !== undefined) { fields.push(`description=$${idx++}`); vals.push(description); }
    if (parameters_schema !== undefined) { fields.push(`parameters_schema=$${idx++}`); vals.push(JSON.stringify(parameters_schema)); }
    if (implementation !== undefined) { fields.push(`implementation=$${idx++}`); vals.push(implementation); }
    if (icon !== undefined) { fields.push(`icon=$${idx++}`); vals.push(icon); }
    if (color !== undefined) { fields.push(`color=$${idx++}`); vals.push(color); }
    if (fields.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }
    fields.push(`updated_at=NOW()`);
    vals.push(req.params.id);
    await pool.query(`UPDATE agent_builder_tools SET ${fields.join(',')} WHERE id=$${idx}`, vals);
    const { rows } = await pool.query('SELECT * FROM agent_builder_tools WHERE id=$1', [req.params.id]);
    res.json(rows[0] || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/tools/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM agent_builder_tools WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Agents CRUD ───

router.get('/agents', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, COALESCE(
         (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'description', t.description, 'parameters_schema', t.parameters_schema, 'icon', t.icon, 'color', t.color))
          FROM agent_builder_agent_tools at
          JOIN agent_builder_tools t ON t.id = at.tool_id
          WHERE at.agent_id = a.id), '[]') AS tools
       FROM agent_builder_agents a ORDER BY a.created_at DESC`
    );
    res.json({ agents: rows.map(r => ({ ...r, tools: jsonbParse(r.tools, []) })) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/agents/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM agent_builder_agents WHERE id=$1', [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ error: 'Agent not found' }); return; }
    const agent = rows[0];
    const toolRows = await pool.query(
      `SELECT t.* FROM agent_builder_tools t
       JOIN agent_builder_agent_tools at ON t.id = at.tool_id
       WHERE at.agent_id = $1 ORDER BY t.name`,
      [req.params.id]
    );
    agent.tools = toolRows.rows.map(r => ({ ...r, parameters_schema: jsonbParse(r.parameters_schema, {}) }));
    res.json(agent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/agents', async (req, res) => {
  try {
    const { name, description, system_prompt, model, provider, color, icon } = req.body;
    if (!name) { res.status(400).json({ error: 'name required' }); return; }
    const id = uid();
    await pool.query(
      `INSERT INTO agent_builder_agents (id, name, description, system_prompt, model, provider, color, icon)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, name, description || null, system_prompt || '', model || 'mimo-v2.5', provider || null, color || '#5ABDAC', icon || 'bot']
    );
    const { rows } = await pool.query('SELECT * FROM agent_builder_agents WHERE id=$1', [id]);
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/agents/:id', async (req, res) => {
  try {
    const { name, description, system_prompt, model, provider, color, icon } = req.body;
    const fields: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name=$${idx++}`); vals.push(name); }
    if (description !== undefined) { fields.push(`description=$${idx++}`); vals.push(description); }
    if (system_prompt !== undefined) { fields.push(`system_prompt=$${idx++}`); vals.push(system_prompt); }
    if (model !== undefined) { fields.push(`model=$${idx++}`); vals.push(model); }
    if (provider !== undefined) { fields.push(`provider=$${idx++}`); vals.push(provider); }
    if (color !== undefined) { fields.push(`color=$${idx++}`); vals.push(color); }
    if (icon !== undefined) { fields.push(`icon=$${idx++}`); vals.push(icon); }
    if (fields.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }
    fields.push(`updated_at=NOW()`);
    vals.push(req.params.id);
    await pool.query(`UPDATE agent_builder_agents SET ${fields.join(',')} WHERE id=$${idx}`, vals);
    const { rows } = await pool.query('SELECT * FROM agent_builder_agents WHERE id=$1', [req.params.id]);
    res.json(rows[0] || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/agents/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM agent_builder_agents WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/agents/:id/tools', async (req, res) => {
  try {
    const { toolId } = req.body;
    if (!toolId) { res.status(400).json({ error: 'toolId required' }); return; }
    await pool.query(
      'INSERT INTO agent_builder_agent_tools (agent_id, tool_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.id, toolId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/agents/:id/tools/:toolId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM agent_builder_agent_tools WHERE agent_id=$1 AND tool_id=$2',
      [req.params.id, req.params.toolId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Workflows CRUD ───

router.get('/workflows', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM agent_builder_workflows ORDER BY updated_at DESC'
    );
    res.json({ workflows: rows.map(r => ({ ...r, graph_json: jsonbParse(r.graph_json, { nodes: [], edges: [] }) })) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/workflows/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM agent_builder_workflows WHERE id=$1', [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ error: 'Workflow not found' }); return; }
    const wf = rows[0];
    wf.graph_json = jsonbParse(wf.graph_json, { nodes: [], edges: [] });
    res.json(wf);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/workflows', async (req, res) => {
  try {
    const { name, description, graph_json } = req.body;
    const id = uid();
    await pool.query(
      `INSERT INTO agent_builder_workflows (id, name, description, graph_json)
       VALUES ($1,$2,$3,$4)`,
      [id, name || 'Untitled Workflow', description || null, JSON.stringify(graph_json || { nodes: [], edges: [] })]
    );
    const { rows } = await pool.query('SELECT * FROM agent_builder_workflows WHERE id=$1', [id]);
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/workflows/:id', async (req, res) => {
  try {
    const { name, description, graph_json } = req.body;
    const fields: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name=$${idx++}`); vals.push(name); }
    if (description !== undefined) { fields.push(`description=$${idx++}`); vals.push(description); }
    if (graph_json !== undefined) { fields.push(`graph_json=$${idx++}`); vals.push(JSON.stringify(graph_json)); }
    if (fields.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }
    fields.push(`updated_at=NOW()`);
    vals.push(req.params.id);
    await pool.query(`UPDATE agent_builder_workflows SET ${fields.join(',')} WHERE id=$${idx}`, vals);
    const { rows } = await pool.query('SELECT * FROM agent_builder_workflows WHERE id=$1', [req.params.id]);
    res.json(rows[0] || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/workflows/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM agent_builder_workflows WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Workflow Detail (workflow + its agents + its tools) ───

router.get('/workflows/:id/detail', async (req, res) => {
  try {
    const { rows: wfRows } = await pool.query('SELECT * FROM agent_builder_workflows WHERE id=$1', [req.params.id]);
    if (wfRows.length === 0) { res.status(404).json({ error: 'Workflow not found' }); return; }
    const wf = wfRows[0];
    wf.graph_json = jsonbParse(wf.graph_json, { nodePositions: {}, edges: [] });

    const { rows: agentRows } = await pool.query(
      `SELECT a.*, COALESCE(
         (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'description', t.description, 'parameters_schema', t.parameters_schema, 'icon', t.icon, 'color', t.color))
          FROM agent_builder_agent_tools at
          JOIN agent_builder_tools t ON t.id = at.tool_id
          WHERE at.agent_id = a.id), '[]') AS tools
       FROM agent_builder_agents a
       JOIN agent_builder_workflow_agents wa ON wa.agent_id = a.id
       WHERE wa.workflow_id = $1
       ORDER BY a.name`,
      [req.params.id]
    );

    const { rows: toolRows } = await pool.query(
      `SELECT t.* FROM agent_builder_tools t
       JOIN agent_builder_workflow_tools wt ON wt.tool_id = t.id
       WHERE wt.workflow_id = $1
       ORDER BY t.name`,
      [req.params.id]
    );

    res.json({
      ...wf,
      agents: agentRows.map(r => ({ ...r, tools: jsonbParse(r.tools, []) })),
      tools: toolRows.map(r => ({ ...r, parameters_schema: jsonbParse(r.parameters_schema, {}) })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Workflow <-> Agent junction ───

router.post('/workflows/:id/agents', async (req, res) => {
  try {
    const { agentId } = req.body;
    if (!agentId) { res.status(400).json({ error: 'agentId required' }); return; }
    await pool.query(
      'INSERT INTO agent_builder_workflow_agents (workflow_id, agent_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.id, agentId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/workflows/:id/agents/:agentId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM agent_builder_workflow_agents WHERE workflow_id=$1 AND agent_id=$2',
      [req.params.id, req.params.agentId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Workflow <-> Tool junction ───

router.post('/workflows/:id/tools', async (req, res) => {
  try {
    const { toolId } = req.body;
    if (!toolId) { res.status(400).json({ error: 'toolId required' }); return; }
    await pool.query(
      'INSERT INTO agent_builder_workflow_tools (workflow_id, tool_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.id, toolId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/workflows/:id/tools/:toolId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM agent_builder_workflow_tools WHERE workflow_id=$1 AND tool_id=$2',
      [req.params.id, req.params.toolId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Chat (SSE streaming via harness) ───

router.post('/chat', async (req, res) => {
  try {
    const { agentId, sessionId, messages, model: overrideModel, provider: overrideProvider } = req.body;
    if (!agentId) { res.status(400).json({ error: 'agentId required' }); return; }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages required' }); return;
    }

    const { rows: agentRows } = await pool.query('SELECT * FROM agent_builder_agents WHERE id=$1', [agentId]);
    if (agentRows.length === 0) { res.status(404).json({ error: 'Agent not found' }); return; }
    const agent = agentRows[0];

    const { rows: toolRows } = await pool.query(
      `SELECT t.* FROM agent_builder_tools t
       JOIN agent_builder_agent_tools at ON t.id = at.tool_id
       WHERE at.agent_id = $1`,
      [agentId]
    );

    const providerName = overrideProvider || agent.provider;
    const modelName = overrideModel || agent.model;
    const sessId = sessionId || ('sess_' + uid());
    const workspaceRoot = await ensureWorkspace(agentId, sessId);
    const skills = await discoverSkills(workspaceRoot, { maxSkills: 30 });
    const memorySummary = await getMemorySummary(workspaceRoot);
    const harnessConfig = mergeHarnessConfig(jsonbParse(agent.harness_config, {}));

    const lastUserMsg = messages[messages.length - 1];
    const languageHint = detectPromptLanguage(lastUserMsg?.content || '');

    const apiMessages: LLMMessage[] = messages.map((m: any) => ({
      role: (m.role === 'model' ? 'assistant' : m.role) as LLMMessage['role'],
      content: m.content || '',
    }));

    setupSSEHeaders(res);
    const emitEvent = createEmitter(res);

    const result = await runHarness({
      agentId,
      sessionId: sessId,
      workspaceRoot,
      messages: apiMessages,
      agentPrompt: agent.system_prompt || '',
      model: modelName || 'mimo-v2.5',
      provider: providerName || undefined,
      config: harnessConfig,
      skills,
      memorySummary,
      onEvent: emitEvent,
      signal: req.signal,
    });

    emitEvent({ done: true, output: result.output });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('[agent-builder/chat] Error:', error.message);
    sendSSEError(res, error.message);
  }
});

// ─── Resume (resolve pending permission / question) ───

router.post('/chat/resume', async (req, res) => {
  try {
    const { pendingId, decision, answer } = req.body;
    if (!pendingId) { res.status(400).json({ error: 'pendingId required' }); return; }

    const ok = resolvePending(pendingId, {
      decision: decision || 'allow',
      answer,
    });

    if (!ok) {
      res.status(404).json({ error: 'Unknown or expired pendingId' });
      return;
    }

    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
