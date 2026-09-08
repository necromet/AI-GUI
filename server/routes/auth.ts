import { Router } from 'express';
import { timingSafeEqual, createHash } from 'crypto';
import { z } from 'zod';

const router = Router();

const VALID_MODES = ['chat', 'rag', 'skema', 'python', 'library', 'database', 'agent-builder', 'notes'] as const;

const MODE_PASSWORDS: Record<string, string | undefined> = {
  chat: process.env.CHAT_PASSWORD,
  rag: process.env.RAG_PASSWORD,
  skema: process.env.SKEMA_PASSWORD,
  python: process.env.PYTHON_PASSWORD,
  library: process.env.LIBRARY_PASSWORD,
  database: process.env.DATABASE_PASSWORD,
  'agent-builder': process.env.AGENT_BUILDER_PASSWORD,
  notes: process.env.NOTES_PASSWORD,
};

const verifySchema = z.object({
  mode: z.enum(VALID_MODES),
  password: z.string().min(1).max(128),
});

function safeCompare(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

router.post('/verify', (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
  }

  const { mode, password } = parsed.data;
  const expectedPassword = MODE_PASSWORDS[mode];

  if (!expectedPassword) {
    return res.status(500).json({ error: 'Password not configured for this mode' });
  }

  if (!safeCompare(password, expectedPassword)) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const session = req.session as any;
  if (!session.unlockedModes) {
    session.unlockedModes = [];
  }
  if (!session.unlockedModes.includes(mode)) {
    session.unlockedModes.push(mode);
  }

  return res.json({ success: true, mode });
});

router.get('/status', (req, res) => {
  const session = req.session as any;
  const unlockedModes: string[] = session?.unlockedModes ?? [];
  return res.json({ unlockedModes });
});

router.post('/logout', (req, res) => {
  req.session.destroy((err: any) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to destroy session' });
    }
    res.clearCookie('edward.sid');
    return res.json({ success: true });
  });
});

export default router;
