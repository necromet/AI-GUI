import { Router } from 'express';
import { processAgent } from '../../lib/agent/processor';
import { LIBRARY_TOOLS } from '../../lib/agent/tools/library';
import { LIBRARY_AGENT_SYSTEM_PROMPT } from '../../lib/agent/prompts/library';
import { LIBRARY_PERMISSIONS } from '../../lib/agent/permission';
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

    const systemPrompt = [LIBRARY_AGENT_SYSTEM_PROMPT, componentContext, langInstruction]
      .filter(Boolean)
      .join('\n\n');

    const userMessages = messages.map((m: any) => ({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: m.content,
    }));

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const toolResults: any[] = [];

    try {
      for await (const event of processAgent(
      {
        model: model || 'mimo-v2.5',
        systemPrompt,
        tools: LIBRARY_TOOLS,
        permissions: LIBRARY_PERMISSIONS,
        maxIterations: 10,
        maxTokens: max_tokens || undefined,
        provider,
      },
      userMessages,
    )) {
      if (event.type === 'text' && event.text) {
        res.write(`data: ${JSON.stringify({ content: event.text })}\n\n`);
      }

      if (event.type === 'reasoning' && event.reasoning) {
        res.write(`data: ${JSON.stringify({ reasoning: event.reasoning })}\n\n`);
      }

      if (event.type === 'tool_start') {
        res.write(`data: ${JSON.stringify({ tool_call: { name: event.toolName, arguments: event.toolArgs } })}\n\n`);
      }

      if (event.type === 'tool_result') {
        const result = { name: event.toolName, input: event.toolArgs || {}, output: event.toolOutput || '', error: event.toolError };
        toolResults.push(result);
        res.write(`data: ${JSON.stringify({ tool_result: result })}\n\n`);

        if (event.toolName === 'create_component' && !event.toolError) {
          try {
            const parsed = JSON.parse(event.toolOutput || '');
            if (parsed.metadata?.componentId) {
              const comp = library.getComponent(parsed.metadata.componentId);
              if (comp) res.write(`data: ${JSON.stringify({ component_created: comp })}\n\n`);
            }
          } catch {}
        }

        if (event.toolName === 'write_component_file' && !event.toolError) {
          try {
            const parsed = JSON.parse(event.toolOutput || '');
            if (parsed.metadata?.componentId) {
              const comp = library.getComponent(parsed.metadata.componentId);
              if (comp) res.write(`data: ${JSON.stringify({ component_updated: comp })}\n\n`);
            }
          } catch {}
        }

        if (event.toolName === 'create_todo_list' && !event.toolError) {
          try {
            const parsed = JSON.parse(event.toolOutput || '');
            if (parsed.todo_list) res.write(`data: ${JSON.stringify({ todo_list: parsed.tasks })}\n\n`);
          } catch {}
        }

        if (event.toolName === 'verify_component' && !event.toolError) {
          try {
            const parsed = JSON.parse(event.toolOutput || '');
            if (parsed.verify_component) {
              res.write(`data: ${JSON.stringify({ verify_component: { componentId: parsed.componentId } })}\n\n`);
            }
          } catch {}
        }

        if (event.toolName === 'ask_user' && !event.toolError) {
          try {
            const parsed = JSON.parse(event.toolOutput || '');
            if (parsed.ask_user) {
              res.write(`data: ${JSON.stringify({ ask_user: { question: parsed.question } })}\n\n`);
            }
          } catch {}
        }
      }

      if (event.type === 'tool_error') {
        const result = { name: event.toolName, input: event.toolArgs || {}, output: '', error: event.toolError };
        toolResults.push(result);
        res.write(`data: ${JSON.stringify({ tool_result: result })}\n\n`);
      }

      if (event.type === 'error') {
        res.write(`data: ${JSON.stringify({ error: event.error })}\n\n`);
      }

      if (event.type === 'done') {
        break;
      }
    }

    if (toolResults.length > 0) {
      res.write(`data: ${JSON.stringify({ tool_summary: toolResults })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
    } catch (streamErr: any) {
      console.error('[library-agent/chat] Stream error:', streamErr.message);
      if (!res.headersSent) {
        res.status(500).json({ error: streamErr.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: streamErr.message })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }
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
