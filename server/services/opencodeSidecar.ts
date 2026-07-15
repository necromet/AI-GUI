import { spawn, type ChildProcess } from 'child_process';
import { randomBytes } from 'crypto';

let proc: ChildProcess | null = null;
let port = 0;
let password = '';
let ready = false;
let starting = false;

export async function startOpenCode(): Promise<{ port: number; password: string }> {
  if (proc && ready) return { port, password };
  if (starting) {
    await new Promise<void>((resolve) => {
      const check = setInterval(() => { if (ready) { clearInterval(check); resolve(); } }, 100);
    });
    return { port, password };
  }

  starting = true;
  password = randomBytes(16).toString('hex');

  proc = spawn('opencode', ['serve', '--port', '0'], {
    env: {
      ...process.env,
      OPENCODE_SERVER_PASSWORD: password,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      starting = false;
      reject(new Error('OpenCode sidecar startup timeout'));
    }, 30000);

    const onData = (data: Buffer) => {
      const output = data.toString();
      const match = output.match(/listening on http:\/\/[^:]+:(\d+)/);
      if (match) {
        port = parseInt(match[1], 10);
        ready = true;
        starting = false;
        clearTimeout(timeout);
        proc!.stdout!.off('data', onData);
        proc!.stderr!.off('data', onData);
        console.log(`[opencode-sidecar] Listening on http://127.0.0.1:${port}`);
        resolve();
      }
    };

    proc!.stdout!.on('data', onData);
    proc!.stderr!.on('data', onData);

    proc!.on('error', (err) => {
      starting = false;
      clearTimeout(timeout);
      reject(err);
    });

    proc!.on('exit', (code) => {
      console.log(`[opencode-sidecar] Exited with code ${code}`);
      proc = null;
      ready = false;
      starting = false;
    });
  });

  return { port, password };
}

export function getAuth(): string {
  return 'Basic ' + Buffer.from(`opencode:${password}`).toString('base64');
}

export function getBaseUrl(): string {
  return `http://127.0.0.1:${port}`;
}
