import { Router } from 'express';
import * as workflowDB from '../db/workflows.js';
import { nanoid } from 'nanoid';
import { parseWorkflow, generateExportCode } from './workflowHelpers.js';
import { toMermaid } from '../services/workflowExecutor.js';

const router = Router();

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
    res.json(templates.map(t => ({
      ...t,
      nodes: typeof t.nodes === 'string' ? JSON.parse(t.nodes) : t.nodes,
      edges: typeof t.edges === 'string' ? JSON.parse(t.edges) : t.edges,
      tags: typeof t.tags === 'string' ? JSON.parse(t.tags) : t.tags,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates', async (req, res) => {
  try {
    const { name, description, category, tags, nodes, edges, difficulty, estimatedTime } = req.body;
    const template = await workflowDB.createWorkflowTemplate({
      id: `tpl_${nanoid(10)}`,
      name, description, category, tags, nodes, edges, difficulty, estimatedTime,
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
    const workflow = await workflowDB.createWorkflow({
      name: name || 'Untitled Workflow',
      nodes: JSON.stringify(nodes || []),
      edges: JSON.stringify(edges || []),
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
    if (nodes !== undefined) updates.nodes = JSON.stringify(nodes);
    if (edges !== undefined) updates.edges = JSON.stringify(edges);
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
    const workflow = await workflowDB.createWorkflow({
      name: name || 'Imported Workflow',
      nodes: JSON.stringify(nodes || []),
      edges: JSON.stringify(edges || []),
      description,
    });
    res.json(parseWorkflow(workflow));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
