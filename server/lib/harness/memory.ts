import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveSafePath } from './workspace';

const MAX_MEMORY_READ = 20_000;

export interface MemorySearchResult {
  file: string;
  line: number;
  text: string;
}

export async function readMemoryFile(workspaceRoot: string, fileName: string): Promise<string> {
  const abs = resolveSafePath(workspaceRoot, fileName);
  try {
    const buf = await fs.readFile(abs, 'utf8');
    return buf.length > MAX_MEMORY_READ ? buf.slice(0, MAX_MEMORY_READ) + '\n...[truncated]' : buf;
  } catch {
    return '';
  }
}

export async function appendMemoryFile(
  workspaceRoot: string,
  fileName: string,
  content: string,
): Promise<string> {
  const abs = resolveSafePath(workspaceRoot, fileName);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const existing = await readMemoryFile(workspaceRoot, fileName);
  const entry = existing ? '\n\n' + content : content;
  await fs.writeFile(abs, existing + entry, 'utf8');
  return 'Appended to ' + fileName;
}

export async function searchMemoryFiles(
  workspaceRoot: string,
  query: string,
  opts: { maxResults?: number; caseInsensitive?: boolean } = {},
): Promise<MemorySearchResult[]> {
  const maxResults = opts.maxResults ?? 20;
  const files = ['MEMORY.md', 'notes.md'];
  const results: MemorySearchResult[] = [];
  const flags = opts.caseInsensitive !== false ? 'i' : '';

  let re: RegExp;
  try {
    re = new RegExp(query, flags);
  } catch {
    return results;
  }

  for (const file of files) {
    const content = await readMemoryFile(workspaceRoot, file);
    if (!content) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (results.length >= maxResults) break;
      if (re.test(lines[i])) {
        results.push({ file, line: i + 1, text: lines[i].slice(0, 300) });
      }
    }
  }

  return results;
}

export async function getMemorySummary(workspaceRoot: string): Promise<string> {
  const memory = await readMemoryFile(workspaceRoot, 'MEMORY.md');
  const notes = await readMemoryFile(workspaceRoot, 'notes.md');
  const parts: string[] = [];
  if (memory.trim()) {
    parts.push('MEMORY.md:\n' + memory.slice(0, 2000));
  }
  if (notes.trim()) {
    parts.push('notes.md:\n' + notes.slice(0, 1000));
  }
  return parts.join('\n\n') || '';
}