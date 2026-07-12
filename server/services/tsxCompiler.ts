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

  const componentsFile = files.find(f => f.filename === 'components.tsx');
  if (componentsFile && currentFilename !== 'components.tsx') {
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

function rewriteImports(content: string, filename: string, files: LibraryComponentFile[]): string {
  return content.replace(
    /import\s+(?:(type)\s+)?(?:(\{[\s\S]*?\})\s*from\s+|([\w$]+)\s*(?:,\s*(\{[\s\S]*?\}))?\s*from\s+|\*\s+as\s+([\w$]+)\s*from\s+)['"]([^'"]+)['"]\s*;?|import\s+['"]([^'"]+)['"]\s*;?/g,
    (match, _typeKeyword, _namedClause, _defaultName, _namedAfterDefault, _nsName, fromSource, sideEffectSource) => {
      const source = fromSource || sideEffectSource;
      if (!source) return match;

      if (source.startsWith('.') || source.startsWith('@/')) {
        const resolved = resolveInternalImport(source, filename, files);
        if (resolved) {
          return match.replace(source, `./${resolved}`);
        }
      }

      return match;
    }
  );
}

function createEntryPlugin(files: LibraryComponentFile[]): esbuild.Plugin {
  return {
    name: 'library-component-resolver',
    setup(build) {
      build.onResolve({ filter: /^\.\// }, (args) => {
        return { path: args.path, namespace: 'component' };
      });

      build.onResolve({ filter: /^@\// }, (args) => {
        return { path: args.path, namespace: 'unresolved-stub' };
      });

      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.path.startsWith('.') || args.path.startsWith('/') || args.path.startsWith('http')) return undefined;
        if (EXTERNAL_PACKAGES.includes(args.path)) return undefined;
        const esmUrl = `https://esm.sh/${args.path}?external=react,react-dom`;
        return { path: esmUrl, namespace: 'esm-sh', external: false };
      });

      build.onLoad({ filter: /.*/, namespace: 'component' }, (args) => {
        const filename = args.path.replace(/^\.\//, '');
        const file = files.find(f => f.filename === filename);
        if (!file) return { contents: 'export default {}', loader: 'js' };

        const rewritten = rewriteImports(file.content, file.filename, files);
        const loader = filename.endsWith('.tsx') ? 'tsx' as const
          : filename.endsWith('.ts') ? 'ts' as const
          : filename.endsWith('.jsx') ? 'jsx' as const
          : filename.endsWith('.css') ? 'css' as const
          : 'js' as const;

        return { contents: rewritten, loader, resolveDir: '/' };
      });

      build.onLoad({ filter: /.*/, namespace: 'unresolved-stub' }, () => {
        return { contents: 'export default function Stub() { return null; }', loader: 'jsx' };
      });

      build.onLoad({ filter: /.*/, namespace: 'esm-sh' }, (args) => {
        return { contents: `export * from "${args.path}"; export { default } from "${args.path}";`, loader: 'js' };
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
    const defaultMatch = entryContent.match(/export\s+default\s+(?:function\s+)?(\w+)/);
    const namedMatch = entryContent.match(/export\s+(?:function|const)\s+(\w+)/);
    const componentName = defaultMatch?.[1] || namedMatch?.[1] || 'App';
    entryWithRender += `\nimport { createRoot } from 'react-dom/client';\nimport React from 'react';\ncreateRoot(document.getElementById('root')).render(React.createElement(${componentName}));\n`;
  }

  const entryLoader = entryFile.filename.endsWith('.tsx') ? 'tsx' as const
    : entryFile.filename.endsWith('.ts') ? 'ts' as const
    : entryFile.filename.endsWith('.jsx') ? 'jsx' as const
    : 'js' as const;

  const plugin = createEntryPlugin(files);

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
