import { spawn } from 'node:child_process';
import type { HarnessTool, ToolContext, ToolResult } from '../types';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_OUTPUT = 20_000;

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT) return text;
  return text.slice(0, MAX_OUTPUT) + '\n…[truncated]';
}

async function bashTool(args: Record<string, any>, ctx: ToolContext): Promise<ToolResult> {
  const command = String(args.command || '').trim();
  if (!command) return { output: '', error: 'command is required' };

  const timeoutMs = Number(args.timeout_ms) || DEFAULT_TIMEOUT_MS;

  return new Promise(resolve => {
    const child = spawn(command, {
      shell: true,
      cwd: ctx.workspaceRoot,
      env: { ...process.env, HARNESS: '1' },
      signal: ctx.signal,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      resolve({
        output: truncate(stdout),
        error: 'Command timed out after ' + timeoutMs + 'ms' + (stderr ? '\n' + truncate(stderr) : ''),
      });
    }, timeoutMs);

    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString('utf8');
    });
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString('utf8');
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ output: truncate(stdout), error: err.message });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const combined = [stdout, stderr].filter(Boolean).join('\n').trim();
      if (code === 0) {
        resolve({ output: truncate(combined || '(no output)') });
      } else {
        resolve({ output: truncate(stdout), error: 'Exit code ' + code + (stderr ? '\n' + truncate(stderr) : '') });
      }
    });
  });
}

export const shellTools: HarnessTool[] = [
  {
    name: 'bash',
    description:
      'Run a shell command in the workspace directory. Prefer file tools for edits. Destructive commands may require approval.',
    capability: 'shell',
    modes: ['build'],
    defaultAction: 'ask',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        timeout_ms: { type: 'number', description: 'Timeout in milliseconds (default 15000)' },
      },
      required: ['command'],
    },
    execute: bashTool,
  },
];
