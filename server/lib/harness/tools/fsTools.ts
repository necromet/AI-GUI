import fs from 'node:fs/promises';
import path from 'node:path';
import type { HarnessTool, ToolContext, ToolResult } from '../types';
import { resolveSafePath, walkFiles, toWorkspaceRelative } from '../workspace';
import { globToRegExp } from '../permissions';

const MAX_READ_BYTES = 200_000;
const MAX_OUTPUT_CHARS = 30_000;

function truncate(text: string, max = MAX_OUTPUT_CHARS): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\n…[truncated]';
}

function ok(output: string): ToolResult {
  return { output: truncate(output) };
}

function fail(message: string): ToolResult {
  return { output: '', error: message };
}

async function readTool(args: Record<string, any>, ctx: ToolContext): Promise<ToolResult> {
  try {
    const abs = resolveSafePath(ctx.workspaceRoot, String(args.path || ''));
    const buf = await fs.readFile(abs);
    if (buf.length > MAX_READ_BYTES) {
      return fail(`File too large (${buf.length} bytes). Max ${MAX_READ_BYTES}.`);
    }
    return ok(buf.toString('utf8'));
  } catch (err: any) {
    return fail(err.message);
  }
}

async function writeTool(args: Record<string, any>, ctx: ToolContext): Promise<ToolResult> {
  try {
    const abs = resolveSafePath(ctx.workspaceRoot, String(args.path || ''));
    const content = String(args.content ?? '');
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
    return ok('Wrote ' + toWorkspaceRelative(ctx.workspaceRoot, abs) + ' (' + content.length + ' chars)');
  } catch (err: any) {
    return fail(err.message);
  }
}

async function editTool(args: Record<string, any>, ctx: ToolContext): Promise<ToolResult> {
  try {
    const abs = resolveSafePath(ctx.workspaceRoot, String(args.path || ''));
    const oldStr = String(args.old_string ?? args.oldStr ?? '');
    const newStr = String(args.new_string ?? args.newStr ?? '');
    if (!oldStr) return fail('old_string is required');

    const current = await fs.readFile(abs, 'utf8');
    const count = current.split(oldStr).length - 1;
    if (count === 0) return fail('old_string not found in file');
    if (count > 1 && !args.replace_all) {
      return fail('old_string found ' + count + ' times; pass replace_all=true or a unique string');
    }

    const next = args.replace_all ? current.split(oldStr).join(newStr) : current.replace(oldStr, newStr);
    await fs.writeFile(abs, next, 'utf8');
    return ok('Edited ' + toWorkspaceRelative(ctx.workspaceRoot, abs) + (args.replace_all ? ' (' + count + ' replacements)' : ''));
  } catch (err: any) {
    return fail(err.message);
  }
}

async function globTool(args: Record<string, any>, ctx: ToolContext): Promise<ToolResult> {
  try {
    const pattern = String(args.pattern || '');
    if (!pattern) return fail('pattern is required');
    const files = await walkFiles(ctx.workspaceRoot, { maxFiles: 2000 });
    const regex = globToRegExp(pattern);
    const hits = files.filter(f => regex.test(f)).slice(0, 200);
    if (hits.length === 0) return ok('No files matched ' + pattern);
    return ok(hits.join('\n'));
  } catch (err: any) {
    return fail(err.message);
  }
}

async function grepTool(args: Record<string, any>, ctx: ToolContext): Promise<ToolResult> {
  try {
    const query = String(args.query || args.pattern || '');
    if (!query) return fail('query is required');
    const filePattern = args.file_pattern ? String(args.file_pattern) : null;
    const maxHits = Number(args.max_hits || 50);
    const flags = args.case_insensitive ? 'i' : '';
    let re: RegExp;
    try {
      re = new RegExp(query, flags);
    } catch {
      return fail('Invalid regex: ' + query);
    }

    const files = await walkFiles(ctx.workspaceRoot, { maxFiles: 1000 });
    const fileRe = filePattern ? globToRegExp(filePattern) : null;
    const lines: string[] = [];

    for (const rel of files) {
      if (lines.length >= maxHits) break;
      if (fileRe && !fileRe.test(rel)) continue;
      const abs = resolveSafePath(ctx.workspaceRoot, rel);
      let text: string;
      try {
        const buf = await fs.readFile(abs);
        if (buf.length > MAX_READ_BYTES) continue;
        text = buf.toString('utf8');
      } catch {
        continue;
      }
      const rows = text.split('\n');
      for (let i = 0; i < rows.length; i++) {
        if (lines.length >= maxHits) break;
        if (re.test(rows[i])) {
          lines.push(rel + ':' + (i + 1) + ': ' + rows[i].trim().slice(0, 200));
        }
      }
    }

    if (lines.length === 0) return ok('No matches for ' + query);
    return ok(lines.join('\n'));
  } catch (err: any) {
    return fail(err.message);
  }
}

export const fsTools: HarnessTool[] = [
  {
    name: 'read',
    description: 'Read a file from the workspace. Path is relative to the workspace root.',
    capability: 'fs',
    modes: ['build', 'plan'],
    defaultAction: 'allow',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to workspace root' },
      },
      required: ['path'],
    },
    execute: readTool,
  },
  {
    name: 'write',
    description: 'Create or overwrite a file in the workspace.',
    capability: 'fs',
    modes: ['build'],
    defaultAction: 'ask',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to workspace root' },
        content: { type: 'string', description: 'Full file content' },
      },
      required: ['path', 'content'],
    },
    execute: writeTool,
  },
  {
    name: 'edit',
    description: 'Replace an exact string in a file. Use replace_all for multiple occurrences.',
    capability: 'fs',
    modes: ['build'],
    defaultAction: 'ask',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to workspace root' },
        old_string: { type: 'string', description: 'Exact text to replace' },
        new_string: { type: 'string', description: 'Replacement text' },
        replace_all: { type: 'boolean', description: 'Replace every occurrence' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
    execute: editTool,
  },
  {
    name: 'glob',
    description: 'Find files by glob pattern (e.g. **/*.ts, src/**/*.tsx).',
    capability: 'fs',
    modes: ['build', 'plan'],
    defaultAction: 'allow',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern' },
      },
      required: ['pattern'],
    },
    execute: globTool,
  },
  {
    name: 'grep',
    description: 'Search file contents with a regular expression.',
    capability: 'fs',
    modes: ['build', 'plan'],
    defaultAction: 'allow',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Regex pattern to search for' },
        file_pattern: { type: 'string', description: 'Optional glob to filter files' },
        case_insensitive: { type: 'boolean', description: 'Case-insensitive match' },
        max_hits: { type: 'number', description: 'Max matching lines (default 50)' },
      },
      required: ['query'],
    },
    execute: grepTool,
  },
];
