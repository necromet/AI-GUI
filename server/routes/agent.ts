import { Router, Request, Response } from 'express';
import {
  streamChatCompletion,
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
  buildStitchSystemPrompt,
  analyzeImages,
} from '../services/agentService';

const router = Router();
const MAX_AGENT_ITERATIONS = 5;

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, tools = [], model, provider, systemInstruction, stream = true, max_tokens, context, systemPromptAppend } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Missing messages' });
      return;
    }

    const userQuery = messages[messages.length - 1]?.content || '';
    const detectedLang = detectLanguage(userQuery);
    const langInstruction = buildLanguageInstruction(detectedLang);

    const hasStitchTools = tools.includes('edit_html') || tools.includes('generate_html') || tools.includes('edit_spec') || tools.includes('generate_spec');

    if (hasStitchTools && context?.images?.length > 0 && !context.imageAnalysis) {
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ status: 'Analyzing reference images...' })}\n\n`);
      }
      context.imageAnalysis = await analyzeImages(context.images, model, provider);
      if (stream && context.imageAnalysis) {
        res.write(`data: ${JSON.stringify({ status: 'Image analysis complete. Generating design...' })}\n\n`);
      }
    }

    const stitchPrompt = hasStitchTools ? buildStitchSystemPrompt(context) : '';
    const toolPrompt = !hasStitchTools && tools.length > 0 ? buildToolSystemPrompt(tools) : '';

    const apiMessages: ChatMessage[] = [];
    const fullSystem = [stitchPrompt, systemInstruction, toolPrompt, systemPromptAppend, langInstruction].filter(Boolean).join('\n\n');
    apiMessages.push({ role: 'system', content: fullSystem });

    for (const msg of messages) {
      const role = msg.role === 'model' ? 'assistant' : msg.role;
      apiMessages.push({ role, content: msg.content });
    }

    if (stream) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
      }

      const toolResults: any[] = [];
      let iteration = 0;

      while (iteration < MAX_AGENT_ITERATIONS) {
        iteration++;

        const response = await streamChatCompletion({
          model: model || 'mimo-v2.5',
          messages: apiMessages,
          stream: true,
          thinking: { type: 'disabled' },
          ...(max_tokens ? { max_tokens } : {}),
        }, provider);

        if (!response.ok) {
          const errorText = await response.text();
          console.log('[agent/debug] Upstream error:', response.status, errorText.substring(0, 500));
          res.write(`data: ${JSON.stringify({ error: errorText })}\n\n`);
          break;
        }

        console.log('[agent/debug] Upstream response status:', response.status);
        console.log('[agent/debug] Request body model:', model || 'mimo-v2.5');
        console.log('[agent/debug] System prompt length:', fullSystem.length);
        console.log('[agent/debug] Messages count:', apiMessages.length);
        console.log('[agent/debug] System prompt preview:', fullSystem.substring(0, 300));

        const reader = (response.body as any)?.getReader();
        if (!reader) {
          res.write(`data: ${JSON.stringify({ error: 'No response body' })}\n\n`);
          break;
        }

        const decoder = new TextDecoder();
        let fullResponse = '';
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data:')) continue;
              const data = trimmed.slice(5).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                const reasoning = parsed.choices?.[0]?.delta?.reasoning_content;
                const finishReason = parsed.choices?.[0]?.finish_reason;

                if (iteration === 1 && !content && !reasoning) {
                  console.log('[agent/debug] SSE chunk keys:', Object.keys(parsed));
                  console.log('[agent/debug] choices:', JSON.stringify(parsed.choices?.[0]).substring(0, 500));
                }
                if (finishReason) {
                  console.log('[agent/debug] finish_reason:', finishReason);
                }

                if (content) {
                  fullResponse += content;
                  res.write(`data: ${JSON.stringify({ content, reasoning: reasoning || undefined })}\n\n`);
                } else if (reasoning) {
                  res.write(`data: ${JSON.stringify({ content: '', reasoning })}\n\n`);
                }
              } catch {
                // skip malformed
              }
            }
          }
        } catch {
          // client disconnected
        }

        if (tools.length === 0) break;

        const toolCalls = parseToolCalls(fullResponse);
        console.log('[agent/chat] Tools requested:', tools.join(', '));
        console.log('[agent/chat] Model response length:', fullResponse.length);
        console.log('[agent/chat] Model response preview:', fullResponse.substring(0, 500));
        console.log('[agent/chat] Tool calls found:', toolCalls.length);
        if (toolCalls.length === 0) break;

        apiMessages.push({ role: 'assistant', content: fullResponse });

        for (const call of toolCalls) {
          res.write(`data: ${JSON.stringify({ tool_call: { name: call.name, arguments: call.arguments } })}\n\n`);
          const onProgress = (chunk: string) => {
            res.write(`data: ${JSON.stringify({ tool_progress: { name: call.name, chunk } })}\n\n`);
          };
          const result = await executeTool(call, context, onProgress);
          toolResults.push(result);

          if (call.name === 'edit_html' && !result.error) {
            try {
              const parsed = JSON.parse(result.output);
              if (parsed.html) {
                context.currentHtml = parsed.html;
              }
            } catch {}
          }
          if (call.name === 'generate_html' && !result.error && result.output) {
            context.currentHtml = result.output;
          }
          if (call.name === 'generate_spec' && !result.error && result.output) {
            try {
              context.currentSpec = JSON.parse(result.output);
            } catch {}
          }
          if (call.name === 'edit_spec' && !result.error && result.output) {
            try {
              context.currentSpec = JSON.parse(result.output);
            } catch {}
          }

          const toolMsg = result.error
            ? `[Tool: ${result.name}] Error: ${result.error}`
            : `[Tool: ${result.name}] Result:\n${result.output}`;
          apiMessages.push({ role: 'user', content: toolMsg });
          res.write(`data: ${JSON.stringify({ tool_result: result })}\n\n`);
        }
      }

      if (toolResults.length > 0) {
        res.write(`data: ${JSON.stringify({ tool_summary: toolResults })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const toolResults: any[] = [];
      let iteration = 0;
      let finalAnswer = '';

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
              if (parsed.html) {
                context.currentHtml = parsed.html;
              }
            } catch {}
          }
          if (call.name === 'generate_html' && !result.error && result.output) {
            context.currentHtml = result.output;
          }
          if (call.name === 'generate_spec' && !result.error && result.output) {
            try {
              context.currentSpec = JSON.parse(result.output);
            } catch {}
          }
          if (call.name === 'edit_spec' && !result.error && result.output) {
            try {
              context.currentSpec = JSON.parse(result.output);
            } catch {}
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
    res.status(500).json({ error: error.message });
  }
});

router.get('/tools', (_req: Request, res: Response) => {
  res.json({ tools: AVAILABLE_TOOLS });
});

export default router;
