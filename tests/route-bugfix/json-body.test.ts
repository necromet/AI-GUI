import assert from 'node:assert/strict';
import express from 'express';
import test from 'node:test';
import { registerJsonBodyParsers } from '../../server/middleware/jsonBody.js';

test('Skema routes accept their configured JSON sizes and reject larger bodies', async () => {
  const app = express();
  registerJsonBodyParsers(app);
  app.put('/api/skema/projects/:id', (req, res) => res.json({ size: req.body.value.length }));
  app.post('/api/skema/generate-html', (req, res) => res.json({ size: req.body.value.length }));
  app.post('/api/skema-agent/chat', (req, res) => res.json({ size: req.body.value.length }));
  app.post('/api/chat/completions', (req, res) => res.json({ size: req.body.value.length }));
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.status || 500).json({ error: error.message }));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const send = (path: string, size: number, method = 'POST') => fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'x'.repeat(size) }),
    });
    assert.equal((await send('/api/skema/projects/example', 2 * 1024 * 1024, 'PUT')).status, 200);
    assert.equal((await send('/api/skema/projects/example', 11 * 1024 * 1024, 'PUT')).status, 413);
    assert.equal((await send('/api/skema/generate-html', 2 * 1024 * 1024)).status, 200);
    assert.equal((await send('/api/skema/generate-html', 6 * 1024 * 1024)).status, 413);
    assert.equal((await send('/api/skema-agent/chat', 2 * 1024 * 1024)).status, 200);
    assert.equal((await send('/api/chat/completions', 2 * 1024 * 1024)).status, 413);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
