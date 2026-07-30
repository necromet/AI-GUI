import { Router } from 'express';
import { streamText, tool, type CoreMessage } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import { getProviderConfig, detectLanguage, buildLanguageInstruction } from '../services/mimoService';
import {
  buildSkemaSystemPrompt,
  buildToolSystemPrompt,
  AVAILABLE_TOOLS,
  analyzeImages,
  toolExecuteCode,
  toolWebBrowse,
  toolSearchWeb,
  toolEditHtml,
  toolGenerateHtml,
  toolGenerateSpec,
  toolEditSpec,
  type EditOperation,
} from '../services/agentService';
import { buildCanvasTools, buildCanvasSystemPrompt } from '../services/canvasAgentTools';
import * as libraryService from '../services/skemaLibraryService';
import { getAll, getOne, run, runReturning } from '../db/pg';

const router = Router();

function createProvider(providerName?: string) {
  const config = getProviderConfig(providerName);
  return createOpenAICompatible({
    apiKey: config.key,
    baseURL: config.base,
  });
}

function buildSkemaTools(context: Record<string, any>) {
  const tools: Record<string, any> = {};

  if (context.projectType === 'canvas' && context.gridState && context.resolution) {
    Object.assign(tools, buildCanvasTools({
      gridState: context.gridState,
      resolution: context.resolution,
    }));
  }

  tools.search_library = tool({
    description: 'Search the skema component library for reusable components, templates, snippets, and design elements.',
    parameters: z.object({
      query: z.string().describe('Natural language search query'),
      category: z.string().optional().describe('Optional category filter'),
    }),
    execute: async ({ query, category }) => {
      if (!query) return 'Error: No search query provided.';
      const results = await libraryService.searchComponents(query, context.projectType, 5);
      const filtered = category ? results.filter(r => r.category === category) : results;
      if (filtered.length === 0) return `No components found for "${query}".`;
      const summary = filtered.map(r => {
        const desc = r.description.length > 150 ? r.description.substring(0, 150) + '...' : r.description;
        return `[${r.id}] ${r.name} — ${r.category}, ${r.contentType}\n  ${desc}\n  Relevance: ${(r.score * 100).toFixed(0)}%`;
      }).join('\n\n');
      return `Found ${filtered.length} component(s):\n\n${summary}`;
    },
  });

  tools.web_browse = tool({
    description: 'Fetch and extract text content from a URL. Returns the readable text of the webpage.',
    parameters: z.object({
      url: z.string().describe('The URL to fetch'),
    }),
    execute: async ({ url }) => await toolWebBrowse(url),
  });

  tools.execute_code = tool({
    description: 'Execute JavaScript code in a sandboxed environment and return the output. Use console.log() to see results.',
    parameters: z.object({
      code: z.string().describe('JavaScript code to execute'),
    }),
    execute: async ({ code }) => await toolExecuteCode(code),
  });

  tools.search_web = tool({
    description: 'Search the web for information on a topic. Returns relevant search results.',
    parameters: z.object({
      query: z.string().describe('Search query'),
    }),
    execute: async ({ query }) => await toolSearchWeb(query),
  });

  return tools;
}

function convertToCoreMessages(messages: any[]): CoreMessage[] {
  const result: CoreMessage[] = [];

  for (const msg of messages) {
    const role = msg.role === 'model' ? 'assistant' : msg.role;

    if (role === 'user') {
      result.push({ role: 'user', content: msg.content || '' });
    } else if (role === 'assistant') {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const parts: any[] = [];
        if (msg.content) {
          parts.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.tool_calls) {
          let input: any;
          try {
            input = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
          } catch {
            input = {};
          }
          parts.push({
            type: 'tool-call',
            toolCallId: tc.id || `tc_${Math.random().toString(36).slice(2)}`,
            toolName: tc.function.name,
            input,
          });
        }
        result.push({ role: 'assistant', content: parts } as any);
      } else {
        result.push({ role: 'assistant', content: msg.content || '' });
      }
    } else if (role === 'tool') {
      result.push({
        role: 'tool',
        content: [{
          type: 'tool-result',
          toolCallId: msg.tool_call_id || '',
          toolName: msg.tool_name || msg.name || '',
          output: { type: 'text', value: msg.content || '' },
        }],
      } as any);
    }
  }

  return result;
}

