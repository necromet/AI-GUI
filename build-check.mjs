import { execSync } from 'child_process';
try {
  const output = execSync('npx vite build', { encoding: 'utf-8', cwd: process.cwd(), stdio: 'pipe' });
  console.log(output);
} catch (e) {
  console.log(e.stdout || '');
  console.log(e.stderr || '');
}
