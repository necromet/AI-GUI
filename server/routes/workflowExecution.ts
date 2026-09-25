import { Router, type Response } from 'express';
import * as workflowDB from '../db/workflows.js';
import { WorkflowExecutor } from '../services/workflowExecutor.js';
import { nanoid } from 'nanoid';
import { parseWorkflow, getApiKeys } from './workflowHelpers.js';
import { normalizeWorkflowGraph, validateWorkflowGraph } from '../../lib/workflow/graph.js';
import { canExecutePublishedWorkflow } from '../../lib/workflow/auth.js';

const router = Router();

function writeEvent(res: Response, event: any) {
  if (res.writableEnded || res.destroyed) return;
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function setupSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

function preflight(nodes: any[], edges: any[]) {
  const normalized = normalizeWorkflowGraph(nodes, edges);
  const issues = validateWorkflowGraph(normalized.nodes, normalized.edges);
  return { ...normalized, issues, valid: !issues.some(issue => issue.severity === 'error') };
}

function validateExecutionInput(nodes: any[], input: any): string | null {
  const start = nodes.find(node => (node.data?.nodeType || node.type) === 'start');
  const definitions = Array.isArray(start?.data?.inputVariables) ? start.data.inputVariables : [];
  for (const definition of definitions) {
    const value = input && typeof input === 'object' ? input[definition.name] : undefined;
    if (definition.required && (value === undefined || value === null || value === '')) return `Missing required input "${definition.name}"`;
  }
  return null;
}

function hasExecutionAccess(req: any, workflow: any): boolean {
  return canExecutePublishedWorkflow(req.headers.authorization as string | undefined, workflow);
}

function conversationIdFrom(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value) ? value : undefined;
}

