import type { HarnessTool, ToolContext, ToolResult } from '../types';
import { readMemoryFile, appendMemoryFile, searchMemoryFiles } from '../memory';

function truncate(text: string, max = 12_000): string {
  return text.length <= max ? text : text.slice(0, max) + '\n...[truncated]';
}

async function memoryExecute(
  args: Record<string, any>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const action = String(args.action || 'read');

  if (action === 'read') {
    const file = String(args.file || 'MEMORY.md');
    if (file !== 'MEMORY.md' && file !== 'notes.md') {
      return { output: '', error: 'Only MEMORY.md and notes.md are accessible.' };
    }
    const content = await readMemoryFile(ctx.workspaceRoot, file);
    return content
      ? { output: truncate(content) }
      : { output: file + ' is empty or does not exist yet.' };
  }

  if (action === 'append') {
    const file = String(args.file || 'MEMORY.md');
    if (file !== 'MEMORY.md' && file !== 'notes.md') {
      return { output: '', error: 'Only MEMORY.md and notes.md are writable.' };
    }
    const content = String(args.content || '');
    if (!content) return { output: '', error: 'content is required for append.' };
    const msg = await appendMemoryFile(ctx.workspaceRoot, file, content);
    return { output: msg };
  }

  if (action === 'search') {
    const query = String(args.query || '');
    if (!query) return { output: '', error: 'query is required for search.' };
    const hits = await searchMemoryFiles(ctx.workspaceRoot, query, { maxResults: 20 });
    if (hits.length === 0) return { output: 'No matches for: ' + query };
    const lines = hits.map(h => h.file + ':' + h.line + ': ' + h.text);
    return { output: truncate(lines.join('\n')) };
  }

  return { output: '', error: 'Unknown action: ' + action + '. Use read, append, or search.' };
}

export const memoryTools: HarnessTool[] = [
  {
    name: 'memory',
    description:
      'Read, append, or search persistent memory files (MEMORY.md for durable notes, notes.md for scratch).',
    capability: 'meta',
    modes: ['build', 'plan'],
    defaultAction: 'allow',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'read | append | search (default: read)',
          enum: ['read', 'append', 'search'],
        },
        file: {
          type: 'string',
          description: 'MEMORY.md (default) or notes.md',
          enum: ['MEMORY.md', 'notes.md'],
        },
        content: { type: 'string', description: 'Content to append (required for append)' },
        query: { type: 'string', description: 'Regex to search for (required for search)' },
      },
      required: [],
    },
    execute: memoryExecute,
  },
];