import * as esbuild from 'esbuild';
import type { LibraryComponentFile } from './libraryService';

const EXTERNAL_PACKAGES = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'motion/react',
  'framer-motion',
  '@phosphor-icons/react',
  'lucide-react',
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
  'zod',
  'date-fns',
  'sonner',
];

const EXTERNAL_PREFIXES = [
  '@radix-ui/',
  'cmdk',
  'vaul',
  'embla-carousel-react',
  'recharts',
  'react-day-picker',
  'react-hook-form',
  '@hookform/',
];

function resolveInternalImport(
  source: string,
  currentFilename: string,
  files: LibraryComponentFile[],
): string | null {
  let target = source;

  if (target.startsWith('@/')) {
    const parts = target.split('/');
    target = parts[parts.length - 1];
  } else if (target.startsWith('./') || target.startsWith('../')) {
    target = target.replace(/^\.\.?\//, '');
  } else {
    return null;
  }

  let found = files.find(f => f.filename === target);
  if (found) return found.filename;

  for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
    found = files.find(f => f.filename === target + ext);
    if (found) return found.filename;
  }

  const targetBase = target.replace(/\.(tsx?|jsx?)$/, '');
  found = files.find(f => {
    const base = f.filename.replace(/\.(tsx?|jsx?)$/, '');
    return base === targetBase;
  });
  if (found) return found.filename;

  const componentsFile = files.find(f => f.filename === 'components.tsx' || f.filename === 'component.tsx');
  if (componentsFile && currentFilename !== componentsFile.filename) {
    return componentsFile.filename;
  }

  const otherTsxFiles = files.filter(f => (f.filename.endsWith('.tsx') || f.filename.endsWith('.jsx')) && f.filename !== currentFilename);
  if (otherTsxFiles.length === 1) {
    return otherTsxFiles[0].filename;
  }

  const targetLower = targetBase.toLowerCase().replace(/[-_]/g, '');
  found = files.find(f => {
    const base = f.filename.replace(/\.(tsx?|jsx?)$/, '').toLowerCase().replace(/[-_]/g, '');
    return base === targetLower && f.filename !== currentFilename;
  });
  if (found) return found.filename;

  return null;
}

function extractNamedImports(clause: string): string[] {
  if (!clause) return [];
  const inner = clause.replace(/[{}]/g, '').trim();
  if (!inner) return [];
  return inner.split(',').map(s => {
    const part = s.trim();
    if (!part || part === 'type') return '';
    const asMatch = part.match(/(?:type\s+)?(\w+)\s+as\s+\w+/);
    if (asMatch) return asMatch[1];
    const nameMatch = part.match(/(?:type\s+)?(\w+)/);
    return nameMatch ? nameMatch[1] : '';
  }).filter(Boolean);
}

function fileExportsName(content: string, name: string): boolean {
  const patterns = [
    new RegExp(`export\\s+(?:default\\s+)?(?:const|let|var|function|class|async\\s+function)\\s+${name}\\b`),
    new RegExp(`export\\s+\\{[^}]*\\b${name}\\b[^}]*\\}`),
    new RegExp(`export\\s+default\\s+${name}\\b`),
  ];
  return patterns.some(p => p.test(content));
}

function findFileExportingNames(
  files: LibraryComponentFile[],
  names: string[],
  excludeFile: string,
): string | null {
  for (const f of files) {
    if (f.filename === excludeFile) continue;
    if (f.contentType === 'css' || f.contentType === 'json' || f.contentType === 'html') continue;
    if (names.every(n => fileExportsName(f.content, n))) return f.filename;
  }
  for (const f of files) {
    if (f.filename === excludeFile) continue;
    if (f.contentType === 'css' || f.contentType === 'json' || f.contentType === 'html') continue;
    if (names.some(n => fileExportsName(f.content, n))) return f.filename;
  }
  return null;
}

const IMPORT_RE = /import\s+(?:(type)\s+)?(?:(\{[\s\S]*?\})\s*from\s+|([\w$]+)\s*(?:,\s*(\{[\s\S]*?\}))?\s*from\s+|\*\s+as\s+([\w$]+)\s*from\s+)['"]([^'"]+)['"]\s*;?|import\s+['"]([^'"]+)['"]\s*;?/g;

