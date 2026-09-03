import { Router, Request, Response } from 'express';
import { getAll, getOne, run, runReturning } from '../db/pg';
import { randomBytes } from 'crypto';

const router = Router();

function safeJsonParse(str: string, fallback: any): any {
  try { return JSON.parse(str); } catch { return fallback; }
}

function rowToNote(row: any) {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon || '📄',
    coverUrl: row.cover_url || undefined,
    parentId: row.parent_id || null,
    sortOrder: row.sort_order,
    blocks: safeJsonParse(row.blocks_json, []),
    isFavorite: row.is_favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildTree(rows: any[]): any[] {
  const map = new Map<string, any>();
  const roots: any[] = [];

  for (const row of rows) {
    const note = rowToNote(row);
    note.children = [];
    map.set(note.id, note);
  }

  for (const row of rows) {
    const note = map.get(row.id)!;
    if (row.parent_id && map.has(row.parent_id)) {
      map.get(row.parent_id)!.children.push(note);
    } else {
      roots.push(note);
    }
  }

  const sortChildren = (nodes: any[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const n of nodes) sortChildren(n.children);
  };
  sortChildren(roots);

  return roots;
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await getAll('SELECT * FROM notes ORDER BY sort_order ASC');
    const tree = buildTree(rows);
    res.json({ notes: tree });
  } catch (error: any) {
    console.error('[notes GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/flat', async (_req: Request, res: Response) => {
  try {
    const rows = await getAll('SELECT * FROM notes ORDER BY sort_order ASC');
    const notes = rows.map(rowToNote);
    res.json({ notes });
  } catch (error: any) {
    console.error('[notes/flat GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const row = await getOne('SELECT * FROM notes WHERE id = $1', [req.params.id]);
    if (!row) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    res.json({ note: rowToNote(row) });
  } catch (error: any) {
    console.error('[notes/:id GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, icon, parentId, blocks } = req.body;
    const id = randomBytes(8).toString('hex');
    const blocksJson = JSON.stringify(blocks || [{ id: randomBytes(4).toString('hex'), type: 'paragraph', content: '' }]);

    let sortOrder = 0;
    if (parentId) {
      const maxOrder = await getOne('SELECT MAX(sort_order) as max_order FROM notes WHERE parent_id = $1', [parentId]) as any;
      sortOrder = (maxOrder?.max_order ?? -1) + 1;
    } else {
      const maxOrder = await getOne('SELECT MAX(sort_order) as max_order FROM notes WHERE parent_id IS NULL') as any;
      sortOrder = (maxOrder?.max_order ?? -1) + 1;
    }

    const row = await runReturning(
      'INSERT INTO notes (id, title, icon, parent_id, sort_order, blocks_json) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, title || 'Untitled', icon || '📄', parentId || null, sortOrder, blocksJson]
    );

    res.json({ note: rowToNote(row) });
  } catch (error: any) {
    console.error('[notes POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await getOne('SELECT * FROM notes WHERE id = $1', [req.params.id]) as any;
    if (!existing) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const { title, icon, coverUrl, parentId, sortOrder, blocks, isFavorite } = req.body;
    const newTitle = title !== undefined ? title : existing.title;
    const newIcon = icon !== undefined ? icon : existing.icon;
    const newCoverUrl = coverUrl !== undefined ? coverUrl : existing.cover_url;
    const newParentId = parentId !== undefined ? parentId : existing.parent_id;
    const newSortOrder = sortOrder !== undefined ? sortOrder : existing.sort_order;
    const newBlocksJson = blocks !== undefined ? JSON.stringify(blocks) : existing.blocks_json;
    const newIsFavorite = isFavorite !== undefined ? isFavorite : existing.is_favorite;

    await run(
      'UPDATE notes SET title = $1, icon = $2, cover_url = $3, parent_id = $4, sort_order = $5, blocks_json = $6, is_favorite = $7, updated_at = NOW() WHERE id = $8',
      [newTitle, newIcon, newCoverUrl, newParentId, newSortOrder, newBlocksJson, newIsFavorite, req.params.id]
    );

    const row = await getOne('SELECT * FROM notes WHERE id = $1', [req.params.id]);
    res.json({ note: rowToNote(row) });
  } catch (error: any) {
    console.error('[notes/:id PUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await run('DELETE FROM notes WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('[notes/:id DELETE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/move', async (req: Request, res: Response) => {
  try {
    const { parentId, sortOrder } = req.body;
    const existing = await getOne('SELECT * FROM notes WHERE id = $1', [req.params.id]) as any;
    if (!existing) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    await run(
      'UPDATE notes SET parent_id = $1, sort_order = $2, updated_at = NOW() WHERE id = $3',
      [parentId || null, sortOrder ?? existing.sort_order, req.params.id]
    );

    const row = await getOne('SELECT * FROM notes WHERE id = $1', [req.params.id]);
    res.json({ note: rowToNote(row) });
  } catch (error: any) {
    console.error('[notes/:id/move PUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/batch/reorder', async (req: Request, res: Response) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) {
      res.status(400).json({ error: 'order must be an array of { id, sortOrder }' });
      return;
    }

    for (const item of order) {
      if (item.id && typeof item.sortOrder === 'number') {
        await run('UPDATE notes SET sort_order = $1, updated_at = NOW() WHERE id = $2', [item.sortOrder, item.id]);
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[notes/batch/reorder PUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
