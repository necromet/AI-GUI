import { Router, Request, Response } from 'express';
import express from 'express';
import {
  chatCompletion,
  detectLanguage,
  buildLanguageInstruction,
  ChatMessage,
} from '../services/mimoService';
import {
  buildToolSystemPrompt,
  executeTool,
  parseToolCalls,
  AVAILABLE_TOOLS,
  buildSkemaSystemPrompt,
  analyzeImages,
} from '../services/agentService';
import { runAgentLoopSafe } from '../lib/agentRunner';
import { buildSystemPrompt, sendSSEError } from '../lib/sseHelpers';

const router = Router();
const MAX_AGENT_ITERATIONS = 5;

router.post('/chat', express.json({ limit: '5mb' }), async (req: Request, res: Response) => {
  try {
    const { messages, tools = [], model, provider, systemInstruction, stream = true, max_tokens, context, systemPromptAppend } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Missing messages' });
      return;
    }

    const userQuery = messages[messages.length - 1]?.content || '';
    const detectedLang = detectLanguage(userQuery);
    const langInstruction = buildLanguageInstruction(detectedLang);

    const hasSkemaTools = tools.includes('edit_html') || tools.includes('generate_html') || tools.includes('edit_spec') || tools.includes('generate_spec');

    if (hasSkemaTools && context?.images?.length > 0 && !context.imageAnalysis) {
      context.imageAnalysis = await analyzeImages(context.images, model, provider);
    }

    const skemaPrompt = hasSkemaTools ? buildSkemaSystemPrompt(context) : '';
    const toolPrompt = !hasSkemaTools && tools.length > 0 ? buildToolSystemPrompt(tools) : '';
    const systemPrompt = buildSystemPrompt(skemaPrompt, systemInstruction, toolPrompt, systemPromptAppend, langInstruction);

    const apiMessagesForConvert: any[] = messages.map((msg: any) => ({
      ...msg,
      role: msg.role === 'model' ? 'assistant' : msg.role,
    }));

    if (stream) {
      const toolResults: any[] = [];

      const wrappedExecute = async (call: any, emitEvent: (event: any) => void) => {
        const onProgress = (chunk: string) => {
          emitEvent({ tool_progress: { name: call.name, chunk } });
        };
        const result = await executeTool(call, context, onProgress);
        toolResults.push(result);

        if (call.name === 'edit_html' && !result.error) {
          try {
            const parsed = JSON.parse(result.output);
            if (parsed.html) context.currentHtml = parsed.html;
          } catch {}
        }
        if (call.name === 'generate_html' && !result.error && result.output) {
          context.currentHtml = result.output;
        }
        if (call.name === 'generate_spec' && !result.error && result.output) {
          try { context.currentSpec = JSON.parse(result.output); } catch {}
        }
        if (call.name === 'edit_spec' && !result.error && result.output) {
          try { context.currentSpec = JSON.parse(result.output); } catch {}
        }

        return result;
      };

      await runAgentLoopSafe({
        req,
        res,
        systemPrompt,
        messages: apiMessagesForConvert,
        convertMessages: (msgs) => msgs.map(m => ({ role: m.role, content: m.content || '' })),
        executeTool: wrappedExecute,
        model,
        provider,
        max_tokens,
        maxRounds: MAX_AGENT_ITERATIONS,
        logTag: 'agent',
      });
    } else {
      const toolResults: any[] = [];
      let iteration = 0;
      let finalAnswer = '';

      const apiMessages: ChatMessage[] = [];
      apiMessages.push({ role: 'system', content: systemPrompt });
      for (const msg of apiMessagesForConvert) {
        apiMessages.push({ role: msg.role, content: msg.content });
      }

      while (iteration < MAX_AGENT_ITERATIONS) {
        iteration++;

        const data = await chatCompletion({
          model: model || 'mimo-v2.5',
          messages: apiMessages,
          stream: false,
          thinking: { type: 'disabled' },
        }, provider);

        finalAnswer = data.choices?.[0]?.message?.content || '';

        if (tools.length === 0) break;

        const toolCalls = parseToolCalls(finalAnswer);
        if (toolCalls.length === 0) break;

        apiMessages.push({ role: 'assistant', content: finalAnswer });

        for (const call of toolCalls) {
          const result = await executeTool(call, context);
          toolResults.push(result);

          if (call.name === 'edit_html' && !result.error) {
            try {
              const parsed = JSON.parse(result.output);
              if (parsed.html) context.currentHtml = parsed.html;
            } catch {}
          }
          if (call.name === 'generate_html' && !result.error && result.output) {
            context.currentHtml = result.output;
          }
          if (call.name === 'generate_spec' && !result.error && result.output) {
            try { context.currentSpec = JSON.parse(result.output); } catch {}
          }
          if (call.name === 'edit_spec' && !result.error && result.output) {
            try { context.currentSpec = JSON.parse(result.output); } catch {}
          }

          const toolMsg = result.error
            ? `[Tool: ${result.name}] Error: ${result.error}`
            : `[Tool: ${result.name}] Result:\n${result.output}`;
          apiMessages.push({ role: 'user', content: toolMsg });
        }
      }

      res.json({ answer: finalAnswer, toolResults });
    }
  } catch (error: any) {
    console.error('[agent/chat] Error:', error.message);
    if (res.headersSent) {
      sendSSEError(res, error.message);
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.get('/tools', (_req: Request, res: Response) => {
  res.json({ tools: AVAILABLE_TOOLS });
});

export default router;