router.post('/chat', async (req, res) => {
  try {
    const { messages, tools: requestedTools, model, provider, context = {}, max_tokens, systemPromptAppend } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Missing messages' });
      return;
    }

    const userQuery = messages[messages.length - 1]?.content || '';
    const detectedLang = detectLanguage(userQuery);
    const langInstruction = buildLanguageInstruction(detectedLang);

    const SKEMA_TOOL_NAMES = ['generate_html', 'edit_html', 'generate_spec', 'edit_spec', 'place_component', 'remove_component', 'move_component', 'resize_component', 'update_component', 'regenerate_component'];
    const hasSkemaTools = (requestedTools || []).some((t: string) => SKEMA_TOOL_NAMES.includes(t));

    if (hasSkemaTools && context.images?.length > 0 && !context.imageAnalysis) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.write(`data: ${JSON.stringify({ status: 'Analyzing reference images...' })}\n\n`);
      context.imageAnalysis = await analyzeImages(context.images, model, provider);
      if (context.imageAnalysis) {
        res.write(`data: ${JSON.stringify({ status: 'Image analysis complete. Generating design...' })}\n\n`);
      }
    }

    const isCanvasMode = context.projectType === 'canvas' && context.gridState && context.resolution;
    let systemPrompt: string;
    if (isCanvasMode) {
      systemPrompt = buildCanvasSystemPrompt({
        gridState: context.gridState,
        resolution: context.resolution,
        availableComponents: context.availableComponents,
      });
    } else {
      systemPrompt = hasSkemaTools ? buildSkemaSystemPrompt(context) : buildToolSystemPrompt(requestedTools || []);
    }
    const fullSystem = [systemPrompt, systemPromptAppend, langInstruction].filter(Boolean).join('\n\n');

    const coreMessages = convertToCoreMessages(messages);

    const aiProvider = createProvider(provider);
    const allTools = buildSkemaTools(context);

    const tools = requestedTools && requestedTools.length > 0
      ? Object.fromEntries(Object.entries(allTools).filter(([k]) => (requestedTools as string[]).includes(k)))
      : allTools;

    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
    }

    const emitEvent = (event: any) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    let reqClosed = false;
    req.on('close', () => { reqClosed = true; });

    const aiModel = aiProvider.chatModel(model || 'mimo-v2.5');

    const result = streamText({
      model: aiModel,
      system: fullSystem,
      messages: coreMessages,
      tools,
      maxSteps: 6,
      ...(max_tokens ? { maxTokens: max_tokens } : {}),
    });

    const stream = result.textStream;
    let fullText = '';
    for await (const chunk of stream) {
      if (reqClosed) break;
      fullText += chunk;
      emitEvent({ content: chunk });
    }

    const toolCalls = await result.toolCalls;
    const finishReason = await result.finishReason;

    if (toolCalls && toolCalls.length > 0) {
      for (const tc of toolCalls) {
        emitEvent({ tool_call: { id: tc.toolCallId, name: tc.toolName, arguments: tc.input } });
      }
    }

    const toolResults = await result.toolResults;

    console.log('[skema-agent] complete, text:', fullText.length, 'toolCalls:', toolCalls?.length || 0, 'toolResults:', toolResults?.length || 0, 'finishReason:', finishReason);

    if (toolCalls && toolCalls.length > 0) {
      const resultIds = new Set((toolResults || []).map(r => r.toolCallId));
      for (const tc of toolCalls) {
        if (!resultIds.has(tc.toolCallId)) {
          emitEvent({ tool_result: { toolCallId: tc.toolCallId, name: tc.toolName, output: '', error: 'Tool execution failed (invalid arguments or validation error)' } });
        }
      }
    }

    if (toolResults && toolResults.length > 0) {
      for (const tr of toolResults) {
        const outputStr = typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output);
        emitEvent({ tool_result: { toolCallId: tr.toolCallId, name: tr.toolName, output: outputStr } });

        if (tr.toolName === 'generate_html' && !outputStr.startsWith('Error:') && outputStr.includes('<!DOCTYPE')) {
          emitEvent({ html_generated: outputStr });
        }
        if (tr.toolName === 'edit_html' && !outputStr.startsWith('Error:')) {
          try {
            const parsed = JSON.parse(outputStr);
            if (parsed.html) emitEvent({ html_generated: parsed.html });
          } catch {}
        }
        if (tr.toolName === 'place_component' && !outputStr.startsWith('Error:')) {
          try {
            const comp = JSON.parse(outputStr);
            if (!comp.error) emitEvent({ component_placed: comp });
          } catch {}
        }
        if (tr.toolName === 'remove_component' && !outputStr.startsWith('Error:')) {
          try {
            const result = JSON.parse(outputStr);
            if (result.success) emitEvent({ component_removed: { componentId: result.componentId } });
          } catch {}
        }
        if (['move_component', 'resize_component', 'update_component', 'regenerate_component'].includes(tr.toolName) && !outputStr.startsWith('Error:')) {
          try {
            const comp = JSON.parse(outputStr);
            if (!comp.error) emitEvent({ component_updated: comp });
          } catch {}
        }
      }
    }

    emitEvent({ done: true });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('[skema-agent/chat] Error:', error.message, error.stack?.substring(0, 300));
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message.substring(0, 500) })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

