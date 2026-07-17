import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { randomBytes } from 'crypto';

const PYTHON_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 100_000;

const VENV_DIR = resolve(process.cwd(), 'data', 'python-venv');
const TMP_DIR = resolve(process.cwd(), 'data', 'tmp');

const installedPackages = new Set<string>();

function ensureDirs() {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
}

function getVenvPython(): string {
  if (process.platform === 'win32') {
    return join(VENV_DIR, 'Scripts', 'python.exe');
  }
  return join(VENV_DIR, 'bin', 'python');
}

function getVenvPip(): string {
  if (process.platform === 'win32') {
    return join(VENV_DIR, 'Scripts', 'pip.exe');
  }
  return join(VENV_DIR, 'bin', 'pip');
}

function getSystemPython(): string {
  if (process.platform === 'win32') return 'python';
  return 'python3';
}

function createVenv(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (existsSync(getVenvPython())) {
      resolve();
      return;
    }
    installedPackages.clear();
    const proc = spawn(getSystemPython(), ['-m', 'venv', VENV_DIR], { timeout: 60_000 });
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed to create venv: ${stderr}`));
    });
    proc.on('error', reject);
  });
}

function installPackages(packages: string[]): Promise<void> {
  const toInstall = packages.filter(p => !installedPackages.has(p));
  if (toInstall.length === 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const proc = spawn(getVenvPip(), ['install', '--quiet', ...toInstall], { timeout: 120_000 });
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) {
        toInstall.forEach(p => installedPackages.add(p));
        resolve();
      } else {
        reject(new Error(`pip install failed: ${stderr}`));
      }
    });
    proc.on('error', reject);
  });
}

export interface PythonResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export async function executePython(code: string, requirements?: string[]): Promise<PythonResult> {
  ensureDirs();

  await createVenv();

  if (requirements && requirements.length > 0) {
    await installPackages(requirements);
  }

  const tmpFile = join(TMP_DIR, `py_${randomBytes(8).toString('hex')}.py`);
  writeFileSync(tmpFile, code, 'utf-8');

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn(getVenvPython(), [tmpFile], {
      timeout: PYTHON_TIMEOUT_MS,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
      if (stdout.length > MAX_OUTPUT_BYTES) {
        stdout = stdout.slice(0, MAX_OUTPUT_BYTES) + '\n... (output truncated)';
        proc.kill();
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
      if (stderr.length > MAX_OUTPUT_BYTES) {
        stderr = stderr.slice(0, MAX_OUTPUT_BYTES) + '\n... (output truncated)';
        proc.kill();
      }
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, PYTHON_TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timer);
      try { unlinkSync(tmpFile); } catch {}
      resolve({
        stdout: stdout.slice(0, MAX_OUTPUT_BYTES),
        stderr: stderr.slice(0, MAX_OUTPUT_BYTES),
        exitCode: code ?? 1,
        timedOut,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      try { unlinkSync(tmpFile); } catch {}
      resolve({
        stdout: '',
        stderr: `Process error: ${err.message}`,
        exitCode: 1,
        timedOut: false,
      });
    });
  });
}
