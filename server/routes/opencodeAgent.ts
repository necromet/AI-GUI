import { Router } from 'express';
import { startOpenCode, getAuth, getBaseUrl } from '../services/opencodeSidecar.js';

const router = Router();

router.use(async (_req, res, next) => {
  try {
    await startOpenCode();
    next();
  } catch (err) {
    console.error('[opencode-agent] Sidecar failed:', err);
    res.status(503).json({ error: 'OpenCode sidecar unavailable' });
  }
});

router.post('/session', async (req, res) => {
  try {
    const resp = await fetch(`${getBaseUrl()}/session`, {
      method: 'POST',
      headers: {
        'Authorization': getAuth(),
        'Content-Type': 'application/json',
        'x-opencode-directory': process.cwd(),
      },
      body: JSON.stringify(req.body),
    });
    res.status(resp.status).json(await resp.json());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/session', async (req, res) => {
  try {
    const url = new URL(`${getBaseUrl()}/session`);
    url.searchParams.set('directory', process.cwd());
    const resp = await fetch(url.toString(), {
      headers: { 'Authorization': getAuth() },
    });
    res.status(resp.status).json(await resp.json());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/session/:id/message', async (req, res) => {
  try {
    const url = new URL(`${getBaseUrl()}/session/${req.params.id}/message`);
    url.searchParams.set('directory', process.cwd());
    const resp = await fetch(url.toString(), {
      headers: { 'Authorization': getAuth() },
    });
    res.status(resp.status).json(await resp.json());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/session/:id/prompt', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sessionId = req.params.id;
  let eventController: AbortController | null = null;

  try {
    // Start listening to global events BEFORE sending the prompt
    eventController = new AbortController();
    const eventResp = await fetch(`${getBaseUrl()}/global/event?directory=${encodeURIComponent(process.cwd())}`, {
      headers: { 'Authorization': getAuth() },
      signal: eventController.signal,
    });

    if (!eventResp.body) {
      res.write('data: {"error":"No event stream"}\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const eventReader = eventResp.body.getReader();
    const decoder = new TextDecoder();

    // Send the prompt (fire-and-forget)
    const promptResp = await fetch(`${getBaseUrl()}/session/${sessionId}/prompt_async`, {
      method: 'POST',
      headers: {
        'Authorization': getAuth(),
        'Content-Type': 'application/json',
        'x-opencode-directory': process.cwd(),
      },
      body: JSON.stringify(req.body),
    });

    if (!promptResp.ok) {
      const errText = await promptResp.text();
      res.write(`data: {"error":"Prompt failed: ${errText}"}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      eventController.abort();
      return;
    }

    // Stream events filtered by session ID
    req.on('close', () => {
      eventController?.abort();
    });

    let eventBuffer = '';
    let done = false;

    while (!done) {
      const { done: streamDone, value } = await eventReader.read();
      if (streamDone) break;

      eventBuffer += decoder.decode(value, { stream: true });
      const lines = eventBuffer.split('\n');
      eventBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();

        try {
          const parsed = JSON.parse(data);
          const payload = parsed.payload || parsed;

          // Filter: only forward events for this session
          if (parsed.directory && parsed.directory !== process.cwd()) continue;

          // Forward relevant events
          const eventType = payload.type || '';

          if (eventType === 'session.idle' && (payload.sessionID === sessionId || payload.id === sessionId)) {
            done = true;
            break;
          }

          if (eventType === 'session.error' && (payload.sessionID === sessionId || payload.id === sessionId)) {
            res.write(`data: ${JSON.stringify({ error: payload.error || 'Session error' })}\n\n`);
            done = true;
            break;
          }

          // Forward text, tool, and reasoning events
          if (
            eventType.startsWith('text') ||
            eventType.startsWith('reasoning') ||
            eventType.startsWith('tool') ||
            eventType === 'message.updated' ||
            eventType === 'message.part.updated' ||
            eventType === 'message.part.delta'
          ) {
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      res.write(`data: {"error":"${err.message}"}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } finally {
    eventController?.abort();
  }
});

router.post('/session/:id/abort', async (req, res) => {
  try {
    const resp = await fetch(`${getBaseUrl()}/session/${req.params.id}/abort`, {
      method: 'POST',
      headers: {
        'Authorization': getAuth(),
        'x-opencode-directory': process.cwd(),
      },
    });
    res.status(resp.status).json(await resp.json());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/config', async (_req, res) => {
  try {
    const url = new URL(`${getBaseUrl()}/config`);
    url.searchParams.set('directory', process.cwd());
    const resp = await fetch(url.toString(), {
      headers: { 'Authorization': getAuth() },
    });
    res.status(resp.status).json(await resp.json());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/health', async (_req, res) => {
  try {
    const resp = await fetch(`${getBaseUrl()}/global/health`, {
      headers: { 'Authorization': getAuth() },
    });
    res.status(resp.status).json(await resp.json());
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

export default router;
