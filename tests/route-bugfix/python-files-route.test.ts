import assert from 'node:assert/strict';
import { existsSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import express from 'express';
import test from 'node:test';
import pythonRoutes from '../../server/routes/python.js';

test('Python file routes upload, list, view, download, and delete a project file', async () => {
  const projectId = `route_test_${randomBytes(6).toString('hex')}`;
  const projectDir = resolve(process.cwd(), 'data', 'python-files', projectId);
  const app = express();
  app.use('/api/python', pythonRoutes);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolveServer, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolveServer(listener));
    listener.once('error', reject);
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}/api/python/projects/${projectId}/files`;
    const body = new FormData();
    body.append('files', new Blob(['hello from Python files'], { type: 'text/plain' }), 'sample.txt');
    const uploaded = await fetch(base, { method: 'POST', body });
    assert.equal(uploaded.status, 200);
    const list = await fetch(base);
    assert.equal(list.status, 200);
    assert.equal((await list.json()).files[0].filename, 'sample.txt');
    const view = await fetch(`${base}/sample.txt/view`);
    assert.equal(view.status, 200);
    assert.equal((await view.json()).content, 'hello from Python files');
    const download = await fetch(`${base}/sample.txt/download`);
    assert.equal(download.status, 200);
    assert.equal(await download.text(), 'hello from Python files');
    assert.equal((await fetch(`${base}/sample.txt`, { method: 'DELETE' })).status, 200);
    assert.equal((await fetch(`${base}/sample.txt/view`)).status, 404);
    const percentBody = new FormData();
    percentBody.append('files', new Blob(['percent name']), '100%.txt');
    assert.equal((await fetch(base, { method: 'POST', body: percentBody })).status, 200);
    const percentPath = encodeURIComponent('100%.txt');
    assert.equal((await fetch(`${base}/${percentPath}/view`)).status, 200);
    assert.equal((await fetch(`${base}/${percentPath}/download`)).status, 200);
    assert.equal((await fetch(`${base}/${percentPath}`, { method: 'DELETE' })).status, 200);
    assert.equal((await fetch(`${base}/${encodeURIComponent('../outside.txt')}/view`)).status, 404);
  } finally {
    await new Promise<void>((resolveServer, reject) => server.close(error => error ? reject(error) : resolveServer()));
    if (existsSync(projectDir)) {
      for (const name of readdirSync(projectDir)) unlinkSync(join(projectDir, name));
      rmdirSync(projectDir);
    }
  }
});
