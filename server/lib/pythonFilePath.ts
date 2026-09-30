import { existsSync, realpathSync, statSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve, sep, win32 } from 'node:path';

export function isSafeProjectFilename(filename: string): boolean {
  return !!filename && filename !== '.' && filename !== '..'
    && !/[\\/\0:]/.test(filename)
    && basename(filename) === filename
    && win32.basename(filename) === filename
    && !/[. ]$/.test(filename);
}

export function resolveProjectFile(projectDir: string, filename: string): string | null {
  if (!isSafeProjectFilename(filename)) return null;
  const root = resolve(projectDir);
  const candidate = resolve(root, filename);
  const pathWithinRoot = relative(root, candidate);
  if (!pathWithinRoot || pathWithinRoot === '..' || pathWithinRoot.startsWith(`..${sep}`) || isAbsolute(pathWithinRoot)) return null;
  if (!existsSync(candidate) || !statSync(candidate).isFile()) return null;
  const realRoot = realpathSync(root);
  const realCandidate = realpathSync(candidate);
  const realRelative = relative(realRoot, realCandidate);
  if (!realRelative || realRelative === '..' || realRelative.startsWith(`..${sep}`) || isAbsolute(realRelative)) return null;
  return candidate;
}
