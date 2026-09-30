import type { HarnessTool, ToolContext, ToolResult } from '../types';
import { discoverSkills, loadSkillContent, searchSkills, type SkillEntry } from '../skills';

function truncate(text: string, max = 15_000): string {
  return text.length <= max ? text : text.slice(0, max) + '\n...[truncated]';
}

async function skillToolExecute(
  args: Record<string, any>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const name = String(args.name || '');
  if (!name) return { output: '', error: 'name is required' };

  const content = await loadSkillContent(ctx.workspaceRoot, name);
  if (!content) {
    const available = await discoverSkills(ctx.workspaceRoot, { maxSkills: 20 });
    const hint = available.length
      ? 'Available: ' + available.map(s => s.name).join(', ')
      : 'No skills found in workspace.';
    return { output: '', error: 'Skill not found: ' + name + '. ' + hint };
  }
  return { output: truncate(content) };
}

async function skillSearchToolExecute(
  args: Record<string, any>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const query = String(args.query || '');
  if (!query) return { output: '', error: 'query is required' };

  const skills = await discoverSkills(ctx.workspaceRoot, { maxSkills: 100 });
  const hits = searchSkills(skills, query, Number(args.limit) || 5);
  if (hits.length === 0) return { output: 'No skills matched: ' + query };

  const lines = hits.map(s => '- ' + s.name + (s.description ? ' - ' + s.description : '') + ' (' + s.path + ')');
  return { output: lines.join('\n') };
}

export const skillTools: HarnessTool[] = [
  {
    name: 'skill',
    description: 'Load a skill by name and return its instructions. Use skill_search first to find available skills.',
    capability: 'meta',
    modes: ['build', 'plan'],
    defaultAction: 'allow',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Skill name (exact match)' },
      },
      required: ['name'],
    },
    execute: skillToolExecute,
  },
  {
    name: 'skill_search',
    description: 'Search available skills by name or description. Returns matching skill names and descriptions.',
    capability: 'meta',
    modes: ['build', 'plan'],
    defaultAction: 'allow',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default 5)' },
      },
      required: ['query'],
    },
    execute: skillSearchToolExecute,
  },
];