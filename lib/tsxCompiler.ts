import { transform } from 'sucrase';
import type { ProjectFile } from '../components/canvas/types';

export interface CompileResult {
  html: string;
  errors: string[];
}

function resolveImportPath(importPath: string, fromFile: string, files: Map<string, ProjectFile>): string | null {
  if (importPath.startsWith('react') || importPath.startsWith('react-dom') || importPath.startsWith('react/')) {
    return null;
  }

  if (importPath.endsWith('.css') || importPath.endsWith('.scss') || importPath.endsWith('.less')) {
    return null;
  }

  let resolved = importPath;
  if (resolved.startsWith('./')) {
    const dir = fromFile.substring(0, fromFile.lastIndexOf('/'));
    resolved = dir ? `${dir}/${resolved.slice(2)}` : resolved.slice(2);
  } else if (resolved.startsWith('../')) {
    const parts = fromFile.split('/');
    parts.pop();
    const importParts = resolved.split('/');
    for (const part of importParts) {
      if (part === '..') parts.pop();
      else if (part !== '.') parts.push(part);
    }
    resolved = parts.join('/');
  }

  const extensions = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts'];
  if (files.has(resolved)) return resolved;
  for (const ext of extensions) {
    if (files.has(resolved + ext)) return resolved + ext;
  }
  const last = resolved.split('/').pop() || '';
  if (!last.includes('.')) {
    const dir = resolved;
    for (const ext of extensions) {
      if (files.has(dir + ext)) return dir + ext;
    }
  }
  return resolved;
}

function compileFile(file: ProjectFile, files: Map<string, ProjectFile>): { code: string; deps: string[] } {
  const deps: string[] = [];

  if (file.language === 'css' || file.language === 'json') {
    return { code: '// non-JS module', deps: [] };
  }

  try {
    const result = transform(file.content, {
      transforms: ['typescript', 'jsx', 'imports'],
      jsxRuntime: 'classic',
      jsxPragma: 'React.createElement',
      jsxFragmentPragma: 'React.Fragment',
      production: true,
    });

    const code = result.code;
    const importRe = /require\(["']([^"']+)["']\)/g;
    let match;
    while ((match = importRe.exec(code)) !== null) {
      const resolved = resolveImportPath(match[1], file.path, files);
      if (resolved && files.has(resolved)) {
        deps.push(resolved);
      }
    }

    return { code, deps };
  } catch (err: any) {
    return { code: `throw new Error("Compile error in ${file.path}: ${err.message}")`, deps: [] };
  }
}

export function compileProject(files: ProjectFile[]): CompileResult {
  const errors: string[] = [];
  const fileMap = new Map<string, ProjectFile>();
  for (const f of files) fileMap.set(f.path, f);

  const entryFile = files.find(f => f.isEntry) || files.find(f => f.path.endsWith('App.tsx')) || files[0];
  if (!entryFile) {
    return { html: '<html><body><p>No files to compile</p></body></html>', errors: ['No files provided'] };
  }

  const compiled = new Map<string, { code: string; deps: string[] }>();
  const visiting = new Set<string>();
  const visitOrder: string[] = [];

  function visit(path: string) {
    if (compiled.has(path) || visiting.has(path)) return;
    visiting.add(path);
    const file = fileMap.get(path);
    if (!file) return;
    const result = compileFile(file, fileMap);
    for (const dep of result.deps) visit(dep);
    compiled.set(path, result);
    visiting.delete(path);
    visitOrder.push(path);
  }

  visit(entryFile.path);

  const moduleRegistry: string[] = [];
  moduleRegistry.push(`const __modules = {};`);
  moduleRegistry.push(`const __require = (path) => {`);
  moduleRegistry.push(`  if (__modules[path]) return __modules[path].exports;`);
  moduleRegistry.push(`  const module = { exports: {} };`);
  moduleRegistry.push(`  __modules[path] = module;`);
  moduleRegistry.push(`  const exports = module.exports;`);
  moduleRegistry.push(`  (function(require, module, exports) {`);
  moduleRegistry.push(`    // module body injected below`);
  moduleRegistry.push(`  })(__require, module, exports);`);
  moduleRegistry.push(`  return module.exports;`);
  moduleRegistry.push(`};`);

  const moduleBodies: string[] = [];
  for (const path of visitOrder) {
    const result = compiled.get(path)!;
    let code = result.code;
    code = code.replace(
      /require\(["']react["']\)/g,
      `(window.React || require('react'))`
    );
    code = code.replace(
      /require\(["']react-dom\/client["']\)/g,
      `(window.ReactDOM || require('react-dom'))`
    );
    code = code.replace(
      /require\(["']react-dom["']\)/g,
      `(window.ReactDOM || require('react-dom'))`
    );
    moduleBodies.push(`__modules[${JSON.stringify(path)}] = { exports: {} };
(function(require, module, exports) {
${code}
})(__require, __modules[${JSON.stringify(path)}], __modules[${JSON.stringify(path)}].exports);
`);
  }

  const entryPath = entryFile.path;
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://unpkg.com/react@19/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@19/umd/react-dom.production.min.js"><\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #root { width: 100%; min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    "use strict";
    var React = window.React;
    var ReactDOM = window.ReactDOM;
    ${moduleRegistry.join('\n    ')}
    ${moduleBodies.join('\n    ')}
    var __entry = __require(${JSON.stringify(entryPath)});
    var __App = __entry.default || __entry;
    if (typeof __App === 'function') {
      var root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(__App));
    } else {
      document.getElementById('root').innerHTML = '<p style="color:red;padding:20px;">Entry file must export a default React component</p>';
    }
  <\/script>
</body>
</html>`;

  return { html, errors };
}

export function generateComponentTsx(name: string, type: string, prompt: string, cols: number, rows: number): string {
  return `import React from 'react';

interface ${name}Props {}

export default function ${name}(props: ${name}Props) {
  return (
    <section className="${type}" style={{ minHeight: '${rows * 80}px' }}>
      {/* ${prompt} */}
      <div style={{ padding: '2rem', maxWidth: '${cols * 80}px', margin: '0 auto' }}>
        <h2>${name}</h2>
        <p>${prompt}</p>
      </div>
    </section>
  );
}
`;
}

export function generateAppTsx(componentNames: string[], imports: string[]): string {
  const importLines = imports.map((imp, i) => `import ${componentNames[i]} from '${imp}';`).join('\n');

  return `import React from 'react';
${importLines}

export default function App() {
  return (
    <div className="app">
${componentNames.map(n => `      <${n} />`).join('\n')}
    </div>
  );
}
`;
}

export function generateMainTsx(): string {
  return `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './globals.css';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
`;
}

export function generateGlobalsCss(): string {
  return `@import "tailwindcss";

:root {
  --bg-0: #0a0a0a;
  --bg-100: #111113;
  --bg-200: #1c1b1b;
  --text-100: #e5e2e1;
  --text-300: #cfc2d6;
  --text-500: #7a7a7a;
  --border-200: #2a2a2a;
  --border-300: #3a3a3a;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-0);
  color: var(--text-100);
  min-height: 100vh;
}
`;
}