function computeRequiredExports(files: LibraryComponentFile[]): Map<string, Set<string>> {
  const required = new Map<string, Set<string>>();

  for (const file of files) {
    if (file.contentType === 'css' || file.contentType === 'json' || file.contentType === 'html') continue;
    IMPORT_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = IMPORT_RE.exec(file.content)) !== null) {
      const typeKeyword = match[1];
      const namedClause = match[2];
      const fromSource = match[6];
      if (!fromSource || typeKeyword) continue;
      if (!fromSource.startsWith('.') && !fromSource.startsWith('@/')) continue;
      const resolved = resolveInternalImport(fromSource, file.filename, files);
      if (!resolved) continue;
      const names = namedClause ? extractNamedImports(namedClause) : [];
      if (names.length === 0) continue;
      if (!required.has(resolved)) required.set(resolved, new Set());
      for (const n of names) required.get(resolved)!.add(n);
    }
  }
  return required;
}

function fileDeclaresName(content: string, name: string): boolean {
  const patterns = [
    new RegExp(`(?:const|let|var|function|class|async\\s+function)\\s+${name}\\b`),
    new RegExp(`\\b${name}\\s*=`),
  ];
  return patterns.some(p => p.test(content));
}

function rewriteImports(content: string, filename: string, files: LibraryComponentFile[]): string {
  return content.replace(
    /import\s+(?:(type)\s+)?(?:(\{[\s\S]*?\})\s*from\s+|([\w$]+)\s*(?:,\s*(\{[\s\S]*?\}))?\s*from\s+|\*\s+as\s+([\w$]+)\s*from\s+)['"]([^'"]+)['"]\s*;?|import\s+['"]([^'"]+)['"]\s*;?/g,
    (match, _typeKeyword, namedClause, _defaultName, _namedAfterDefault, _nsName, fromSource, sideEffectSource) => {
      const source = fromSource || sideEffectSource;
      if (!source) return match;

      if (source.startsWith('.') || source.startsWith('@/')) {
        const resolved = resolveInternalImport(source, filename, files);
        if (resolved) {
          if (namedClause && !_typeKeyword) {
            const names = extractNamedImports(namedClause);
            if (names.length > 0) {
              const targetFile = files.find(f => f.filename === resolved);
              if (targetFile && !names.every(n => fileExportsName(targetFile.content, n))) {
                const betterFile = findFileExportingNames(files, names, filename);
                if (betterFile) {
                  return match.replace(source, `./${betterFile}`);
                }
              }
            }
          }
          return match.replace(source, `./${resolved}`);
        }
      }

      return match;
    }
  );
}

function rewriteCnImports(content: string): string {
  return content.replace(
    /import\s+\{\s*cn\s*(?:,\s*[^}]+)?\}\s*from\s*['"]((?:\.\/|\.\.\/|@\/)[^'"]+)['"]\s*;?/g,
    (match) => {
      return match.replace(/from\s*['"][^'"]+['"]/, 'from "./__cn_virtual__"');
    }
  );
}

function createEntryPlugin(files: LibraryComponentFile[], requiredExports: Map<string, Set<string>>): esbuild.Plugin {
  const CN_MODULE = `
import { clsx } from "https://esm.sh/clsx?external=react,react-dom";
import { twMerge } from "https://esm.sh/tailwind-merge?external=react,react-dom";
export function cn(...inputs) { return twMerge(clsx(inputs)); }
export default cn;
`;

  return {
    name: 'library-component-resolver',
    setup(build) {
      build.onResolve({ filter: /^\.\// }, (args) => {
        if (args.path === './cn' || (args.importer !== '<stdin>' && /\/cn$/.test(args.path))) {
          return { path: './__cn_virtual__', namespace: 'component' };
        }
        return { path: args.path, namespace: 'component' };
      });

      build.onResolve({ filter: /^@\// }, (args) => {
        if (/\/cn$/.test(args.path)) {
          return { path: './__cn_virtual__', namespace: 'component' };
        }
        return { path: args.path, namespace: 'unresolved-stub' };
      });

      build.onResolve({ filter: /^(next|@next)\// }, () => {
        return { path: 'next-stub', namespace: 'unresolved-stub' };
      });

      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.path.startsWith('.') || args.path.startsWith('/') || args.path.startsWith('http')) return undefined;
        if (EXTERNAL_PACKAGES.includes(args.path) || EXTERNAL_PREFIXES.some(p => args.path.startsWith(p))) return undefined;
        const esmUrl = `https://esm.sh/${args.path}?external=react,react-dom`;
        return { path: esmUrl, namespace: 'esm-sh', external: false };
      });

      build.onLoad({ filter: /.*/, namespace: 'component' }, (args) => {
        const filename = args.path.replace(/^\.\//, '');
        if (filename === '__cn_virtual__') {
          return { contents: CN_MODULE, loader: 'js', resolveDir: '/' };
        }
        const file = files.find(f => f.filename === filename);
        if (!file) return { contents: 'export default {}', loader: 'js' };

        if (file.contentType === 'css') {
          const escaped = file.content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
          return {
            contents: `if (typeof document !== 'undefined') { const s = document.createElement('style'); s.dataset.source = ${JSON.stringify(filename)}; s.textContent = \`${escaped}\`; document.head.appendChild(s); } export default {};`,
            loader: 'js',
            resolveDir: '/',
          };
        }

        const rewritten = rewriteCnImports(rewriteImports(file.content, file.filename, files));
        const loader = filename.endsWith('.tsx') ? 'tsx' as const
          : filename.endsWith('.ts') ? 'ts' as const
          : filename.endsWith('.jsx') ? 'jsx' as const
          : filename.endsWith('.css') ? 'css' as const
          : 'js' as const;

        const required = requiredExports.get(filename);
        let finalContent = rewritten;
        if (required && required.size > 0) {
          const missing = [...required].filter(name => !fileExportsName(rewritten, name));
          if (missing.length > 0) {
            const stubs = missing.map(n => {
              if (fileDeclaresName(rewritten, n)) {
                return `export { ${n} };`;
              }
              return `const ${n} = () => null;\nexport { ${n} };`;
            }).join('\n');
            finalContent = rewritten + '\n' + stubs;
          }
        }

        return { contents: finalContent, loader, resolveDir: '/' };
      });

      build.onLoad({ filter: /.*/, namespace: 'unresolved-stub' }, () => {
        return { contents: 'export default function Stub() { return null; }', loader: 'jsx' };
      });

      build.onLoad({ filter: /.*/, namespace: 'esm-sh' }, (args) => {
        return { contents: `import * as __esm_ns from "${args.path}"; export default __esm_ns.default; export * from "${args.path}";`, loader: 'js' };
      });
    },
  };
}

