import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { isSafeProjectFilename, resolveProjectFile } from '../../server/lib/pythonFilePath.js';

test('project file lookup accepts files and rejects missing, directories, and traversal', () => {
  const root = mkdtempSync(join(tmpdir(), 'edward-python-files-'));
  const project = join(root, 'project');
  mkdirSync(project);
  writeFileSync(join(project, 'plot.png'), 'image');
  writeFileSync(join(root, 'outside.txt'), 'private');
  try {
    assert.equal(resolveProjectFile(project, 'plot.png'), join(project, 'plot.png'));
    assert.equal(resolveProjectFile(project, 'missing.txt'), null);
    assert.equal(resolveProjectFile(project, '.'), null);
    assert.equal(resolveProjectFile(project, '../outside.txt'), null);
    assert.equal(resolveProjectFile(project, '..\\outside.txt'), null);
    assert.equal(resolveProjectFile(project, 'project'), null);
    assert.equal(isSafeProjectFilename('plot.png'), true);
    assert.equal(isSafeProjectFilename('file:stream'), false);
    try {
      symlinkSync(join(root, 'outside.txt'), join(project, 'linked.txt'));
      assert.equal(resolveProjectFile(project, 'linked.txt'), null);
    } catch (error: any) {
      if (error.code !== 'EPERM' && error.code !== 'EACCES') throw error;
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
