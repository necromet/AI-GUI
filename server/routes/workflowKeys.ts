import { Router } from 'express';
import * as workflowDB from '../db/workflows.js';
import { nanoid } from 'nanoid';

const router = Router();

router.get('/config', async (_req, res) => {
  try {
    const keys = await workflowDB.getUserLLMKeys();
    const providers = keys.map(k => ({ provider: k.provider, hasKey: true, keyPrefix: k.key_prefix }));
    const envProviders = [
      { provider: 'mimo', hasKey: !!process.env.MIMO_API_KEY, source: 'env' },
      { provider: 'mimo-direct', hasKey: !!process.env.MIMO_DIRECT_API_KEY, source: 'env' },
      { provider: 'deepseek', hasKey: !!process.env.DEEPSEEK_API_KEY, source: 'env' },
      { provider: 'anthropic', hasKey: !!process.env.ANTHROPIC_API_KEY, source: 'env' },
      { provider: 'openai', hasKey: !!process.env.OPENAI_API_KEY, source: 'env' },
      { provider: 'groq', hasKey: !!process.env.GROQ_API_KEY, source: 'env' },
      { provider: 'firecrawl', hasKey: !!process.env.FIRECRAWL_API_KEY, source: 'env' },
      { provider: 'arcade', hasKey: !!process.env.ARCADE_API_KEY, source: 'env' },
    ];
    res.json({ providers: [...providers, ...envProviders] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/keys', async (_req, res) => {
  try {
    const keys = await workflowDB.getUserLLMKeys();
    res.json(keys.map(k => ({ id: k.id, provider: k.provider, keyPrefix: k.key_prefix, isActive: k.is_active })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/keys', async (req, res) => {
  try {
    const { provider, apiKey } = req.body;
    if (!provider || !apiKey) { res.status(400).json({ error: 'provider and apiKey required' }); return; }
    const key = await workflowDB.saveUserLLMKey({
      id: `key_${nanoid(10)}`,
      provider,
      encryptedKey: Buffer.from(apiKey).toString('base64'),
      keyPrefix: apiKey.slice(0, 8) + '...',
    });
    res.json({ id: key.id, provider: key.provider, keyPrefix: key.key_prefix, isActive: key.is_active });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/keys/:id', async (req, res) => {
  try {
    await workflowDB.deleteUserLLMKey(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