router.get('/tools', (_req, res) => {
  res.json({ tools: AVAILABLE_TOOLS });
});

// ===== Skema Agent Session CRUD =====

interface SkemaAgentSession {
  id: string;
  projectId: string;
  boardIdx: number;
  title: string | null;
  messagesJson: string;
  createdAt: string;
  updatedAt: string;
}

function rowToSkemaSession(row: any): SkemaAgentSession {
  return {
    id: row.id,
    projectId: row.project_id,
    boardIdx: row.board_idx ?? 0,
    title: row.title,
    messagesJson: row.messages_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const MAX_SKEMA_SESSIONS = 20;

router.get('/session/:id', async (req, res) => {
  try {
    const row = await getOne('SELECT * FROM skema_agent_sessions WHERE id = $1', [req.params.id]) as any;
    if (!row) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json({ session: rowToSkemaSession(row) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sessions/:projectId', async (req, res) => {
  try {
    const boardIdx = typeof req.query.boardIdx === 'string' ? parseInt(req.query.boardIdx, 10) : undefined;
    let rows: any[];
    if (boardIdx !== undefined && !isNaN(boardIdx)) {
      rows = await getAll(
        'SELECT * FROM skema_agent_sessions WHERE project_id = $1 AND board_idx = $2 ORDER BY updated_at DESC LIMIT 3',
        [req.params.projectId, boardIdx]
      );
    } else {
      rows = await getAll(
        'SELECT * FROM skema_agent_sessions WHERE project_id = $1 ORDER BY updated_at DESC LIMIT 3',
        [req.params.projectId]
      );
    }
    res.json({ sessions: rows.map(rowToSkemaSession) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sessions', async (req, res) => {
  try {
    const { projectId, boardIdx = 0 } = req.body;
    if (!projectId) { res.status(400).json({ error: 'Missing projectId' }); return; }

    const id = Math.random().toString(36).substring(2, 15);
    const now = new Date().toISOString();

    const existing = await getOne(
      'SELECT COUNT(*) as c FROM skema_agent_sessions WHERE project_id = $1',
      [projectId]
    ) as any;
    if (parseInt(existing.c, 10) >= MAX_SKEMA_SESSIONS) {
      const oldest = await getOne(
        'SELECT id FROM skema_agent_sessions WHERE project_id = $1 ORDER BY updated_at ASC LIMIT 1',
        [projectId]
      ) as any;
      if (oldest) await run('DELETE FROM skema_agent_sessions WHERE id = $1', [oldest.id]);
    }

    await run(
      'INSERT INTO skema_agent_sessions (id, project_id, board_idx, title, messages_json, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, projectId, boardIdx, null, '[]', now, now]
    );

    res.json({ session: { id, projectId, boardIdx, title: null, messagesJson: '[]', createdAt: now, updatedAt: now } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/sessions/:id', async (req, res) => {
  try {
    const { messages, title } = req.body;
    const now = new Date().toISOString();

    const existing = await getOne('SELECT * FROM skema_agent_sessions WHERE id = $1', [req.params.id]) as any;
    if (!existing) { res.status(404).json({ error: 'Session not found' }); return; }

    if (messages) {
      await run('UPDATE skema_agent_sessions SET messages_json = $1, updated_at = $2 WHERE id = $3',
        [JSON.stringify(messages), now, req.params.id]);
    }
    if (title) {
      await run('UPDATE skema_agent_sessions SET title = $1, updated_at = $2 WHERE id = $3',
        [title, now, req.params.id]);
    }

    const updated = await getOne('SELECT * FROM skema_agent_sessions WHERE id = $1', [req.params.id]) as any;
    res.json({ session: rowToSkemaSession(updated) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/sessions/:id', async (req, res) => {
  try {
    const result = await run('DELETE FROM skema_agent_sessions WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
