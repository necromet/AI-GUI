import { spawn } from 'child_process';

const SANDBOX_TIMEOUT_MS = 10_000;
const MAX_OUTPUT_BYTES = 100_000;

const DANGEROUS_PATTERNS = [
  /__proto__/,
  /constructor\s*\[/,
  /constructor\s*\./,
  /prototype\s*\[/,
  /import\s*\(/,
  /require\s*\(/,
  /process\b/,
  /globalThis\b/,
  /global\b/,
  /child_process/,
  /fs\b/,
  /net\b/,
  /http\b/,
  /https\b/,
  /dgram\b/,
  /dns\b/,
  /cluster\b/,
  /worker_threads/,
  /vm\b/,
  /module\b/,
  /exports\b/,
  /__filename/,
  /__dirname/,
  /Buffer\b/,
  /eval\s*\(/,
  /Function\s*\(/,
  /new\s+Function/,
  /atob\s*\(/,
  /btoa\s*\(/,
];

function isCodeSafe(code: string): string | null {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      return `Blocked: code contains forbidden pattern: ${pattern.source}`;
    }
  }
  return null;
}

export async function toolExecuteCode(code: string): Promise<string> {
  if (!code) return 'Error: No code provided';

  const safetyCheck = isCodeSafe(code);
  if (safetyCheck) return `Error: ${safetyCheck}`;

  const wrappedCode = `
'use strict';
const _logs = [];
const console = {
  log: (...a) => _logs.push(a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')),
  error: (...a) => _logs.push('[error] ' + a.map(String).join(' ')),
  warn: (...a) => _logs.push('[warn] ' + a.map(String).join(' ')),
};
try {
  ${code}
} catch(e) { _logs.push('[error] ' + e.message); }
process.stdout.write(JSON.stringify(_logs));
`;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn(process.execPath, ['--eval', wrappedCode], {
      timeout: SANDBOX_TIMEOUT_MS,
      env: {},
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: '/tmp',
    });

    proc.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
      if (stdout.length > MAX_OUTPUT_BYTES) proc.kill();
    });

    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > MAX_OUTPUT_BYTES) proc.kill();
    });

    const timer = setTimeout(() => {
      proc.kill();
    }, SANDBOX_TIMEOUT_MS);

    proc.on('close', (exitCode) => {
      clearTimeout(timer);
      try {
        const logs: string[] = JSON.parse(stdout || '[]');
        if (stderr) logs.push('[stderr] ' + stderr.trim());
        resolve(logs.length > 0 ? logs.join('\n') : '(no output)');
      } catch {
        const output = (stdout || '').trim();
        const err = (stderr || '').trim();
        if (exitCode !== 0 && err) {
          resolve(output ? output + `\n[error] ${err}` : `Error: ${err}`);
        } else {
          resolve(output || '(no output)');
        }
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve(`Error: ${err.message}`);
    });
  });
}
