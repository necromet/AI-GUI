import type { Request, Response } from 'express';

/**
 * Set standard SSE headers on a response.
 */
export function setupSSEHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
}

/**
 * Create an SSE event emitter that writes JSON-encoded data events.
 * Safely skips writes if the response has already ended.
 */
export function createEmitter(res: Response): (event: any) => void {
  return (event: any) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };
}

/**
 * Set up client disconnect detection.
 * Returns an object whose `isClosed()` method reflects whether the client disconnected.
 */
export function setupCloseDetection(req: Request): { isClosed: () => boolean } {
  let closed = false;
  req.on('close', () => { closed = true; });
  return { isClosed: () => closed };
}

/**
 * Send an error via SSE, handling both pre- and post-header-sent states.
 */
export function sendSSEError(res: Response, error: string): void {
  if (!res.headersSent) {
    res.status(500).json({ error });
  } else {
    try {
      res.write(`data: ${JSON.stringify({ error: error.substring(0, 500) })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch { /* best effort */ }
  }
}

/**
 * Build a system prompt by joining non-empty parts with double newlines.
 */
export function buildSystemPrompt(...parts: (string | undefined | null)[]): string {
  return parts.filter(Boolean).join('\n\n');
}
