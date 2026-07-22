import { Router } from 'express';
import { streamText, tool, type CoreMessage } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import { getProviderConfig, detectLanguage, buildLanguageInstruction } from '../services/mimoService';
import {
  buildStitchSystemPrompt,
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
import * as libraryService from '../services/stitchLibraryService';

const router = Router();

function createProvider(providerName?: string) {
  const config = getProviderConfig(providerName);
  return createOpenAICompatible({
    apiKey: config.key,
    baseURL: config.base,
  });
}

function buildStitchTools(context: Record<string, any>) {
  return {
    generate_html: tool({
      description: 'Generate a complete HTML file from scratch. Pass a brief text description of what to create. If the user already provided full HTML, pass it directly.',
      parameters: z.object({
        prompt: z.string().describe('Text description of the design to generate, OR the full HTML code if already written'),
      }),
      execute: async ({ prompt }) => {
        const promptOrHtml = prompt || '';
        if (/<!doctype|<html/i.test(promptOrHtml)) {
          return promptOrHtml;
        }
        return await toolGenerateHtml(
          promptOrHtml,
          context.layout || '16:9',
          context.boardDescription,
          context.model,
          context.provider,
          context.projectType,
          context.images,
          context.imageAnalysis,
        );
      },
    }),

    edit_html: tool({
      description: 'Apply surgical edits to an HTML document using CSS selectors. Use for incremental changes to existing HTML. Returns the full modified HTML.',
      parameters: z.object({
        edits: z.array(z.object({
          selector: z.string().describe('CSS selector targeting the element(s)'),
          action: z.enum(['style', 'set_attr', 'remove_attr', 'add_class', 'remove_class', 'replace_content', 'insert_before', 'insert_after', 'remove', 'replace']).describe('Edit action to perform'),
          property: z.string().optional().describe('CSS property or attribute name (for style/set_attr/remove_attr)'),
          value: z.string().optional().describe('Value to set (for style/set_attr/add_class/remove_class)'),
          html: z.string().optional().describe('HTML content (for replace_content/insert_before/insert_after/replace)'),
        })).describe('Array of edit operations'),
      }),
      execute: async ({ edits }) => {
        if (!context.currentHtml) return 'Error: No HTML provided to edit. Use generate_html instead.';
        return await toolEditHtml(edits as EditOperation[], context.currentHtml);
      },
    }),

    generate_spec: tool({
      description: 'Generate a JSON design spec for IG content (carousels, stories). Outputs structured JSON, not HTML. Use this for Instagram carousel and story projects.',
      parameters: z.object({
        prompt: z.string().describe('Design description for the IG content'),
        slideCount: z.number().optional().describe('Number of slides (for carousels)'),
      }),
      execute: async ({ prompt, slideCount }) => {
        return await toolGenerateSpec(
          prompt,
          context.layout || '4:5',
          context.projectType || 'ig-carousel',
          slideCount || context.slideCount || context.totalSlides,
          context.model,
          context.provider,
          context.images,
          context.imageAnalysis,
          context.currentSpec,
          context.referenceSpec,
          context.componentContext,
        );
      },
    }),

    edit_spec: tool({
      description: 'Edit specific fields in an existing JSON design spec. Use JSON path notation (e.g. "slides[0].elements[0].text"). Returns the complete updated spec.',
      parameters: z.object({
        edits: z.array(z.object({
          path: z.string().describe('JSON path to the field (e.g. "slides[0].elements[0].text")'),
          value: z.any().describe('New value for the field'),
        })).describe('Array of path/value edits'),
      }),
      execute: async ({ edits }) => {
        if (!context.currentSpec) return 'Error: No current spec to edit. Use generate_spec first.';
        return await toolEditSpec(
          context.currentSpec,
          edits,
          context.layout || '4:5',
          context.model,
          context.provider,
        );
      },
    }),

    search_library: tool({
      description: 'Search the stitch component library for reusable components, templates, snippets, and design elements.',
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
    }),

    web_browse: tool({
      description: 'Fetch and extract text content from a URL. Returns the readable text of the webpage.',
      parameters: z.object({
        url: z.string().describe('The URL to fetch'),
      }),
      execute: async ({ url }) => await toolWebBrowse(url),
    }),

    execute_code: tool({
      description: 'Execute JavaScript code in a sandboxed environment and return the output. Use console.log() to see results.',
      parameters: z.object({
        code: z.string().describe('JavaScript code to execute'),
      }),
      execute: async ({ code }) => await toolExecuteCode(code),
    }),

    search_web: tool({
      description: 'Search the web for information on a topic. Returns relevant search results.',
      parameters: z.object({
        query: z.string().describe('Search query'),
      }),
      execute: async ({ query }) => await toolSearchWeb(query),
    }),
  };
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

    const STITCH_TOOL_NAMES = ['generate_html', 'edit_html', 'generate_spec', 'edit_spec'];
    const hasStitchTools = (requestedTools || []).some((t: string) => STITCH_TOOL_NAMES.includes(t));

    if (hasStitchTools && context.images?.length > 0 && !context.imageAnalysis) {
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

    const systemPrompt = hasStitchTools ? buildStitchSystemPrompt(context) : buildToolSystemPrompt(requestedTools || []);
    const fullSystem = [systemPrompt, systemPromptAppend, langInstruction].filter(Boolean).join('\n\n');

    const coreMessages = convertToCoreMessages(messages);

    const aiProvider = createProvider(provider);
    const allTools = buildStitchTools(context);

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

    console.log('[stitch-agent] complete, text:', fullText.length, 'toolCalls:', toolCalls?.length || 0, 'toolResults:', toolResults?.length || 0, 'finishReason:', finishReason);

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
        if (tr.toolName === 'generate_spec' && !outputStr.startsWith('Error:')) {
          try {
            JSON.parse(outputStr);
            emitEvent({ spec_generated: outputStr });
          } catch {}
        }
        if (tr.toolName === 'edit_spec' && !outputStr.startsWith('Error:')) {
          try {
            JSON.parse(outputStr);
            emitEvent({ spec_generated: outputStr });
          } catch {}
        }
      }
    }

    emitEvent({ done: true });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('[stitch-agent/chat] Error:', error.message, error.stack?.substring(0, 300));
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

// ===== Stitch Agent Session CRUD =====

import { getDatabase } from '../db/index';

interface StitchAgentSession {
  id: string;
  projectId: string;
  boardIdx: number;
  title: string | null;
  messagesJson: string;
  createdAt: string;
  updatedAt: string;
}

function rowToStitchSession(row: any): StitchAgentSession {
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

const MAX_STITCH_SESSIONS = 20;

router.get('/session/:id', (req, res) => {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM stitch_agent_sessions WHERE id = ?').get(req.params.id) as any;
    if (!row) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json({ session: rowToStitchSession(row) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sessions/:projectId', (req, res) => {
  try {
    const db = getDatabase();
    const boardIdx = typeof req.query.boardIdx === 'string' ? parseInt(req.query.boardIdx, 10) : undefined;
    let rows: any[];
    if (boardIdx !== undefined && !isNaN(boardIdx)) {
      rows = db.prepare(
        'SELECT * FROM stitch_agent_sessions WHERE project_id = ? AND board_idx = ? ORDER BY updated_at DESC LIMIT 3'
      ).all(req.params.projectId, boardIdx) as any[];
    } else {
      rows = db.prepare(
        'SELECT * FROM stitch_agent_sessions WHERE project_id = ? ORDER BY updated_at DESC LIMIT 3'
      ).all(req.params.projectId) as any[];
    }
    res.json({ sessions: rows.map(rowToStitchSession) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sessions', (req, res) => {
  try {
    const { projectId, boardIdx = 0 } = req.body;
    if (!projectId) { res.status(400).json({ error: 'Missing projectId' }); return; }

    const db = getDatabase();
    const id = Math.random().toString(36).substring(2, 15);
    const now = new Date().toISOString();

    const existing = db.prepare(
      'SELECT COUNT(*) as c FROM stitch_agent_sessions WHERE project_id = ?'
    ).get(projectId) as any;
    if (existing.c >= MAX_STITCH_SESSIONS) {
      const oldest = db.prepare(
        'SELECT id FROM stitch_agent_sessions WHERE project_id = ? ORDER BY updated_at ASC LIMIT 1'
      ).get(projectId) as any;
      if (oldest) db.prepare('DELETE FROM stitch_agent_sessions WHERE id = ?').run(oldest.id);
    }

    db.prepare(
      'INSERT INTO stitch_agent_sessions (id, project_id, board_idx, title, messages_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, projectId, boardIdx, null, '[]', now, now);

    res.json({ session: { id, projectId, boardIdx, title: null, messagesJson: '[]', createdAt: now, updatedAt: now } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/sessions/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { messages, title } = req.body;
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM stitch_agent_sessions WHERE id = ?').get(req.params.id) as any;
    if (!existing) { res.status(404).json({ error: 'Session not found' }); return; }

    if (messages) {
      db.prepare('UPDATE stitch_agent_sessions SET messages_json = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(messages), now, req.params.id);
    }
    if (title) {
      db.prepare('UPDATE stitch_agent_sessions SET title = ?, updated_at = ? WHERE id = ?')
        .run(title, now, req.params.id);
    }

    const updated = db.prepare('SELECT * FROM stitch_agent_sessions WHERE id = ?').get(req.params.id) as any;
    res.json({ session: rowToStitchSession(updated) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/sessions/:id', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM stitch_agent_sessions WHERE id = ?').run(req.params.id);
    if (result.changes === 0) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
