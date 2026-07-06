import { Router, Request, Response } from 'express';
import { streamChatCompletion, readSSEStream, detectLanguage, buildLanguageInstruction, ChatMessage } from '../services/mimoService';
import * as library from '../services/libraryService';
import { SEED_LIBRARY_COMPONENTS } from '../data/seedLibraryComponents';

const router = Router();

router.get('/components', (req: Request, res: Response) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const components = library.listComponents({ category });
    res.json({ components });
  } catch (error: any) {
    console.error('[library/components GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/components/categories', (_req: Request, res: Response) => {
  try {
    const categories = library.getCategories();
    res.json({ categories });
  } catch (error: any) {
    console.error('[library/components/categories GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/components/stats', (_req: Request, res: Response) => {
  try {
    const stats = library.getStats();
    res.json(stats);
  } catch (error: any) {
    console.error('[library/components/stats GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/components/:id', (req: Request, res: Response) => {
  try {
    const component = library.getComponent(req.params.id);
    if (!component) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }
    res.json({ component });
  } catch (error: any) {
    console.error('[library/components/:id GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/components', async (req: Request, res: Response) => {
  try {
    const { name, category, contentType, description, tags, content, metadata, thumbnail, isGlobal, agentAccessible, files } = req.body;
    if (!name || !category) {
      res.status(400).json({ error: 'Missing required fields: name, category' });
      return;
    }

    let primaryContent = content || '';
    let primaryContentType = contentType || 'html';

    if (files && files.length > 0) {
      const entryFile = files.find((f: any) => f.isEntry) || files.find((f: any) => f.filename.endsWith('.html')) || files[0];
      primaryContent = entryFile.content;
      primaryContentType = entryFile.contentType;
    }

    if (!primaryContent) {
      res.status(400).json({ error: 'Missing content: provide content or files' });
      return;
    }

    const component = await library.addComponent({
      name,
      category,
      contentType: primaryContentType,
      description: description || '',
      tags: tags || [],
      content: primaryContent,
      metadata,
      thumbnail,
      isGlobal: isGlobal !== false,
      agentAccessible: agentAccessible !== false,
      files: files || undefined,
    });
    res.json({ component });
  } catch (error: any) {
    console.error('[library/components POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/components/:id', (req: Request, res: Response) => {
  try {
    const updated = library.updateComponent(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }
    res.json({ component: updated });
  } catch (error: any) {
    console.error('[library/components/:id PUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/components/:id', (req: Request, res: Response) => {
  try {
    const deleted = library.deleteComponent(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('[library/components/:id DELETE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/components/search', async (req: Request, res: Response) => {
  try {
    const { query, topK = 10 } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Missing required field: query' });
      return;
    }
    const results = await library.searchComponents(query, topK);
    res.json({ components: results });
  } catch (error: any) {
    console.error('[library/components/search POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/components/reindex', async (req: Request, res: Response) => {
  try {
    const count = await library.reindexAll();
    res.json({ success: true, count });
  } catch (error: any) {
    console.error('[library/components/reindex POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/components/seed', async (req: Request, res: Response) => {
  try {
    const existing = library.listComponents();
    if (existing.length > 0) {
      res.json({ success: true, message: `Library already has ${existing.length} components. Skipped seeding.`, count: 0 });
      return;
    }

    let count = 0;
    for (const comp of SEED_LIBRARY_COMPONENTS) {
      await library.addComponent({
        ...comp,
        isGlobal: true,
        agentAccessible: true,
      });
      count++;
    }

    res.json({ success: true, message: `Seeded ${count} components`, count });
  } catch (error: any) {
    console.error('[library/components/seed POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const LIBRARY_AGENT_SYSTEM_PROMPT = `You are a component library assistant. You help users find, create, and manage reusable components in the library.

When the user asks for a component:
1. First search the library for existing matches
2. If nothing matches, offer to create a new component
3. When creating, ask for clarification if the description is vague

Available categories: ui-widget, template, snippet, pattern, hook, util, agent-tool
Content types: tsx, html, css, js, json, markdown

Components support MULTIPLE files. Each component can have several files (e.g., index.html + style.css + script.js).
One file must be marked as the entry point (isEntry: true).

Be concise. When showing results, list component names with a one-line description each.
When creating a component, output a JSON block with the component details:

\`\`\`component
{
  "name": "Component Name",
  "category": "ui-widget",
  "description": "What it does",
  "tags": ["tag1", "tag2"],
  "files": [
    { "filename": "index.html", "contentType": "html", "content": "<!DOCTYPE html>...", "isEntry": true },
    { "filename": "style.css", "contentType": "css", "content": "body { ... }" },
    { "filename": "script.js", "contentType": "js", "content": "console.log('hello')" }
  ]
}
\`\`\`

For simple single-file components, you can also use the legacy format:
\`\`\`component
{
  "name": "Component Name",
  "category": "snippet",
  "contentType": "js",
  "description": "What it does",
  "tags": ["tag1"],
  "content": "const x = 1;"
}
\`\`\``;

router.post('/agent/chat', async (req: Request, res: Response) => {
  try {
    const { messages, model, provider, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Missing messages' });
      return;
    }

    const userQuery = messages[messages.length - 1]?.content || '';
    const detectedLang = detectLanguage(userQuery);
    const langInstruction = buildLanguageInstruction(detectedLang);

    const apiMessages: ChatMessage[] = [];
    const fullSystem = [LIBRARY_AGENT_SYSTEM_PROMPT, langInstruction].filter(Boolean).join('\n\n');
    apiMessages.push({ role: 'system', content: fullSystem });

    for (const msg of messages) {
      const role = msg.role === 'model' ? 'assistant' : msg.role;
      apiMessages.push({ role, content: msg.content });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const response = await streamChatCompletion({
      model: model || 'mimo-v2.5',
      messages: apiMessages,
      stream: true,
      thinking: { type: 'disabled' },
      ...(max_tokens ? { max_tokens } : {}),
    }, provider);

    if (!response.ok) {
      const errorText = await response.text();
      res.write(`data: ${JSON.stringify({ error: errorText })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    let fullResponse = '';
    await readSSEStream(response, (chunk) => {
      if (chunk.content) {
        fullResponse += chunk.content;
        res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
      }
    });

    const componentRegex = /```component\s*\n?([\s\S]*?)```/g;
    let match;
    while ((match = componentRegex.exec(fullResponse)) !== null) {
      try {
        const compData = JSON.parse(match[1].trim());
        if (compData.name) {
          const hasFiles = compData.files && Array.isArray(compData.files) && compData.files.length > 0;
          const created = await library.addComponent({
            name: compData.name,
            category: compData.category || 'snippet',
            contentType: compData.contentType || (hasFiles ? compData.files[0].contentType : 'js'),
            description: compData.description || '',
            tags: compData.tags || [],
            content: compData.content || (hasFiles ? compData.files[0].content : ''),
            isGlobal: true,
            agentAccessible: true,
            files: hasFiles ? compData.files : undefined,
          });
          res.write(`data: ${JSON.stringify({ component_created: created })}\n\n`);
        }
      } catch {
        // skip malformed component blocks
      }
    }

    const searchRegex = /```search\s*\n?([\s\S]*?)```/g;
    while ((match = searchRegex.exec(fullResponse)) !== null) {
      try {
        const searchData = JSON.parse(match[1].trim());
        if (searchData.query) {
          const results = await library.searchComponents(searchData.query, searchData.topK || 5);
          res.write(`data: ${JSON.stringify({ search_results: results })}\n\n`);
        }
      } catch {
        // skip malformed search blocks
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('[library/agent/chat] Error:', error.message);
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
