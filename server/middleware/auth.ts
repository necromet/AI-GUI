import type { Request, Response, NextFunction } from 'express';

const ROUTE_MODE_MAP: Record<string, string> = {
  '/api/chat': 'chat',
  '/api/conversations': 'chat',
  '/api/db': 'chat',
  '/api/models': 'chat',
  '/api/stats': 'chat',
  '/api/rag': 'rag',
  '/api/skema': 'skema',
  '/api/skema-agent': 'skema',
  '/api/python': 'python',
  '/api/library': 'library',
  '/api/library-agent': 'library',
  '/api/agent/opencode': 'agent-builder',
  '/api/agent-builder': 'agent-builder',
  '/api/workflows': 'agent-builder',
  '/api/database': 'database',
  '/api/notes': 'notes',
};

export function requireModeAuth(req: Request, res: Response, next: NextFunction) {
  const url = req.originalUrl || req.url;
  const isPublishedWorkflowExecution = /^\/api\/workflows\/[^/]+\/execute(?:-stream)?(?:\?|$)/.test(url);
  if (isPublishedWorkflowExecution && req.headers.authorization?.startsWith('Bearer ')) {
    return next();
  }
  const mode = Object.entries(ROUTE_MODE_MAP).find(([prefix]) =>
    url.startsWith(prefix)
  )?.[1];

  if (!mode) return next();

  const unlockedModes: string[] = (req.session as any)?.unlockedModes ?? [];
  if (unlockedModes.includes(mode)) return next();

  return res.status(401).json({ error: 'Authentication required', mode });
}
