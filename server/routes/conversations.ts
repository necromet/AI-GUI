import { Router, Request, Response } from 'express';
import * as convDb from '../db/conversations';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string | undefined;
    const conversations = type ? await convDb.getConversationsByType(type) : await convDb.getConversations();
    res.json({ conversations });
  } catch (error: any) {
    console.error('[conversations GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const conversation = await convDb.getConversationById(Number(req.params.id));
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json({ conversation });
  } catch (error: any) {
    console.error('[conversations/:id] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { model_id, title, type } = req.body;
    if (!model_id) {
      res.status(400).json({ error: 'Missing required field: model_id' });
      return;
    }
    const id = await convDb.createConversation(model_id, title || null, type || 'chat');
    res.json({ id });
  } catch (error: any) {
    console.error('[conversations POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { title } = req.body;
    if (!title) {
      res.status(400).json({ error: 'Missing required field: title' });
      return;
    }
    await convDb.updateConversationTitle(id, title);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[conversations PUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await convDb.deleteConversation(Number(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error('[conversations DELETE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
