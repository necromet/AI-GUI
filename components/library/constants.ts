import React from 'react';
import { Package, Layers, LayoutGrid, Palette, FileCode, FileText, FileJson, FileType } from 'lucide-react';
import { LibraryComponentFile } from '../../types';

export const CATEGORIES = [
  { key: 'all', label: 'All', icon: React.createElement(Package, { size: 12 }) },
  { key: 'ui-widget', label: 'Widgets', icon: React.createElement(LayoutGrid, { size: 12 }) },
  { key: 'template', label: 'Templates', icon: React.createElement(Layers, { size: 12 }) },
  { key: 'theme', label: 'Themes', icon: React.createElement(Palette, { size: 12 }) },
];

export const CATEGORY_LABELS: Record<string, string> = {
  'ui-widget': 'Widget',
  'template': 'Template',
  'theme': 'Theme',
};

export const CONTENT_TYPES = [
  { value: 'html', label: 'HTML' },
  { value: 'tsx', label: 'TSX (React)' },
  { value: 'css', label: 'CSS' },
  { value: 'js', label: 'JavaScript' },
  { value: 'ts', label: 'TypeScript' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
];

export const FILENAME_MAP: Record<string, string> = {
  html: 'index.html', tsx: 'Component.tsx', css: 'style.css', js: 'script.js', ts: 'script.ts', json: 'data.json', markdown: 'README.md',
};

export const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  html: 'html', htm: 'html',
  css: 'css',
  js: 'js', jsx: 'js',
  ts: 'ts', tsx: 'tsx',
  json: 'json',
  md: 'markdown', markdown: 'markdown',
};

export const ACE_LANG_MAP: Record<string, 'html' | 'css' | 'javascript' | 'typescript' | 'json' | 'markdown'> = {
  html: 'html', css: 'css', js: 'javascript', ts: 'typescript', tsx: 'typescript', json: 'json', markdown: 'markdown',
};

export function deriveContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_CONTENT_TYPE[ext] || 'js';
}

export function getFileIcon(filename: string) {
  if (filename.endsWith('.html')) return React.createElement(FileCode, { size: 12 });
  if (filename.endsWith('.css')) return React.createElement(FileCode, { size: 12 });
  if (filename.endsWith('.js') || filename.endsWith('.ts') || filename.endsWith('.tsx')) return React.createElement(FileType, { size: 12 });
  if (filename.endsWith('.json')) return React.createElement(FileJson, { size: 12 });
  return React.createElement(FileText, { size: 12 });
}

function buildTsxPreview(componentId: string, isDark: boolean): string {
  const bodyBg = isDark ? '#1a1a1a' : '#ffffff';
  const bodyColor = isDark ? '#ececec' : '#1a1a1a';
  return `<!DOCTYPE html>
<html${isDark ? ' class="dark"' : ''}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script type="importmap">${JSON.stringify({
    imports: {
      'react': 'https://esm.sh/react@19',
      'react/jsx-runtime': 'https://esm.sh/react@19/jsx-runtime',
      'react-dom': 'https://esm.sh/react-dom@19',
      'react-dom/client': 'https://esm.sh/react-dom@19/client',
      'motion/react': 'https://esm.sh/motion@11/react?external=react,react-dom',
      'framer-motion': 'https://esm.sh/framer-motion@11?external=react,react-dom',
      '@phosphor-icons/react': 'https://esm.sh/@phosphor-icons/react?external=react,react-dom',
      'lucide-react': 'https://esm.sh/lucide-react@0.554.0?external=react,react-dom',
    },
  })}<\/script>
<script src="https://cdn.tailwindcss.com"><\/script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: ${bodyBg}; color: ${bodyColor}; font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; display: flex; justify-content: center; align-items: center; }
#root { display: flex; justify-content: center; align-items: center; width: 100%; min-height: 100vh; }
#error-overlay { position: fixed; inset: 0; background: rgba(10,10,26,0.95); color: #f87171; padding: 24px; font-size: 13px; font-family: 'JetBrains Mono', monospace, monospace; white-space: pre-wrap; overflow: auto; z-index: 9999; display: none; }
#error-overlay .err-title { color: #fca5a5; font-weight: 700; font-size: 14px; margin-bottom: 12px; }
#error-overlay .err-msg { color: #f87171; line-height: 1.6; }
#error-overlay .err-stack { color: #888; font-size: 12px; margin-top: 8px; }
</style>
</head>
<body>
<div id="root"></div>
<div id="error-overlay"><div class="err-title">Preview Error</div><div class="err-msg" id="err-msg"></div><div class="err-stack" id="err-stack"></div></div>
<script type="module">
function showError(msg, stack) {
  var overlay = document.getElementById('error-overlay');
  var msgEl = document.getElementById('err-msg');
  var stackEl = document.getElementById('err-stack');
  overlay.style.display = 'block';
  msgEl.textContent = msg;
  stackEl.textContent = stack || '';
  try {
    window.parent.postMessage({ type: 'preview-errors', errors: [msg], loadErrors: [], complete: true }, '*');
  } catch(e) {}
}

window.addEventListener('error', function(e) {
  showError(e.message, e.filename + ':' + e.lineno);
});
window.addEventListener('unhandledrejection', function(e) {
  showError('Unhandled rejection: ' + (e.reason?.message || e.reason || 'unknown'), e.reason?.stack);
});

try {
  const [React, ReactDOM, ReactDOMClient] = await Promise.all([
    import('react'),
    import('react-dom'),
    import('react-dom/client'),
  ]);
  if (!window.React) window.React = React;
  if (!window.ReactDOM) window.ReactDOM = { ...ReactDOM };
  if (!window.ReactDOM.createRoot) window.ReactDOM.createRoot = ReactDOMClient.createRoot;

  await import('/api/library/components/${componentId}/compiled');

  try {
    window.parent.postMessage({ type: 'preview-errors', errors: [], loadErrors: [], complete: true }, '*');
  } catch(e) {}
} catch(e) {
  showError(e.message, e.stack);
}
<\/script>
</body>
</html>`;
}

