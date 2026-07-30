import { Router, Request, Response } from 'express';
import * as modelDb from '../db/models';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const models = await modelDb.getModels();
    res.json({ models });
  } catch (error: any) {
    console.error('[models] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/all', async (_req: Request, res: Response) => {
  try {
    const models = await modelDb.getAllModels();
    res.json({ models });
  } catch (error: any) {
    console.error('[models/all] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const model = await modelDb.getModelById(Number(req.params.id));
    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }
    res.json({ model });
  } catch (error: any) {
    console.error('[models/:id] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, context_window_size, api_key, provider, system_instruction, is_custom } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Missing required field: name' });
      return;
    }
    const id = await modelDb.addModel(
      name,
      description || null,
      context_window_size || null,
      api_key || null,
      provider || null,
      system_instruction || null,
      !!is_custom
    );
    res.json({ id });
  } catch (error: any) {
    console.error('[models POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await modelDb.getModelById(id);
    if (!existing) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }
    const { name, description, context_window_size, api_key, provider, system_instruction, is_custom } = req.body;
    await modelDb.updateModel(
      id,
      name ?? existing.name,
      description ?? existing.description,
      context_window_size ?? existing.context_window_size,
      api_key ?? existing.api_key,
      provider ?? existing.provider,
      system_instruction ?? existing.system_instruction,
      is_custom !== undefined ? !!is_custom : !!existing.is_custom
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error('[models PUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await modelDb.deactivateModel(Number(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error('[models DELETE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
