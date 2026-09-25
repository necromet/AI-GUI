import { Router, type Response } from 'express';
import { nanoid } from 'nanoid';
import * as workflowDB from '../db/workflows.js';
import { WorkflowExecutor } from '../services/workflowExecutor.js';
import { normalizeWorkflowGraph, validateWorkflowGraph } from '../../lib/workflow/graph.js';
import { getApiKeys, parseWorkflow } from './workflowHelpers.js';

const router = Router();
const MAX_MESSAGE_LENGTH = 10_000;
const MAX_HISTORY_MESSAGES = 20;

function setupSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

function writeEvent(res: Response, event: Record<string, unknown>) {
  if (!res.writableEnded && !res.destroyed) res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function normalizeHistory(value: unknown): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
    .slice(-MAX_HISTORY_MESSAGES)
    .map(item => ({ role: item.role, content: item.content.slice(0, MAX_MESSAGE_LENGTH) }));
}

function executionInputForMessage(nodes: any[], message: string): any {
  const startNode = nodes.find(node => (node.data?.nodeType || node.type) === 'start');
  const inputs = Array.isArray(startNode?.data?.inputVariables) ? startNode.data.inputVariables : [];
  if (inputs.length === 0) return message;
  if (inputs.length === 1) return { [inputs[0].name]: message };

  const preferred = inputs.find((input: any) => ['message', 'input', 'prompt', 'query'].includes(String(input.name).toLowerCase())) || inputs[0];
  return { [preferred.name]: message, message, input: message };
}

function outputToMarkdown(value: any): string {
  let current = value;
  for (let depth = 0; depth < 4 && current && typeof current === 'object' && !Array.isArray(current); depth++) {
    if ('finalOutput' in current) current = current.finalOutput;
    else if ('output' in current) current = current.output;
    else if ('result' in current) current = current.result;
    else break;
  }
  if (typeof current === 'string') return current;
  if (current === undefined || current === null) return 'The workflow completed without returning a response.';
  return `\`\`\`json\n${JSON.stringify(current, null, 2)}\n\`\`\``;
}

router.get('/:token', async (req, res) => {
  try {
    const workflow = await workflowDB.getWorkflowByShareToken(req.params.token);
    if (!workflow) { res.status(404).json({ error: 'This shared chat is unavailable.' }); return; }
    const parsed = parseWorkflow(workflow);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      name: parsed.name,
      description: parsed.description || `Chat with ${parsed.name}`,
      updatedAt: parsed.updatedAt,
      suggestions: [
        'What can you help me with?',
        'Give me a quick overview of your capabilities.',
        'Help me get started with a task.',
      ],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:token/chat', async (req, res) => {
  try {
    const workflow = await workflowDB.getWorkflowByShareToken(req.params.token);
    if (!workflow) { res.status(404).json({ error: 'This shared chat is unavailable.' }); return; }

    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) { res.status(400).json({ error: 'Message is required.' }); return; }
    if (message.length > MAX_MESSAGE_LENGTH) { res.status(413).json({ error: 'Message is too long.' }); return; }

    const parsed = parseWorkflow(workflow);
    const normalized = normalizeWorkflowGraph(parsed.nodes, parsed.edges);
    const issues = validateWorkflowGraph(normalized.nodes, normalized.edges);
    const firstError = issues.find(issue => issue.severity === 'error');
    if (firstError) { res.status(422).json({ error: `This workflow cannot run: ${firstError.message}` }); return; }
    const blockedDatabase = normalized.nodes.find(node => (node.data?.nodeType || node.type) === 'database' && node.data?.dataSource === 'postgres' && node.data?.allowSharedChat !== true);
    if (blockedDatabase) { res.status(403).json({ error: 'This workflow contains a PostgreSQL query that is not approved for shared chat.' }); return; }

    const input = executionInputForMessage(normalized.nodes, message);
    const executionId = `exec_${nanoid(10)}`;
    const threadId = `shared_${nanoid(16)}`;
    const conversationId = typeof req.body?.conversationId === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(req.body.conversationId) ? req.body.conversationId : executionId;
    const snapshot = { name: parsed.name, nodes: normalized.nodes, edges: normalized.edges };
    await workflowDB.createExecution({ id: executionId, workflowId: workflow.id, input, threadId, conversationId, workflowSnapshot: snapshot });

    setupSSE(res);
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });

    const labels = new Map(normalized.nodes.map(node => [node.id, String(node.data?.label || node.data?.nodeName || node.type)]));
    const executor = new WorkflowExecutor(normalized.nodes, normalized.edges, {
      executionId,
      threadId,
      workflowId: workflow.id,
      conversationId,
      llmKeys: await getApiKeys(),
      signal: controller.signal,
      onNodeUpdate: (nodeId, status) => {
        writeEvent(res, { type: 'progress', status, label: labels.get(nodeId) || 'Workflow step' });
      },
    });

    let finalOutput: any;
    let finalError: string | null = null;
    let finalStatus = 'running';
    writeEvent(res, { type: 'status', status: 'running' });

    for await (const event of executor.executeStream(input, { initialChatHistory: normalizeHistory(req.body?.history) })) {
      if (event.type === 'workflow_completed') {
        finalOutput = event.state?.variables?.lastOutput;
        finalStatus = 'completed';
      } else if (event.type === 'workflow_paused') {
        finalError = 'This workflow requires an approval step that is not available in shared chat.';
        finalStatus = 'paused';
      } else if (event.type === 'error') {
        finalError = event.error || 'Workflow execution failed.';
        finalStatus = 'failed';
      }
    }

    await workflowDB.updateExecution(executionId, {
      status: finalStatus,
      output: finalOutput,
      error: finalError,
      completed_at: finalStatus === 'completed' || finalStatus === 'failed' ? new Date().toISOString() : null,
    });

    if (finalError) writeEvent(res, { type: 'error', error: finalError });
    else writeEvent(res, { type: 'message', content: outputToMarkdown(finalOutput), executionId });
    if (!res.writableEnded && !res.destroyed) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error: any) {
    if (!res.headersSent) res.status(500).json({ error: error.message || 'Shared chat failed.' });
    else {
      writeEvent(res, { type: 'error', error: error.message || 'Shared chat failed.' });
      if (!res.writableEnded && !res.destroyed) res.end();
    }
  }
});

export default router;