export function buildPreviewHtml(files: LibraryComponentFile[], componentId?: string, isDark: boolean = false): string {
  if (!files || files.length === 0) return '';

  const hasTsx = files.some(f => f.filename.endsWith('.tsx') || f.filename.endsWith('.jsx'));
  if (hasTsx) {
    if (!componentId) return '';
    return buildTsxPreview(componentId, isDark);
  }

  const entry = files.find(f => f.isEntry) || files.find(f => f.filename.endsWith('.html')) || files[0];
  if (!entry) return '';

  const bodyBg = isDark ? '#1a1a1a' : '#ffffff';
  const bodyColor = isDark ? '#ececec' : '#1a1a1a';
  const themeStyle = `<style>html,body{background:${bodyBg};color:${bodyColor};display:flex;justify-content:center;align-items:center;min-height:100vh}</style>`;

  if (entry.contentType === 'html') {
    let html = entry.content;
    const cssFiles = files.filter(f => f.contentType === 'css' && f.id !== entry.id);
    const jsFiles = files.filter(f => f.contentType === 'js' && f.id !== entry.id);

    const cssBlock = cssFiles.map(f => `<style data-file="${f.filename}">\n${f.content}\n</style>`).join('\n');
    const jsBlock = jsFiles.map(f => `<script data-file="${f.filename}">\n${f.content}\n<\/script>`).join('\n');

    const inject = themeStyle + '\n' + cssBlock;
    if (inject.trim()) {
      if (html.includes('</head>')) {
        html = html.replace('</head>', inject + '\n</head>');
      } else {
        html = inject + '\n' + html;
      }
    }
    if (jsBlock) {
      if (html.includes('</body>')) {
        html = html.replace('</body>', jsBlock + '\n</body>');
      } else {
        html = html + '\n' + jsBlock;
      }
    }
    return html;
  }

  if (entry.contentType === 'js') {
    return `<!DOCTYPE html><html><head>${themeStyle}</head><body><pre style="font-family:monospace;padding:1rem;color:${bodyColor};background:${bodyBg};min-height:100vh;white-space:pre-wrap">${entry.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
  }

  if (entry.contentType === 'css') {
    return `<!DOCTYPE html><html><head>${themeStyle}<style>${entry.content}</style></head><body><div style="font-family:system-ui;padding:2rem;color:${isDark ? '#b4b4b4' : '#888'}"><p>CSS Preview</p><p class="test">This text uses the component's stylesheet.</p></div></body></html>`;
  }

  return `<!DOCTYPE html><html><head>${themeStyle}</head><body><pre style="font-family:monospace;padding:1rem;color:${bodyColor};background:${bodyBg};min-height:100vh;white-space:pre-wrap">${entry.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
}

export function buildThemePreviewHtml(files: LibraryComponentFile[], componentId?: string, isDark: boolean = false): string {
  const cssFile = files.find(f => f.filename.endsWith('.css'));
  if (!cssFile) return buildPreviewHtml(files, componentId, isDark);

  const cssContent = cssFile.content;
  const hasDarkVars = /\.dark\s*\{/.test(cssContent) || cssContent.includes('.dark ');

  return `<!DOCTYPE html>
<html${isDark && hasDarkVars ? ' class="dark"' : ''}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://cdn.tailwindcss.com"><\/script>
<style>
${cssContent}

* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: var(--font-sans, system-ui, sans-serif);
  background: var(--background, #fff);
  color: var(--foreground, #333);
  padding: 1.5rem;
  min-height: 100vh;
}
</style>
</head>
<body>
<div style="max-width:100%;margin:0 auto">
  <div style="display:flex;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap">
    <span style="background:var(--primary,#8839ef);color:var(--primary-foreground,#fff);padding:0.375rem 0.875rem;border-radius:var(--radius,6px);font-size:0.8125rem;font-weight:600">Primary</span>
    <span style="background:var(--secondary,#ccd0da);color:var(--secondary-foreground,#333);padding:0.375rem 0.875rem;border-radius:var(--radius,6px);font-size:0.8125rem;font-weight:600">Secondary</span>
    <span style="background:var(--accent,#04a5e5);color:var(--accent-foreground,#fff);padding:0.375rem 0.875rem;border-radius:var(--radius,6px);font-size:0.8125rem;font-weight:600">Accent</span>
    <span style="background:var(--destructive,#d20f39);color:var(--destructive-foreground,#fff);padding:0.375rem 0.875rem;border-radius:var(--radius,6px);font-size:0.8125rem;font-weight:600">Destructive</span>
    <span style="background:var(--muted,#dce0e8);color:var(--muted-foreground,#666);padding:0.375rem 0.875rem;border-radius:var(--radius,6px);font-size:0.8125rem;font-weight:600">Muted</span>
  </div>

  <div style="background:var(--card,#fff);color:var(--card-foreground,#333);border:1px solid var(--border,#ddd);border-radius:var(--radius,6px);padding:1.25rem;margin-bottom:1rem;box-shadow:0 var(--shadow-offset-y,4px) var(--shadow-blur,6px) var(--shadow-spread,0px) var(--shadow-color,rgba(0,0,0,0.1))">
    <div style="font-size:1rem;font-weight:700;margin-bottom:0.25rem">Card Title</div>
    <div style="font-size:0.8125rem;color:var(--muted-foreground,#888);margin-bottom:1rem">A card component using the theme variables</div>
    <div style="display:flex;gap:0.5rem">
      <button style="background:var(--primary,#8839ef);color:var(--primary-foreground,#fff);border:none;padding:0.5rem 1rem;border-radius:var(--radius,6px);font-size:0.8125rem;font-weight:600;cursor:pointer">Button</button>
      <button style="background:transparent;color:var(--foreground,#333);border:1px solid var(--border,#ddd);padding:0.5rem 1rem;border-radius:var(--radius,6px);font-size:0.8125rem;font-weight:600;cursor:pointer">Outline</button>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem">
    <div style="background:var(--card,#fff);color:var(--card-foreground,#333);border:1px solid var(--border,#ddd);border-radius:var(--radius,6px);padding:1rem">
      <div style="font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted-foreground,#888);margin-bottom:0.25rem">Input</div>
      <div style="background:var(--background,#f5f5f5);border:1px solid var(--input,#ccc);border-radius:var(--radius,6px);padding:0.5rem 0.75rem;font-size:0.8125rem;color:var(--foreground,#333)">Text field</div>
    </div>
    <div style="background:var(--popover,#eee);color:var(--popover-foreground,#333);border:1px solid var(--border,#ddd);border-radius:var(--radius,6px);padding:1rem">
      <div style="font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted-foreground,#888);margin-bottom:0.25rem">Popover</div>
      <div style="font-size:0.8125rem">Popover content area</div>
    </div>
  </div>

  <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:1rem">
    <div style="width:1.5rem;height:1.5rem;border-radius:var(--radius,6px);background:var(--chart-1,#8839ef)"></div>
    <div style="width:1.5rem;height:1.5rem;border-radius:var(--radius,6px);background:var(--chart-2,#04a5e5)"></div>
    <div style="width:1.5rem;height:1.5rem;border-radius:var(--radius,6px);background:var(--chart-3,#40a02b)"></div>
    <div style="width:1.5rem;height:1.5rem;border-radius:var(--radius,6px);background:var(--chart-4,#fe640b)"></div>
    <div style="width:1.5rem;height:1.5rem;border-radius:var(--radius,6px);background:var(--chart-5,#dc8a78)"></div>
    <span style="font-size:0.6875rem;color:var(--muted-foreground,#888);margin-left:0.5rem">Chart palette</span>
  </div>

  <div style="background:var(--sidebar,#e6e9ef);color:var(--sidebar-foreground,#333);border:1px solid var(--sidebar-border,#ddd);border-radius:var(--radius,6px);padding:1rem">
    <div style="display:flex;align-items:center;gap:0.75rem">
      <div style="background:var(--sidebar-primary,#8839ef);color:var(--sidebar-primary-foreground,#fff);padding:0.25rem 0.625rem;border-radius:var(--radius,6px);font-size:0.75rem;font-weight:600">Active</div>
      <div style="color:var(--sidebar-foreground,#333);font-size:0.75rem">Sidebar item</div>
      <div style="margin-left:auto;background:var(--sidebar-accent,#04a5e5);color:var(--sidebar-accent-foreground,#fff);padding:0.25rem 0.625rem;border-radius:var(--radius,6px);font-size:0.75rem;font-weight:600">Accent</div>
    </div>
    <div style="margin-top:0.5rem;height:2px;background:var(--sidebar-ring,#8839ef);border-radius:1px;width:60%"></div>
  </div>
</div>
</body>
</html>`;
}
