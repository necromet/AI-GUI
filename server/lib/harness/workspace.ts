import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DEFAULT_BASE = path.resolve(process.cwd(), 'data', 'agent-workspaces');

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'default';
}

export function workspaceBaseDir(): string {
  return process.env.HARNESS_WORKSPACE_DIR
    ? path.resolve(process.env.HARNESS_WORKSPACE_DIR)
    : DEFAULT_BASE;
}

export function getWorkspaceRoot(agentId: string, sessionId: string): string {
  return path.join(workspaceBaseDir(), sanitizeId(agentId), sanitizeId(sessionId));
}

export async function ensureWorkspace(agentId: string, sessionId: string): Promise<string> {
  const root = getWorkspaceRoot(agentId, sessionId);
  await fs.mkdir(root, { recursive: true });
  await fs.mkdir(path.join(root, '.mimocode', 'skills'), { recursive: true });
  return root;
}

/** Resolve a tool path relative to the workspace root. Throws if it escapes. */
export function resolveSafePath(workspaceRoot: string, relPath: string): string {
  const root = path.resolve(workspaceRoot);
  const cleaned = (relPath || '').trim();
  if (!cleaned) throw new Error('Path is required');

  const abs = path.resolve(root, cleaned);
  const rel = path.relative(root, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Path escapes workspace: ' + relPath);
  }
  return abs;
}

export function toWorkspaceRelative(workspaceRoot: string, absPath: string): string {
  return path.relative(path.resolve(workspaceRoot), absPath).split(path.sep).join('/');
}

export interface WorkspaceEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
}

export async function listWorkspace(
  workspaceRoot: string,
  relPath = '.',
  opts: { maxEntries?: number } = {},
): Promise<WorkspaceEntry[]> {
  const maxEntries = opts.maxEntries ?? 500;
  const abs = resolveSafePath(workspaceRoot, relPath);
  const dirents = await fs.readdir(abs, { withFileTypes: true });
  const entries: WorkspaceEntry[] = [];

  for (const d of dirents.slice(0, maxEntries)) {
    const childRel = toWorkspaceRelative(workspaceRoot, path.join(abs, d.name));
    if (d.isDirectory()) {
      entries.push({ name: d.name, path: childRel, type: 'dir' });
    } else if (d.isFile()) {
      const st = await fs.stat(path.join(abs, d.name));
      entries.push({ name: d.name, path: childRel, type: 'file', size: st.size });
    }
  }

  return entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function walkFiles(
  workspaceRoot: string,
  opts: { maxFiles?: number; skipDirs?: string[] } = {},
): Promise<string[]> {
  const maxFiles = opts.maxFiles ?? 2000;
  const skip = new Set(opts.skipDirs ?? ['node_modules', '.git', 'dist', '.cache']);
  const root = path.resolve(workspaceRoot);
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (out.length >= maxFiles) return;
    let dirents;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of dirents) {
      if (out.length >= maxFiles) return;
      if (d.name.startsWith('.') && d.name !== '.mimocode') continue;
      const abs = path.join(dir, d.name);
      if (d.isDirectory()) {
        if (skip.has(d.name)) continue;
        await walk(abs);
      } else if (d.isFile()) {
        out.push(toWorkspaceRelative(workspaceRoot, abs));
      }
    }
  }

  await walk(root);
  return out;
}

export function newId(): string {
  return randomUUID();
}
