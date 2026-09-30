import fs from 'node:fs/promises';
import path from 'node:path';

export interface SkillEntry {
  name: string;
  description: string;
  path: string;
}

interface Frontmatter {
  name?: string;
  description?: string;
}

function parseFrontmatter(content: string): Frontmatter {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const block = match[1];
  const result: Frontmatter = {};
  for (const line of block.split('\n')) {
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
    if (key === 'name') result.name = val;
    if (key === 'description') result.description = val;
  }
  return result;
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
}

export async function discoverSkills(
  workspaceRoot: string,
  opts: { maxSkills?: number } = {},
): Promise<SkillEntry[]> {
  const max = opts.maxSkills ?? 100;
  const dirs = [
    path.join(workspaceRoot, '.mimocode', 'skills'),
    path.join(workspaceRoot, 'skills'),
  ];

  const entries: SkillEntry[] = [];
  const seen = new Set<string>();

  for (const skillsDir of dirs) {
    let children: string[];
    try {
      children = await fs.readdir(skillsDir);
    } catch {
      continue;
    }
    for (const child of children) {
      if (entries.length >= max) break;
      const skillDir = path.join(skillsDir, child);
      let stat;
      try {
        stat = await fs.stat(skillDir);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) {
        if (child.endsWith('.md') && !seen.has(child)) {
          seen.add(child);
          const content = await readSkillFile(skillDir);
          if (content) entries.push(content);
        }
        continue;
      }
      const skillFile = path.join(skillDir, 'SKILL.md');
      if (seen.has(skillFile)) continue;
      seen.add(skillFile);
      const content = await readSkillFile(skillFile);
      if (content) entries.push(content);
    }
  }

  return entries;
}

async function readSkillFile(filePath: string): Promise<SkillEntry | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const fm = parseFrontmatter(raw);
    const name = fm.name || path.basename(filePath, '.md');
    const description = fm.description || '';
    return { name, description, path: filePath };
  } catch {
    return null;
  }
}

export async function loadSkillContent(
  workspaceRoot: string,
  skillName: string,
): Promise<string | null> {
  const dirs = [
    path.join(workspaceRoot, '.mimocode', 'skills'),
    path.join(workspaceRoot, 'skills'),
  ];

  for (const skillsDir of dirs) {
    const direct = path.join(skillsDir, skillName + '.md');
    const content = await tryReadFile(direct);
    if (content) return stripFrontmatter(content);

    const nested = path.join(skillsDir, skillName, 'SKILL.md');
    const nestedContent = await tryReadFile(nested);
    if (nestedContent) return stripFrontmatter(nestedContent);
  }

  return null;
}

async function tryReadFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

/** Simple substring + regex search across skill names and descriptions. */
export function searchSkills(
  skills: SkillEntry[],
  query: string,
  limit = 5,
): SkillEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return skills.slice(0, limit);
  return skills
    .map(s => {
      const nameHit = s.name.toLowerCase().includes(q) ? 2 : 0;
      const descHit = s.description.toLowerCase().includes(q) ? 1 : 0;
      return { entry: s, score: nameHit + descHit };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.entry);
}