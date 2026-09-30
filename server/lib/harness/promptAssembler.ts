import type { HarnessConfig, HarnessMode, ToolMeta } from './types';
import type { HarnessTool } from './types';
import { buildLanguageInstruction, detectLanguage } from '../../services/mimoService';

export interface PromptInput {
  agentPrompt?: string;
  mode: HarnessMode;
  workspaceRoot: string;
  tools: HarnessTool[];
  skills?: Array<{ name: string; description: string }>;
  memorySummary?: string;
  taskDump?: string;
  languageHint?: string;
  date?: string;
}

const SOUL = `You are a capable agent running inside a MiMoCode-style harness.
Hard rules:
- Stay inside the workspace; never attempt to escape it or read secrets outside it.
- Prefer specialized tools over guessing. Use read/glob/grep before concluding something is missing.
- Do not dump environment variables, API keys, or credentials.
- Destructive or outbound actions (write, edit, bash) may require approval — if denied, adapt and report.
- Be concise. Prefer actions over long explanations.`;

function toolDocs(tools: HarnessTool[]): string {
  return tools
    .map(t => {
      const props = (t.parameters as any)?.properties || {};
      const params = Object.entries(props)
        .map(([name, def]: [string, any]) => '  - ' + name + ' (' + (def.type || 'any') + '): ' + (def.description || ''))
        .join('\n');
      return '### ' + t.name + '\n' + t.description + (params ? '\nParameters:\n' + params : '');
    })
    .join('\n\n');
}

function capabilityNote(tools: HarnessTool[]): string {
  const caps = new Set(tools.map(t => t.capability as ToolMeta['capability']));
  const notes: string[] = [];
  if (caps.has('fs')) notes.push('file tools are rooted at the workspace');
  if (caps.has('shell')) notes.push('bash runs with cwd = workspace');
  if (caps.has('web')) notes.push('web tools fetch external pages');
  return notes.length ? 'Notes: ' + notes.join('; ') + '.' : '';
}

export function buildHarnessSystemPrompt(input: PromptInput): string {
  const {
    agentPrompt = '',
    mode,
    workspaceRoot,
    tools,
    skills = [],
    memorySummary,
    languageHint,
    date = new Date().toISOString().slice(0, 10),
  } = input;

  const parts: string[] = [];

  parts.push(SOUL);

  parts.push(
    [
      'Environment:',
      '- Platform: ' + process.platform,
      '- Date: ' + date,
      '- Mode: ' + mode + (mode === 'plan' ? ' (read-only analysis; mutating tools are unavailable)' : ' (full tool access)'),
      '- Workspace: ' + workspaceRoot,
    ].join('\n'),
  );

  if (skills.length > 0) {
    parts.push(
      'Skills available (load with the skill tool):\n' +
        skills.map(s => '- ' + s.name + ' — ' + s.description).join('\n'),
    );
  }

  if (memorySummary) {
    parts.push('Remembered context:\n' + memorySummary);
  }

  if (input.taskDump) {
    parts.push('Active tasks:\n' + input.taskDump);
  }

  if (agentPrompt.trim()) {
    parts.push('Agent instructions:\n' + agentPrompt.trim());
  }

  parts.push(
    'You have access to the following tools. Prefer native function/tool calls when available.\n\n' +
      toolDocs(tools) +
      (capabilityNote(tools) ? '\n\n' + capabilityNote(tools) : ''),
  );

  if (languageHint) {
    try {
      parts.push(buildLanguageInstruction(languageHint));
    } catch {
      parts.push('Respond in the same language as the user.');
    }
  } else {
    parts.push('Respond in the same language as the user.');
  }

  return parts.join('\n\n');
}

export function detectPromptLanguage(text: string): string {
  return detectLanguage(text);
}
