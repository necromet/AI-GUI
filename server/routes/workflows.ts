import { Router } from 'express';
import * as workflowDB from '../db/workflows.js';
import * as workflowMemory from '../db/workflowMemory.js';
import { nanoid } from 'nanoid';
import { parseWorkflow, generateExportCode } from './workflowHelpers.js';
import { toMermaid } from '../services/workflowExecutor.js';
import { normalizeWorkflowGraph, validateWorkflowGraph } from '../../lib/workflow/graph.js';

const router = Router();

function persistenceScope(req: any): workflowMemory.WorkflowScope {
  const type = req.query.scopeType === 'conversation' ? 'conversation' : 'workflow';
  const id = typeof req.query.scopeId === 'string' && req.query.scopeId ? req.query.scopeId : (type === 'workflow' ? req.params.id : '');
  if (!id) throw new Error('scopeId is required for conversation-scoped data.');
  return { type, id };
}

// ─── Workflow CRUD ───

router.get('/', async (_req, res) => {
  try {
    const workflows = await workflowDB.getWorkflows();
    res.json(workflows.map(parseWorkflow));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates', async (_req, res) => {
  try {
    const templates = await workflowDB.getWorkflowTemplates();
    res.json(templates.map(t => {
      const normalized = normalizeWorkflowGraph(typeof t.nodes === 'string' ? JSON.parse(t.nodes) : t.nodes, typeof t.edges === 'string' ? JSON.parse(t.edges) : t.edges);
      return ({
      ...t,
      estimatedTime: t.estimated_time,
      isPublic: t.is_public,
      createdAt: t.created_at,
      nodes: normalized.nodes,
      edges: normalized.edges,
      tags: typeof t.tags === 'string' ? JSON.parse(t.tags) : t.tags,
    }); }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates', async (req, res) => {
  try {
    const { name, description, category, tags, nodes, edges, difficulty, estimatedTime } = req.body;
    const normalized = normalizeWorkflowGraph(nodes || [], edges || []);
    const template = await workflowDB.createWorkflowTemplate({
      id: `tpl_${nanoid(10)}`, name, description, category, tags,
      nodes: normalized.nodes, edges: normalized.edges, difficulty, estimatedTime,
    });
    res.json(template);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/templates/:id', async (req, res) => {
  try {
    await workflowDB.deleteWorkflowTemplate(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const workflow = await workflowDB.getWorkflow(req.params.id);
    if (!workflow) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(parseWorkflow(workflow));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, nodes, edges, description, category, tags } = req.body;
    const normalized = normalizeWorkflowGraph(nodes || [], edges || []);
    const workflow = await workflowDB.createWorkflow({
      name: name || 'Untitled Workflow',
      nodes: JSON.stringify(normalized.nodes),
      edges: JSON.stringify(normalized.edges),
      description,
      category,
      tags: JSON.stringify(tags || []),
    });
    res.json(parseWorkflow(workflow));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, nodes, edges, description, category, tags } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (nodes !== undefined || edges !== undefined) {
      const current = await workflowDB.getWorkflow(req.params.id);
      const parsed = current ? parseWorkflow(current) : { nodes: [], edges: [] };
      const normalized = normalizeWorkflowGraph(nodes ?? parsed.nodes, edges ?? parsed.edges);
      updates.nodes = JSON.stringify(normalized.nodes);
      updates.edges = JSON.stringify(normalized.edges);
    }
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (tags !== undefined) updates.tags = JSON.stringify(tags);
    const workflow = await workflowDB.updateWorkflow(req.params.id, updates);
    if (!workflow) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(parseWorkflow(workflow));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await workflowDB.deleteWorkflow(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Publish / Unpublish ───

router.post('/:id/publish', async (req, res) => {
  try {
    const workflow = await workflowDB.getWorkflow(req.params.id);
    if (!workflow) { res.status(404).json({ error: 'Not found' }); return; }
    const apiKey = `sk_wf_${nanoid(24)}`;
    const endpointUrl = `${req.protocol}://${req.get('host')}/api/workflows/${req.params.id}/execute`;
    await workflowDB.updateWorkflow(req.params.id, {
      published: true,
      api_key: apiKey,
      endpoint_url: endpointUrl,
    });
    res.json({ published: true, endpointUrl, apiKey });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/unpublish', async (req, res) => {
  try {
    await workflowDB.updateWorkflow(req.params.id, {
      published: false,
      api_key: null,
      endpoint_url: null,
    });
    res.json({ published: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Public chat links are separate from API publishing. The opaque token can be
// revoked without rotating or exposing the workflow's API key.
router.post('/:id/share-chat', async (req, res) => {
  try {
    const workflow = await workflowDB.getWorkflow(req.params.id);
    if (!workflow) { res.status(404).json({ error: 'Workflow not found' }); return; }

    const parsed = parseWorkflow(workflow);
    const normalized = normalizeWorkflowGraph(parsed.nodes, parsed.edges);
    const issues = validateWorkflowGraph(normalized.nodes, normalized.edges);
    const firstError = issues.find(issue => issue.severity === 'error');
    if (firstError) {
      res.status(422).json({ error: `Fix the workflow before sharing: ${firstError.message}`, issues });
      return;
    }
    const blockedDatabase = normalized.nodes.find(node => (node.data?.nodeType || node.type) === 'database' && node.data?.dataSource === 'postgres' && node.data?.allowSharedChat !== true);
    if (blockedDatabase) {
      res.status(422).json({ error: `Enable “Allow this database query in shared chat” on "${blockedDatabase.data?.label || blockedDatabase.id}" before sharing.` });
      return;
    }

    const startNode = normalized.nodes.find(node => (node.data?.nodeType || node.type) === 'start');
    const requiredInputs = Array.isArray(startNode?.data?.inputVariables)
      ? startNode.data.inputVariables.filter((input: any) => input.required)
      : [];
    if (requiredInputs.length > 1) {
      res.status(422).json({ error: 'Shared chat supports workflows with at most one required Start input.' });
      return;
    }

    const shareToken = workflow.share_token || `chat_${nanoid(32)}`;
    await workflowDB.updateWorkflow(req.params.id, { chat_enabled: true, share_token: shareToken });
    res.json({ chatEnabled: true, shareToken, sharePath: `/share/${shareToken}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/share-chat', async (req, res) => {
  try {
    const workflow = await workflowDB.getWorkflow(req.params.id);
    if (!workflow) { res.status(404).json({ error: 'Workflow not found' }); return; }
    await workflowDB.updateWorkflow(req.params.id, { chat_enabled: false, share_token: null });
    res.json({ chatEnabled: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Export / Import ───

router.post('/:id/export-code', async (req, res) => {
  try {
    const workflow = await workflowDB.getWorkflow(req.params.id);
    if (!workflow) { res.status(404).json({ error: 'Not found' }); return; }
    const parsed = parseWorkflow(workflow);
    const code = generateExportCode(parsed);
    res.json({ code, language: 'typescript' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/export-mermaid', async (req, res) => {
  try {
    const workflow = await workflowDB.getWorkflow(req.params.id);
    if (!workflow) { res.status(404).json({ error: 'Not found' }); return; }
    const parsed = parseWorkflow(workflow);
    const mermaid = toMermaid(parsed.nodes, parsed.edges);
    res.json({ mermaid, language: 'mermaid' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/export-langgraph', async (req, res) => {
  try {
    const workflow = await workflowDB.getWorkflow(req.params.id);
    if (!workflow) { res.status(404).json({ error: 'Not found' }); return; }
    const parsed = parseWorkflow(workflow);
    res.json({
      name: parsed.name,
      description: parsed.description,
      nodes: parsed.nodes,
      edges: parsed.edges,
      metadata: { exportedAt: new Date().toISOString(), format: 'langgraph' },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/import-langgraph', async (req, res) => {
  try {
    const { name, description, nodes, edges } = req.body;
    const normalized = normalizeWorkflowGraph(nodes || [], edges || []);
    const workflow = await workflowDB.createWorkflow({
      name: name || 'Imported Workflow',
      nodes: JSON.stringify(normalized.nodes),
      edges: JSON.stringify(normalized.edges),
      description,
    });
    res.json(parseWorkflow(workflow));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Chat History & Memory Management ───

router.get('/:id/chat-history', async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const roleFilter = (req.query.role as any) || 'all';
    const history = await workflowMemory.getChatHistory(req.params.id, persistenceScope(req), { limit, roleFilter });
    res.json({ history, count: history.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/chat-history', async (req, res) => {
  try {
    await workflowMemory.clearChatHistory(req.params.id, persistenceScope(req));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/memory', async (req, res) => {
  try {
    const key = req.query.key as string | undefined;
    const entries = await workflowMemory.getMemory(req.params.id, persistenceScope(req), key);
    res.json({ memory: entries, count: entries.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/memory', async (req, res) => {
  try {
    await workflowMemory.clearMemory(req.params.id, persistenceScope(req));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/memory/:key', async (req, res) => {
  try {
    await workflowMemory.deleteMemory(req.params.id, persistenceScope(req), req.params.key);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
