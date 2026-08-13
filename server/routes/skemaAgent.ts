import { Router } from 'express';
import { streamText } from 'ai';
import { detectLanguage, buildLanguageInstruction } from '../services/mimoService';
import { analyzeImages, AVAILABLE_TOOLS } from '../services/agentService';
import { createProvider, convertToCoreMessages } from '../lib/aiSdk';
import { buildSkemaTools } from '../lib/agent/tools/skemaTools';
import { buildSkemaSystemPrompt } from '../lib/agent/prompts/skemaPrompt';
import * as sessionService from '../services/skemaAgentService';

const router = Router();

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

    const systemPrompt = buildSkemaSystemPrompt(context);
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

// ===== Session CRUD =====

router.get('/session/:id', async (req, res) => {
  try {
    const session = await sessionService.getSession(req.params.id);
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sessions/:projectId', async (req, res) => {
  try {
    const boardIdx = typeof req.query.boardIdx === 'string' ? parseInt(req.query.boardIdx, 10) : undefined;
    const sessions = await sessionService.getSessionsByProject(req.params.projectId, boardIdx);
    res.json({ sessions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sessions', async (req, res) => {
  try {
    const { projectId, boardIdx = 0 } = req.body;
    if (!projectId) { res.status(400).json({ error: 'Missing projectId' }); return; }
    const session = await sessionService.createSession(projectId, boardIdx);
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/sessions/:id', async (req, res) => {
  try {
    const { messages, title } = req.body;
    const session = await sessionService.updateSession(req.params.id, { messages, title });
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/sessions/:id', async (req, res) => {
  try {
    const deleted = await sessionService.deleteSession(req.params.id);
    if (!deleted) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
