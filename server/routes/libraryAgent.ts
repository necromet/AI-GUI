import { Router } from 'express';
import { createLibraryAgent } from '../../lib/agent/agent';
import { detectLanguage, buildLanguageInstruction } from '../services/mimoService';
import * as library from '../services/libraryService';

const router = Router();

function buildComponentContext(comp: any): string {
  const fileNames = (comp.files || []).map((f: any) => f.filename).join(', ');
  return `CURRENT COMPONENT CONTEXT:
- Name: ${comp.name}
- ID: ${comp.id}
- Category: ${comp.category}
- Description: ${comp.description}
- Tags: ${(comp.tags || []).join(', ')}
- Files: ${fileNames}

The user is currently editing this component. Use read_component with ID "${comp.id}" to see the current file contents before making changes.`;
}

function parseToolOutputAsJson(output: unknown): Record<string, any> | null {
  if (typeof output === 'string') {
    try {
      return JSON.parse(output);
    } catch {
      return null;
    }
  }
  if (typeof output === 'object' && output !== null) {
    return output as Record<string, any>;
  }
  return null;
}

function emitSpecialToolEvents(res: any, toolName: string, output: unknown) {
  if (toolName === 'create_component') {
    const parsed = parseToolOutputAsJson(output);
    if (parsed?.componentId) {
      const comp = library.getComponent(parsed.componentId);
      if (comp) res.write(`data: ${JSON.stringify({ component_created: comp })}\n\n`);
    }
  }

  if (toolName === 'write_component_file') {
    const parsed = parseToolOutputAsJson(output);
    if (parsed?.componentId) {
      const comp = library.getComponent(parsed.componentId);
      if (comp) res.write(`data: ${JSON.stringify({ component_updated: comp })}\n\n`);
    }
  }

  if (toolName === 'create_todo_list') {
    const parsed = parseToolOutputAsJson(output);
    if (parsed?.todo_list && parsed?.tasks) {
      res.write(`data: ${JSON.stringify({ todo_list: parsed.tasks })}\n\n`);
    }
  }

  if (toolName === 'verify_component') {
    const parsed = parseToolOutputAsJson(output);
    if (parsed?.verify_component) {
      res.write(`data: ${JSON.stringify({ verify_component: { componentId: parsed.componentId } })}\n\n`);
    }
  }

  if (toolName === 'ask_user') {
    const parsed = parseToolOutputAsJson(output);
    if (parsed?.ask_user) {
      res.write(`data: ${JSON.stringify({ ask_user: { question: parsed.question } })}\n\n`);
    }
  }
}

router.post('/chat', async (req, res) => {
  try {
    const { messages, model, provider, max_tokens, componentId } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Missing messages' });
      return;
    }

    let componentContext = '';
    if (componentId) {
      const comp = library.getComponent(componentId);
      if (comp) componentContext = buildComponentContext(comp);
    }

    const userQuery = messages[messages.length - 1]?.content || '';
    const detectedLang = detectLanguage(userQuery);
    const langInstruction = buildLanguageInstruction(detectedLang);

    const systemPrompt = [
      componentContext,
      langInstruction,
    ].filter(Boolean).join('\n\n');

    const modelMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    for (const msg of messages) {
      const role = msg.role === 'model' ? 'assistant' : msg.role;
      modelMessages.push({ role, content: msg.content });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const agent = createLibraryAgent(model || 'mimo-v2.5', {
      provider,
      maxTokens: max_tokens || undefined,
    });

    const toolResults: any[] = [];
    let previousText = '';

    const streamResult = await agent.stream({
      messages: modelMessages,
      onStepEnd: (step) => {
        if (step.text) {
          const deltaText = step.text.startsWith(previousText)
            ? step.text.slice(previousText.length)
            : step.text;
          previousText = step.text;
          if (deltaText) {
            console.log(`[agent] text:\n${deltaText.trim()}`);
            res.write(`data: ${JSON.stringify({ content: deltaText })}\n\n`);
          }
        }
        if (step.reasoningText) {
          console.log(`[agent] reasoning:\n${step.reasoningText.trim()}`);
          res.write(`data: ${JSON.stringify({ reasoning: step.reasoningText })}\n\n`);
        }
        for (const tc of step.toolCalls) {
          console.log(`[agent] tool_call: ${tc.toolName}(${JSON.stringify(tc.input)})`);
          res.write(`data: ${JSON.stringify({
            tool_call: { name: tc.toolName, arguments: tc.input },
          })}\n\n`);
        }
        for (const tr of step.toolResults) {
          const outputStr = typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output);
          const truncated = outputStr.length > 300 ? outputStr.slice(0, 300) + '...' : outputStr;
          console.log(`[agent] tool_result: ${tr.toolName} => ${truncated}`);
          const resultEntry = {
            name: tr.toolName,
            input: tr.input,
            output: outputStr,
            error: undefined as string | undefined,
          };
          toolResults.push(resultEntry);
          res.write(`data: ${JSON.stringify({ tool_result: resultEntry })}\n\n`);
          emitSpecialToolEvents(res, tr.toolName, tr.output);
        }
      },
    });

    for await (const _part of streamResult.stream) {
      // all emission handled by onStepEnd callback
    }

    if (toolResults.length > 0) {
      res.write(`data: ${JSON.stringify({ tool_summary: toolResults })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('[library-agent/chat] Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

export default router;