router.post('/:id/validate', async (req, res) => {
  try {
    const workflow = await workflowDB.getWorkflow(req.params.id);
    if (!workflow) { res.status(404).json({ error: 'Workflow not found' }); return; }
    if (!hasExecutionAccess(req, workflow)) { res.status(401).json({ error: 'Invalid workflow API key' }); return; }
    const parsed = parseWorkflow(workflow);
    const result = preflight(parsed.nodes, parsed.edges);
    res.json({ valid: result.valid, issues: result.issues });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/execute', async (req, res) => {
  try {
    const workflow = await workflowDB.getWorkflow(req.params.id);
    if (!workflow) { res.status(404).json({ error: 'Workflow not found' }); return; }
    if (!hasExecutionAccess(req, workflow)) { res.status(401).json({ error: 'Invalid workflow API key' }); return; }
    const parsed = parseWorkflow(workflow);
    const checked = preflight(parsed.nodes, parsed.edges);
    if (!checked.valid) {
      res.status(422).json({ error: 'Workflow validation failed', code: 'workflow_invalid', issues: checked.issues });
      return;
    }
    const executionInput = req.body.input ?? req.body ?? {};
    const inputError = validateExecutionInput(checked.nodes, executionInput);
    if (inputError) { res.status(422).json({ error: inputError, code: 'workflow_input_invalid' }); return; }

    const executionId = `exec_${nanoid(10)}`;
    const threadId = `thread_${executionId}`;
    const conversationId = conversationIdFrom(req.body?.conversationId) || executionId;
    const snapshot = { name: parsed.name, nodes: checked.nodes, edges: checked.edges };
    await workflowDB.createExecution({ id: executionId, workflowId: workflow.id, input: executionInput, threadId, conversationId, workflowSnapshot: snapshot });
    const executor = new WorkflowExecutor(checked.nodes, checked.edges, { executionId, threadId, workflowId: workflow.id, conversationId, llmKeys: await getApiKeys() });
    const events: any[] = [];
    let status = 'running';
    let accumulatedResults: Record<string, any> = {};
    let accumulatedVariables: Record<string, any> = {};

    for await (const event of executor.executeStream(executionInput)) {
      events.push(event);
      if (event.type === 'state_update') {
        accumulatedResults = { ...accumulatedResults, ...(event.state?.nodeResults || {}) };
        accumulatedVariables = { ...accumulatedVariables, ...(event.state?.variables || {}) };
      }
      if (event.type === 'workflow_paused') status = 'paused';
      else if (event.type === 'workflow_completed') status = 'completed';
      else if (event.type === 'error') status = 'failed';
    }

    const last = events[events.length - 1];
    await workflowDB.updateExecution(executionId, {
      status,
      node_results: last?.state?.nodeResults || accumulatedResults,
      variables: last?.state?.variables || accumulatedVariables,
      output: last?.state?.variables?.lastOutput ?? accumulatedVariables.lastOutput,
      pending_action: last?.pendingAction || null,
      error: last?.type === 'error' ? last.error : null,
      completed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
    });
    res.status(status === 'failed' ? 500 : 200).json({ executionId, threadId, status, events });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/execute-stream', async (req, res) => {
  try {
    const workflow = await workflowDB.getWorkflow(req.params.id);
    if (!workflow) { res.status(404).json({ error: 'Workflow not found' }); return; }
    if (!hasExecutionAccess(req, workflow)) { res.status(401).json({ error: 'Invalid workflow API key' }); return; }
    const parsed = parseWorkflow(workflow);
    const checked = preflight(parsed.nodes, parsed.edges);
    if (!checked.valid) {
      res.status(422).json({ error: 'Workflow validation failed', code: 'workflow_invalid', issues: checked.issues });
      return;
    }
    const executionInput = req.body.input ?? {};
    const inputError = validateExecutionInput(checked.nodes, executionInput);
    if (inputError) { res.status(422).json({ error: inputError, code: 'workflow_input_invalid' }); return; }

    const executionId = `exec_${nanoid(10)}`;
    const threadId = `thread_${executionId}`;
    const conversationId = conversationIdFrom(req.body?.conversationId) || executionId;
    const snapshot = { name: parsed.name, nodes: checked.nodes, edges: checked.edges };
    await workflowDB.createExecution({ id: executionId, workflowId: workflow.id, input: executionInput, threadId, conversationId, workflowSnapshot: snapshot });
    setupSSE(res);
    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abortController.abort();
    });

    const executor = new WorkflowExecutor(checked.nodes, checked.edges, {
      executionId,
      threadId,
      workflowId: workflow.id,
      conversationId,
      llmKeys: await getApiKeys(),
      signal: abortController.signal,
      onNodeUpdate: (nodeId, status, data) => {
        const event = { type: `node_${status}`, nodeId, data, executionId, threadId };
        writeEvent(res, event);
        void workflowDB.createExecutionLog({ executionId, nodeId, eventType: event.type, data }).catch(() => {});
      },
    });
    let accumulatedResults: Record<string, any> = {};
    let accumulatedVariables: Record<string, any> = {};

    for await (const event of executor.executeStream(executionInput)) {
      writeEvent(res, event);
      if (event.type === 'state_update') {
        accumulatedResults = { ...accumulatedResults, ...(event.state?.nodeResults || {}) };
        accumulatedVariables = { ...accumulatedVariables, ...(event.state?.variables || {}) };
        await workflowDB.updateExecution(executionId, {
          current_node_id: event.nodeId,
          node_results: accumulatedResults,
          variables: accumulatedVariables,
        });
      } else if (event.type === 'workflow_paused') {
        await workflowDB.updateExecution(executionId, { status: 'paused', pending_action: event.pendingAction || null });
        if (event.pendingAction?.kind === 'approval') {
          await workflowDB.createApproval({
            approvalId: event.pendingAction.approvalId,
            workflowId: workflow.id,
            executionId,
            nodeId: event.pendingAction.nodeId,
            message: event.pendingAction.message,
          }).catch(() => {});
        }
      } else if (event.type === 'workflow_completed') {
        await workflowDB.updateExecution(executionId, {
          status: 'completed',
          node_results: event.state?.nodeResults || {},
          variables: event.state?.variables || {},
          output: event.state?.variables?.lastOutput,
          pending_action: null,
          completed_at: new Date().toISOString(),
        });
      } else if (event.type === 'error') {
        await workflowDB.updateExecution(executionId, { status: 'failed', error: event.error, completed_at: new Date().toISOString() });
      }
    }

    if (!res.writableEnded && !res.destroyed) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error: any) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
    else {
      writeEvent(res, { type: 'error', error: error.message });
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

router.post('/:id/execute-engine', (req, res) => {
  res.redirect(307, `/api/workflows/${req.params.id}/execute-stream`);
});

router.post('/:id/resume', async (req, res) => {
  try {
    const { executionId, approved, data } = req.body;
    const execution = await workflowDB.getExecution(executionId);
    if (!execution || execution.workflow_id !== req.params.id) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }
    if (execution.status !== 'paused') {
      res.status(409).json({ error: 'Execution is not paused' });
      return;
    }

    const snapshot = typeof execution.workflow_snapshot === 'string' ? JSON.parse(execution.workflow_snapshot) : execution.workflow_snapshot;
    if (!snapshot?.nodes || !snapshot?.edges) {
      res.status(409).json({ error: 'This execution has no resumable workflow snapshot' });
      return;
    }
    setupSSE(res);
    const threadId = execution.checkpoint_thread_id || execution.thread_id;
    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abortController.abort();
    });
    const executor = new WorkflowExecutor(snapshot.nodes, snapshot.edges, {
      executionId,
      threadId,
      workflowId: execution.workflow_id,
      conversationId: execution.conversation_id || execution.id,
      llmKeys: await getApiKeys(),
      signal: abortController.signal,
      onNodeUpdate: (nodeId, status, nodeData) => writeEvent(res, { type: `node_${status}`, nodeId, data: nodeData, executionId, threadId }),
    });
    await workflowDB.updateExecution(executionId, { status: 'running', resumed_at: new Date().toISOString(), pending_action: null });
    let accumulatedResults = typeof execution.node_results === 'string' ? JSON.parse(execution.node_results) : (execution.node_results || {});
    let accumulatedVariables = typeof execution.variables === 'string' ? JSON.parse(execution.variables) : (execution.variables || {});

    for await (const event of executor.executeStream({}, { resume: { approved: approved !== false, data } })) {
      writeEvent(res, event);
      if (event.type === 'state_update') {
        accumulatedResults = { ...accumulatedResults, ...(event.state?.nodeResults || {}) };
        accumulatedVariables = { ...accumulatedVariables, ...(event.state?.variables || {}) };
        await workflowDB.updateExecution(executionId, { current_node_id: event.nodeId, node_results: accumulatedResults, variables: accumulatedVariables });
      } else if (event.type === 'workflow_paused') {
        await workflowDB.updateExecution(executionId, { status: 'paused', pending_action: event.pendingAction || null });
      } else if (event.type === 'workflow_completed') {
        await workflowDB.updateExecution(executionId, {
          status: 'completed', node_results: event.state?.nodeResults || {}, variables: event.state?.variables || {},
          output: event.state?.variables?.lastOutput, pending_action: null, completed_at: new Date().toISOString(),
        });
      } else if (event.type === 'error') {
        await workflowDB.updateExecution(executionId, { status: 'failed', error: event.error, completed_at: new Date().toISOString() });
      }
    }

    const pending = typeof execution.pending_action === 'string' ? JSON.parse(execution.pending_action) : execution.pending_action;
    if (pending?.approvalId) await workflowDB.respondApproval(pending.approvalId, approved === false ? 'rejected' : 'approved').catch(() => {});
    if (!res.writableEnded && !res.destroyed) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error: any) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
    else {
      writeEvent(res, { type: 'error', error: error.message });
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

router.get('/:id/executions', async (req, res) => {
  try {
    const executions = await workflowDB.getExecutionsByWorkflow(req.params.id);
    res.json(executions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/executions/:executionId', async (req, res) => {
  try {
    const execution = await workflowDB.getExecution(req.params.executionId);
    if (!execution) { res.status(404).json({ error: 'Execution not found' }); return; }
    res.json({ ...execution, logs: await workflowDB.getExecutionLogs(req.params.executionId) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
