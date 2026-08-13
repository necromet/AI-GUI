import { Router, Request, Response } from 'express';
import * as library from '../services/libraryService';
import { SEED_LIBRARY_COMPONENTS } from '../data/seedLibraryComponents';
import { compileComponent } from '../services/tsxCompiler';
import { setVerifyResult } from '../services/verifyService';

const router = Router();

router.get('/components', async (req: Request, res: Response) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const folderId = typeof req.query.folderId === 'string' ? req.query.folderId : undefined;
    const unfoldered = req.query.unfoldered === 'true';
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 24;
    const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : 0;
    const result = await library.listComponents({
      category,
      folderId: unfoldered ? null : folderId,
      limit: isNaN(limit) ? 24 : limit,
      offset: isNaN(offset) ? 0 : offset,
    });
    res.json({ components: result.components, total: result.total, hasMore: result.hasMore });
  } catch (error: any) {
    console.error('[library/components GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/components/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await library.getCategories();
    res.json({ categories });
  } catch (error: any) {
    console.error('[library/components/categories GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/components/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await library.getStats();
    res.json(stats);
  } catch (error: any) {
    console.error('[library/components/stats GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/components/:id', async (req: Request, res: Response) => {
  try {
    const component = await library.getComponent(req.params.id);
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
    const { name, category, contentType, description, tags, content, metadata, thumbnail, isGlobal, agentAccessible, files, folderId } = req.body;
    if (!name || !category) {
      res.status(400).json({ error: 'Missing required fields: name, category' });
      return;
    }

    let primaryContent = content || '';
    let primaryContentType = contentType || 'html';

    if (files && files.length > 0) {
      const entryFile = files.find((f: any) => f.isEntry) || files.find((f: any) => f.filename.endsWith('.html')) || files[0];
      primaryContent = entryFile.content || '';
      primaryContentType = entryFile.contentType || 'html';
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
      folderId: folderId || null,
      files: files || undefined,
    });
    res.json({ component });
  } catch (error: any) {
    console.error('[library/components POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/components/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const original = await library.getComponent(req.params.id);
    if (!original) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }
    const files = original.files ? original.files.map(f => ({
      filename: f.filename,
      contentType: f.contentType,
      content: f.content,
      sortOrder: f.sortOrder,
      isEntry: f.isEntry,
    })) : undefined;

    const dup = await library.addComponent({
      name: `${original.name} (Copy)`,
      category: original.category,
      contentType: original.contentType,
      description: original.description,
      tags: original.tags,
      content: original.content,
      metadata: original.metadata,
      thumbnail: original.thumbnail,
      isGlobal: original.isGlobal,
      agentAccessible: original.agentAccessible,
      folderId: original.folderId,
      files,
    });
    res.json({ component: dup });
  } catch (error: any) {
    console.error('[library/components/:id/duplicate] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/components/:id', async (req: Request, res: Response) => {
  try {
    const updated = await library.updateComponent(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }
    compiledCache.delete(req.params.id);
    res.json({ component: updated });
  } catch (error: any) {
    console.error('[library/components/:id PUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/components/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await library.deleteComponent(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }
    compiledCache.delete(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[library/components/:id DELETE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const compiledCache = new Map<string, { js: string; updatedAt: string }>();

router.get('/components/:id/compiled', async (req: Request, res: Response) => {
  try {
    const comp = await library.getComponent(req.params.id);
    if (!comp) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }

    const files = comp.files;
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'Component has no files' });
      return;
    }

    const cacheKey = comp.id;
    const cached = compiledCache.get(cacheKey);
    if (cached && cached.updatedAt === comp.updatedAt) {
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(cached.js);
      return;
    }

    const js = await compileComponent(files);
    compiledCache.set(cacheKey, { js, updatedAt: comp.updatedAt });
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(js);
  } catch (error: any) {
    console.error('[library/components/:id/compiled] Error:', error.message);
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(`throw new Error(${JSON.stringify('Compilation error: ' + error.message)});`);
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
    const existing = await library.listComponents({ limit: 1 });
    if (existing.total > 0) {
      res.json({ success: true, message: `Library already has ${existing.total} components. Skipped seeding.`, count: 0 });
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

// ===== Folder Routes =====

router.get('/folders', async (_req: Request, res: Response) => {
  try {
    const folders = await library.listFolders();
    res.json({ folders });
  } catch (error: any) {
    console.error('[library/folders GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/folders/:id', async (req: Request, res: Response) => {
  try {
    const folder = await library.getFolder(req.params.id);
    if (!folder) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }
    res.json({ folder });
  } catch (error: any) {
    console.error('[library/folders/:id GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/folders/:id/components', async (req: Request, res: Response) => {
  try {
    const components = await library.getComponentsInFolder(req.params.id);
    res.json({ components });
  } catch (error: any) {
    console.error('[library/folders/:id/components GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/folders', async (req: Request, res: Response) => {
  try {
    const { name, description, color, icon, agentAccessible } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Missing required field: name' });
      return;
    }
    const folder = await library.addFolder({
      name,
      description: description || '',
      color: color || '#6366f1',
      icon: icon || 'folder',
      sortOrder: 0,
      agentAccessible: agentAccessible !== false,
    });
    res.json({ folder });
  } catch (error: any) {
    console.error('[library/folders POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/folders/:id', async (req: Request, res: Response) => {
  try {
    const updated = await library.updateFolder(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }
    res.json({ folder: updated });
  } catch (error: any) {
    console.error('[library/folders/:id PUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/folders/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await library.deleteFolder(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('[library/folders/:id DELETE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/components/:id/move', async (req: Request, res: Response) => {
  try {
    const { folderId } = req.body;
    const moved = await library.moveComponentToFolder(req.params.id, folderId ?? null);
    if (!moved) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('[library/components/:id/move POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/agent/session/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const session = await library.getSession(id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ session });
  } catch (error: any) {
    console.error('[library/agent/session GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/agent/sessions/:componentId', async (req: Request, res: Response) => {
  try {
    const componentId = req.params.componentId as string;
    const sessions = await library.getSessionsByComponent(componentId);
    res.json({ sessions });
  } catch (error: any) {
    console.error('[library/agent/sessions GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/agent/sessions', async (req: Request, res: Response) => {
  try {
    const { componentId } = req.body;
    if (!componentId) {
      res.status(400).json({ error: 'Missing componentId' });
      return;
    }
    const session = await library.createSession(componentId);
    res.json({ session });
  } catch (error: any) {
    console.error('[library/agent/sessions POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/agent/sessions/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { messages, title } = req.body;
    const existing = await library.getSession(id);
    if (!existing) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    if (messages) {
      await library.updateSessionMessages(id, messages);
    }
    if (title) {
      await library.updateSessionTitle(id, title);
    }
    const updated = await library.getSession(id);
    res.json({ session: updated });
  } catch (error: any) {
    console.error('[library/agent/sessions PUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/agent/sessions/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const deleted = await library.deleteSession(id);
    if (!deleted) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('[library/agent/sessions DELETE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/agent/verify-result', async (req: Request, res: Response) => {
  try {
    const { componentId, errors, success } = req.body;
    if (!componentId) {
      res.status(400).json({ error: 'Missing componentId' });
      return;
    }
    setVerifyResult(componentId, errors || [], success !== false);
    res.json({ ok: true });
  } catch (error: any) {
    console.error('[library/agent/verify-result POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
