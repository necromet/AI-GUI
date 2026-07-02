import { Router, Request, Response } from 'express';
import * as msgDb from '../db/messages';

const router = Router();

router.get('/conversations/:conversationId/messages', (req: Request, res: Response) => {
  try {
    const messages = msgDb.getMessagesByConversation(Number(req.params.conversationId));
    res.json({ messages });
  } catch (error: any) {
    console.error('[messages GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/conversations/:conversationId/messages', (req: Request, res: Response) => {
  try {
    const conversationId = Number(req.params.conversationId);
    const { role, content, message_order, token_count, generated_images, prompt_tokens, candidates_tokens, search_annotations, attachments } = req.body;

    if (!role || content === undefined) {
      res.status(400).json({ error: 'Missing required fields: role, content' });
      return;
    }

    const order = message_order ?? msgDb.getNextMessageOrder(conversationId);
    const id = msgDb.addMessage(
      conversationId,
      role,
      content,
      order,
      token_count || null,
      generated_images || null,
      prompt_tokens || null,
      candidates_tokens || null,
      search_annotations || null,
      attachments || null
    );
    res.json({ id });
  } catch (error: any) {
    console.error('[messages POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/messages/:id', (req: Request, res: Response) => {
  try {
    const { content, token_count } = req.body;
    if (content === undefined) {
      res.status(400).json({ error: 'Missing required field: content' });
      return;
    }
    msgDb.updateMessage(Number(req.params.id), content, token_count || null);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[messages PUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/messages/:id', (req: Request, res: Response) => {
  try {
    msgDb.deleteMessage(Number(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error('[messages DELETE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations/:conversationId/next-order', (req: Request, res: Response) => {
  try {
    const order = msgDb.getNextMessageOrder(Number(req.params.conversationId));
    res.json({ nextOrder: order });
  } catch (error: any) {
    console.error('[next-order] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
