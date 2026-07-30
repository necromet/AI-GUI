import { Router, Request, Response } from 'express';
import * as stats from '../db/tokenStats';

const router = Router();

router.get('/overall', async (_req: Request, res: Response) => {
  try {
    const data = await stats.getOverallTokenStats();
    res.json(data);
  } catch (error: any) {
    console.error('[stats/overall] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/by-model', async (_req: Request, res: Response) => {
  try {
    const data = await stats.getTokenStatsByModel();
    res.json({ stats: data });
  } catch (error: any) {
    console.error('[stats/by-model] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/by-date', async (req: Request, res: Response) => {
  try {
    const days = Number(req.query.days) || 30;
    const data = await stats.getTokenStatsByDate(days);
    res.json({ stats: data });
  } catch (error: any) {
    console.error('[stats/by-date] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/by-conversation', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const data = await stats.getTokenStatsByConversation(limit);
    res.json({ stats: data });
  } catch (error: any) {
    console.error('[stats/by-conversation] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