export async function compileComponent(files: LibraryComponentFile[]): Promise<string> {
  if (!files || files.length === 0) {
    throw new Error('No files to compile');
  }

  const entryFile =
    files.find(f => f.filename === 'usage.tsx') ||
    files.find(f => f.isEntry) ||
    files.find(f => f.filename === 'components.tsx') ||
    files[0];

  const entryContent = rewriteImports(entryFile.content, entryFile.filename, files);

  let entryWithRender = entryContent;

  const hasReactDOMCreateRoot = /ReactDOM\.createRoot\s*\(/.test(entryContent);
  const hasCreateRoot = entryContent.includes('createRoot') || entryContent.includes('.render(');

  if (hasReactDOMCreateRoot) {
    entryWithRender = entryWithRender.replace(
      /ReactDOM\.createRoot\s*\(/g,
      'createRoot(',
    );
    if (!entryWithRender.includes("from 'react-dom/client'")) {
      entryWithRender = `import { createRoot } from 'react-dom/client';\n` + entryWithRender;
    }
  } else if (!hasCreateRoot) {
    const hasDefaultExport = /export\s+default\s+/.test(entryContent);
    if (!hasDefaultExport) {
      const namedExportMatch = entryContent.match(/export\s+(?:function|const|class)\s+(\w+)/);
      if (namedExportMatch) {
        entryWithRender += `\nexport default ${namedExportMatch[1]};\n`;
      } else {
        const localMatch = entryContent.match(/(?:function|const)\s+(\w+)\s*(?:=\s*(?:\([^)]*\)\s*=>|\([^)]*\)\s*:\s*\w+))/);
        if (localMatch) {
          entryWithRender += `\nexport { ${localMatch[1]} as default };\n`;
        }
      }
    }
  }

  const entryLoader = entryFile.filename.endsWith('.tsx') ? 'tsx' as const
    : entryFile.filename.endsWith('.ts') ? 'ts' as const
    : entryFile.filename.endsWith('.jsx') ? 'jsx' as const
    : 'js' as const;

  const plugin = createEntryPlugin(files, computeRequiredExports(files));

  const result = await esbuild.build({
    stdin: {
      contents: entryWithRender,
      loader: entryLoader,
      resolveDir: '/',
    },
    bundle: true,
    write: false,
    format: 'esm',
    target: 'esnext',
    jsx: 'automatic',
    platform: 'browser',
    external: EXTERNAL_PACKAGES,
    plugins: [plugin],
    logLevel: 'error',
  });

  if (result.errors.length > 0) {
    throw new Error(`Compilation failed:\n${result.errors.map(e => e.text).join('\n')}`);
  }

  const output = result.outputFiles?.[0];
  if (!output) {
    throw new Error('No output from esbuild');
  }

  return output.text;
}
