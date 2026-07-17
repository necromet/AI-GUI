import { Router, Request, Response } from 'express';
import { executePython } from '../services/pythonExecutor';

const router = Router();

const SAFE_PACKAGE_RE = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;

router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { code, requirements } = req.body;
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Missing required field: code' });
      return;
    }

    let safeReqs: string[] | undefined;
    if (requirements && Array.isArray(requirements)) {
      safeReqs = requirements.filter((r: any) => typeof r === 'string' && SAFE_PACKAGE_RE.test(r));
      if (safeReqs.length === 0) safeReqs = undefined;
    }

    const result = await executePython(code, safeReqs);
    res.json(result);
  } catch (error: any) {
    console.error('[python/execute POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
