import { Router } from 'express';
import * as workflowDB from '../db/workflows.js';
import { WorkflowExecutor } from '../services/workflowExecutor.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const workflows = await workflowDB.getWorkflows();
    res.json(workflows.map(parseWorkflow));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/mcp-servers', async (_req, res) => {
  try {
    const servers = await workflowDB.getMCPServers();
    res.json(servers);
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
    const { name, nodes, edges } = req.body;
    const workflow = await workflowDB.createWorkflow({
      name: name || 'Untitled Workflow',
      nodes: JSON.stringify(nodes || []),
      edges: JSON.stringify(edges || []),
    });
    res.json(parseWorkflow(workflow));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, nodes, edges, description } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (nodes !== undefined) updates.nodes = JSON.stringify(nodes);
    if (edges !== undefined) updates.edges = JSON.stringify(edges);
    if (description !== undefined) updates.description = description;
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

router.post('/:id/execute-stream', async (req, res) => {
  try {
    const workflow = await workflowDB.getWorkflow(req.params.id);
    if (!workflow) { res.status(404).json({ error: 'Not found' }); return; }

    const parsed = parseWorkflow(workflow);
    const executionId = await workflowDB.createExecution({ workflowId: workflow.id, input: JSON.stringify(req.body) });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const executor = new WorkflowExecutor(parsed.nodes, parsed.edges, {
      onNodeUpdate: (nodeId, status, data) => {
        res.write(`data: ${JSON.stringify({ type: `node_${status}`, nodeId, data })}\n\n`);
      },
      executionId,
    });

    for await (const event of executor.executeStream(req.body.input || {})) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      if (event.type === 'completed') {
        await workflowDB.updateExecution(executionId, {
          status: 'completed',
          completed_at: new Date().toISOString(),
        });
      } else if (event.type === 'paused') {
        await workflowDB.updateExecution(executionId, { status: 'paused' });
      } else if (event.type === 'error') {
        await workflowDB.updateExecution(executionId, {
          status: 'failed',
          error: event.error,
          completed_at: new Date().toISOString(),
        });
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

router.post('/:id/resume', async (req, res) => {
  try {
    const { executionId, approved } = req.body;
    const execution = await workflowDB.getExecution(executionId);
    if (!execution) { res.status(404).json({ error: 'Execution not found' }); return; }

    if (execution.thread_id) {
      await workflowDB.respondApproval(execution.thread_id, approved ? 'approved' : 'rejected');
    }

    res.json({ success: true, status: approved ? 'approved' : 'rejected' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function parseWorkflow(row: any) {
  const nodesRaw = typeof row.nodes === 'string' ? row.nodes : JSON.stringify(row.nodes);
  const edgesRaw = typeof row.edges === 'string' ? row.edges : JSON.stringify(row.edges);
  const tagsRaw = typeof row.tags === 'string' ? row.tags : JSON.stringify(row.tags || '[]');
  return {
    id: row.id,
    customId: row.custom_id,
    name: row.name,
    description: row.description,
    category: row.category,
    tags: JSON.parse(tagsRaw),
    nodes: JSON.parse(nodesRaw),
    edges: JSON.parse(edgesRaw),
    isTemplate: row.is_template === true || row.is_template === 1,
    isPublic: row.is_public === true || row.is_public === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default router;
