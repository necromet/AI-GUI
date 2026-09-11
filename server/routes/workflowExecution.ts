import { Router } from 'express';
import * as workflowDB from '../db/workflows.js';
import { WorkflowExecutor } from '../services/workflowExecutor.js';
import { createEngine } from '../services/workflowEngine.js';
import { nanoid } from 'nanoid';
import { parseWorkflow, getApiKeys } from './workflowHelpers.js';

const router = Router();

router.post('/:id/execute', async (req, res) => {
  try {
    const workflow = await workflowDB.getWorkflow(req.params.id);
    if (!workflow) { res.status(404).json({ error: 'Not found' }); return; }

    const parsed = parseWorkflow(workflow);
    const executionId = `exec_${nanoid(10)}`;
    await workflowDB.createExecution({ workflowId: workflow.id, input: JSON.stringify(req.body), threadId: executionId });

    const engine = createEngine(parsed.nodes, parsed.edges, {
      apiKeys: await getApiKeys(),
      executionId,
      threadId: executionId,
    });

    const events: any[] = [];
    for await (const event of engine.executeStream(req.body.input || {})) {
      events.push(event);
    }

    const lastState = events[events.length - 1]?.state;
    await workflowDB.updateExecution(executionId, {
      status: 'completed',
      node_results: JSON.stringify(lastState?.nodeResults || {}),
      variables: JSON.stringify(lastState?.variables || {}),
      completed_at: new Date().toISOString(),
    });

    res.json({ executionId, status: 'completed', events });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/execute-stream', async (req, res) => {
  try {
    const workflow = await workflowDB.getWorkflow(req.params.id);
    if (!workflow) { res.status(404).json({ error: 'Not found' }); return; }

    const parsed = parseWorkflow(workflow);
    const executionId = `exec_${nanoid(10)}`;
    await workflowDB.createExecution({ workflowId: workflow.id, input: JSON.stringify(req.body), threadId: executionId });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const executor = new WorkflowExecutor(parsed.nodes, parsed.edges, {
      onNodeUpdate: (nodeId: string, status: string, data?: any) => {
        res.write(`data: ${JSON.stringify({ type: `node_${status}`, nodeId, data })}\n\n`);
      },
      executionId,
      llmKeys: await getApiKeys(),
    });

    for await (const event of executor.executeStream(req.body.input || {})) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      if (event.type === 'completed') {
        await workflowDB.updateExecution(executionId, { status: 'completed', completed_at: new Date().toISOString() });
      } else if (event.type === 'paused') {
        await workflowDB.updateExecution(executionId, { status: 'paused' });
      } else if (event.type === 'error') {
        await workflowDB.updateExecution(executionId, { status: 'failed', error: event.error, completed_at: new Date().toISOString() });
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

router.post('/:id/execute-engine', async (req, res) => {
  try {
    const workflow = await workflowDB.getWorkflow(req.params.id);
    if (!workflow) { res.status(404).json({ error: 'Not found' }); return; }

    const parsed = parseWorkflow(workflow);
    const executionId = `exec_${nanoid(10)}`;
    await workflowDB.createExecution({ workflowId: workflow.id, input: JSON.stringify(req.body), threadId: executionId });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const engine = createEngine(parsed.nodes, parsed.edges, {
      apiKeys: await getApiKeys(),
      executionId,
      threadId: executionId,
      onNodeUpdate: (nodeId: string, result: any) => {
        res.write(`event: node-update\ndata: ${JSON.stringify({ nodeId, ...result })}\n\n`);
      },
    });

    for await (const event of engine.executeStream(req.body.input || {})) {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);

      if (event.type === 'completed') {
        await workflowDB.updateExecution(executionId, {
          status: 'completed',
          node_results: JSON.stringify(event.state?.nodeResults || {}),
          variables: JSON.stringify(event.state?.variables || {}),
          completed_at: new Date().toISOString(),
        });
      } else if (event.type === 'pending_approval') {
        await workflowDB.updateExecution(executionId, { status: 'paused', thread_id: executionId });
      } else if (event.type === 'error') {
        await workflowDB.updateExecution(executionId, { status: 'failed', error: event.error, completed_at: new Date().toISOString() });
      }
    }

    res.write('event: done\ndata: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.write('event: done\ndata: [DONE]\n\n');
      res.end();
    }
  }
});

router.post('/:id/resume', async (req, res) => {
  try {
    const { executionId, approved, data: approvalData } = req.body;
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

router.get('/:id/executions', async (req, res) => {
  try {
    const executions = await workflowDB.getExecutionsByWorkflow(req.params.id);
    res.json(executions.map(e => ({
      ...e,
      node_results: typeof e.node_results === 'string' ? JSON.parse(e.node_results) : e.node_results,
      variables: typeof e.variables === 'string' ? JSON.parse(e.variables) : e.variables,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/executions/:executionId', async (req, res) => {
  try {
    const execution = await workflowDB.getExecution(req.params.executionId);
    if (!execution) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({
      ...execution,
      node_results: typeof execution.node_results === 'string' ? JSON.parse(execution.node_results) : execution.node_results,
      variables: typeof execution.variables === 'string' ? JSON.parse(execution.variables) : execution.variables,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
