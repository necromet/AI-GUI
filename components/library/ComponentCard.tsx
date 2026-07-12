import React, { useMemo } from 'react';
import { Trash2, Copy, Check, FileCode, MoreVertical, Pencil, ArrowUpRight, FolderInput } from 'lucide-react';
import { LibraryComponent, LibraryFolder, LibraryComponentFile } from '../../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { CATEGORY_LABELS } from './constants';

interface ComponentCardProps {
  component: LibraryComponent;
  index: number;
  copiedId: string | null;
  onSelect: (comp: LibraryComponent) => void;
  onCopy: (comp: LibraryComponent, e?: React.MouseEvent) => void;
  onDelete: (id: string, e?: React.MouseEvent) => void;
  onEdit: (comp: LibraryComponent, e?: React.MouseEvent) => void;
  onMoveToFolder?: (componentId: string, folderId: string | null) => void;
  folders?: LibraryFolder[];
}

function buildCardPreview(files?: LibraryComponentFile[], componentId?: string, category?: string): string | null {
  if (!files || files.length === 0) return null;

  if (category === 'theme') {
    const cssFile = files.find(f => f.filename.endsWith('.css'));
    if (!cssFile) return null;
    const htmlFile = files.find(f => f.filename.endsWith('.html'));
    const css = cssFile.content;
    const hasDark = /\.dark\s*\{/.test(css);
    if (htmlFile) {
      let html = htmlFile.content;
      if (hasDark && !html.includes('class="dark"')) html = html.replace(/<html/, '<html class="dark"');
      html = html.replace(/<link rel="stylesheet" href="theme\.css">/, `<style>${css}</style>`);
      return html;
    }
    return `<!DOCTYPE html><html${hasDark ? ' class="dark"' : ''}><head><meta charset="UTF-8"><style>${css}*{margin:0;padding:0;box-sizing:border-box}body{font-family:var(--font-sans,system-ui);background:var(--background,#fff);color:var(--foreground,#333);padding:1rem;min-height:100vh;overflow:hidden}</style></head><body><div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;flex-wrap:wrap"><span style="background:var(--primary);color:var(--primary-foreground);padding:0.25rem 0.625rem;border-radius:var(--radius);font-size:0.6875rem;font-weight:600">Primary</span><span style="background:var(--secondary);color:var(--secondary-foreground);padding:0.25rem 0.625rem;border-radius:var(--radius);font-size:0.6875rem;font-weight:600">Secondary</span><span style="background:var(--accent);color:var(--accent-foreground);padding:0.25rem 0.625rem;border-radius:var(--radius);font-size:0.6875rem;font-weight:600">Accent</span><span style="background:var(--destructive);color:var(--destructive-foreground);padding:0.25rem 0.625rem;border-radius:var(--radius);font-size:0.6875rem;font-weight:600">Destructive</span></div><div style="background:var(--card);color:var(--card-foreground);border:1px solid var(--border);border-radius:var(--radius);padding:0.875rem;margin-bottom:0.75rem;box-shadow:0 var(--shadow-offset-y,4px) var(--shadow-blur,6px) var(--shadow-spread,0px) var(--shadow-color,rgba(0,0,0,0.1))"><div style="font-size:0.875rem;font-weight:700;margin-bottom:0.125rem">Card Title</div><div style="font-size:0.6875rem;color:var(--muted-foreground);margin-bottom:0.75rem">Styled with theme variables</div><div style="display:flex;gap:0.375rem"><button style="background:var(--primary);color:var(--primary-foreground);border:none;padding:0.375rem 0.75rem;border-radius:var(--radius);font-size:0.6875rem;font-weight:600">Button</button><button style="background:transparent;color:var(--foreground);border:1px solid var(--border);padding:0.375rem 0.75rem;border-radius:var(--radius);font-size:0.6875rem;font-weight:600">Outline</button></div></div><div style="display:flex;gap:0.375rem;align-items:center"><div style="width:1.25rem;height:1.25rem;border-radius:var(--radius);background:var(--chart-1)"></div><div style="width:1.25rem;height:1.25rem;border-radius:var(--radius);background:var(--chart-2)"></div><div style="width:1.25rem;height:1.25rem;border-radius:var(--radius);background:var(--chart-3)"></div><div style="width:1.25rem;height:1.25rem;border-radius:var(--radius);background:var(--chart-4)"></div><div style="width:1.25rem;height:1.25rem;border-radius:var(--radius);background:var(--chart-5)"></div><span style="font-size:0.625rem;color:var(--muted-foreground);margin-left:0.375rem">Charts</span></div></body></html>`;
  }

  const hasTsx = files.some(f => f.filename.endsWith('.tsx') || f.filename.endsWith('.jsx'));
  if (hasTsx) {
    if (!componentId) return null;
    const importmap = JSON.stringify({
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
    });
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:#1a1a1a;color:#ececec;font-family:system-ui,sans-serif;height:100%;overflow:hidden;display:flex;justify-content:center;align-items:center}#root{width:100%;height:100%}#e{position:fixed;inset:0;background:rgba(10,10,26,0.92);color:#f87171;padding:12px;font:11px 'JetBrains Mono',monospace;white-space:pre-wrap;overflow:auto;z-index:9999;display:none}</style><script type="importmap">${importmap}</script><script src="https://cdn.tailwindcss.com"></script></head><body><div id="root"></div><div id="e"></div><script type="module">function s(m){var e=document.getElementById('e');e.style.display='block';e.textContent=m}window.onerror=function(m){s(m)};window.onunhandledrejection=function(e){s('Unhandled: '+(e.reason?.message||e.reason))};try{const[R,_,RC]=await Promise.all([import('react'),import('react-dom'),import('react-dom/client')]);if(!window.React)window.React=R;if(!window.ReactDOM)window.ReactDOM={..._};if(!window.ReactDOM.createRoot)window.ReactDOM.createRoot=RC.createRoot;await import('/api/library/components/${componentId}/compiled')}catch(e){s(e.message)}</script></body></html>`;
  }

  const entry = files.find(f => f.isEntry) || files.find(f => f.filename.endsWith('.html')) || files[0];
  if (!entry) return null;

  const bodyBg = '#1a1a1a';
  const bodyColor = '#ececec';
  const base = `<style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:${bodyBg};color:${bodyColor};font-family:system-ui,sans-serif;height:100%;overflow:hidden;display:flex;justify-content:center;align-items:center}</style>`;

  if (entry.contentType === 'html') {
    let html = entry.content;
    const cssFiles = files.filter(f => f.contentType === 'css' && f.id !== entry.id);
    const jsFiles = files.filter(f => f.contentType === 'js' && f.id !== entry.id);
    const cssBlock = cssFiles.map(f => `<style>${f.content}</style>`).join('');
    const jsBlock = jsFiles.map(f => `<script>${f.content}<\/script>`).join('');
    const inject = base + cssBlock;
    if (html.includes('</head>')) {
      html = html.replace('</head>', inject + '</head>');
    } else {
      html = inject + html;
    }
    if (jsBlock) {
      if (html.includes('</body>')) {
        html = html.replace('</body>', jsBlock + '</body>');
      } else {
        html = html + jsBlock;
      }
    }
    return html;
  }

  if (entry.contentType === 'css') {
    return `<!DOCTYPE html><html><head>${base}<style>${entry.content}</style></head><body><div style="padding:1.5rem"><p style="margin-bottom:0.5rem;opacity:0.5;font-size:12px">CSS Preview</p><p class="test">The quick brown fox jumps over the lazy dog.</p></div></body></html>`;
  }

  if (entry.contentType === 'js' || entry.contentType === 'ts') {
    const lines = entry.content.split('\n').slice(0, 12).join('\n');
    return `<!DOCTYPE html><html><head>${base}</head><body><pre style="font:11px 'JetBrains Mono',monospace;padding:1rem;white-space:pre-wrap;overflow:hidden;opacity:0.7">${lines.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
  }

  if (entry.contentType === 'json') {
    try {
      const pretty = JSON.stringify(JSON.parse(entry.content), null, 2).split('\n').slice(0, 12).join('\n');
      return `<!DOCTYPE html><html><head>${base}</head><body><pre style="font:11px 'JetBrains Mono',monospace;padding:1rem;white-space:pre-wrap;overflow:hidden;opacity:0.7">${pretty.replace(/</g, '&lt;')}</pre></body></html>`;
    } catch {
      return null;
    }
  }

  if (entry.contentType === 'markdown') {
    const lines = entry.content.split('\n').slice(0, 10).join('\n');
    return `<!DOCTYPE html><html><head>${base}</head><body><pre style="font:12px system-ui;padding:1rem;white-space:pre-wrap;overflow:hidden;opacity:0.7;line-height:1.5">${lines.replace(/</g, '&lt;')}</pre></body></html>`;
  }

  return null;
}

export const ComponentCard: React.FC<ComponentCardProps> = ({
  component: comp,
  index,
  copiedId,
  onSelect,
  onCopy,
  onDelete,
  onEdit,
  onMoveToFolder,
  folders,
}) => {
  const isScored = 'score' in comp;
  const previewHtml = useMemo(() => buildCardPreview(comp.files, comp.id, comp.category), [comp.files, comp.id, comp.category]);

  return (
    <div
      className="library-card group relative rounded-2xl cursor-pointer transition-all duration-300 ease-out animate-fade-in"
      style={{
        backgroundColor: 'var(--bg-200)',
        border: '1px solid var(--border-300)',
        animationFillMode: 'both',
        animationDelay: `${index * 50}ms`,
      }}
      onClick={() => onSelect(comp)}
    >
      {/* Gradient border glow on hover */}
      <div
        className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, rgba(var(--neon-rgb), 0.2), transparent 60%)`,
          borderRadius: 'inherit',
          zIndex: 0,
        }}
      />

      <div className="relative z-10 flex flex-col">
        {/* Preview */}
        {previewHtml && (
          <div
            className="relative overflow-hidden rounded-t-2xl"
            style={{ height: 140, backgroundColor: '#1a1a1a' }}
          >
            <iframe
              srcDoc={previewHtml}
              sandbox="allow-scripts"
              className="w-full h-full border-0 pointer-events-none"
              style={{
                width: '200%',
                height: '200%',
                transform: 'scale(0.5)',
                transformOrigin: 'top left',
              }}
              title={`Preview of ${comp.name}`}
              tabIndex={-1}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(to bottom, transparent 60%, var(--bg-200))',
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="p-5">
          {/* Top row: Category + Actions */}
          <div className="flex items-start justify-between mb-3">
            <Badge
              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md"
              style={{
                backgroundColor: 'rgba(var(--neon-rgb), 0.1)',
                color: 'var(--neon-color)',
                border: '1px solid rgba(var(--neon-rgb), 0.15)',
              }}
            >
              {CATEGORY_LABELS[comp.category] || comp.category}
            </Badge>

            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: 'var(--text-500)' }}
                  >
                    <MoreVertical size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[160px]"
                  style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}
                  onClick={(e) => e.stopPropagation()}
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  <DropdownMenuItem
                    onSelect={() => onEdit(comp)}
                    className="gap-2 text-xs"
                    style={{ color: 'var(--text-200)' }}
                  >
                    <Pencil size={13} />
                    Edit details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => onCopy(comp)}
                    className="gap-2 text-xs"
                    style={{ color: 'var(--text-200)' }}
                  >
                    {copiedId === comp.id ? <Check size={13} style={{ color: '#4ade80' }} /> : <Copy size={13} />}
                    {copiedId === comp.id ? 'Copied!' : 'Copy content'}
                  </DropdownMenuItem>
                  {onMoveToFolder && folders && folders.length > 0 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="gap-2 text-xs" style={{ color: 'var(--text-200)' }}>
                        <FolderInput size={13} />
                        Move to folder
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent
                        className="min-w-[160px]"
                        style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}
                      >
                        {comp.folderId && (
                          <DropdownMenuItem
                            onSelect={() => onMoveToFolder(comp.id, null)}
                            className="gap-2 text-xs"
                            style={{ color: 'var(--text-200)' }}
                          >
                            <FolderInput size={13} />
                            Remove from folder
                          </DropdownMenuItem>
                        )}
                        {folders.map(folder => (
                          <DropdownMenuItem
                            key={folder.id}
                            onSelect={() => onMoveToFolder(comp.id, folder.id)}
                            className="gap-2 text-xs"
                            style={{ color: 'var(--text-200)' }}
                            disabled={comp.folderId === folder.id}
                          >
                            <FolderInput size={13} style={{ color: folder.color }} />
                            {folder.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => onDelete(comp.id)}
                    className="gap-2 text-xs text-red-500 focus:text-red-500"
                  >
                    <Trash2 size={13} />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Title + Description */}
          <div className="mb-4">
            <h3
              className="text-[15px] font-semibold leading-snug mb-1 line-clamp-1 group-hover:text-[var(--neon-color)] transition-colors duration-200"
              style={{ color: 'var(--text-100)' }}
            >
              {comp.name}
            </h3>
            <p
              className="text-xs leading-relaxed line-clamp-2"
              style={{ color: 'var(--text-500)' }}
            >
              {comp.description}
            </p>
          </div>

          {/* Footer: Tags + Meta */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 rounded font-mono"
                style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}
              >
                {comp.contentType}
              </Badge>
              {comp.tags.slice(0, 2).map((tag, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 rounded"
                  style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}
                >
                  {tag}
                </Badge>
              ))}
              {comp.tags.length > 2 && (
                <span className="text-[10px]" style={{ color: 'var(--text-500)' }}>
                  +{comp.tags.length - 2}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {comp.files && comp.files.length > 1 && (
                <div className="flex items-center gap-1">
                  <FileCode size={11} style={{ color: 'var(--text-500)' }} />
                  <span className="text-[10px] font-medium" style={{ color: 'var(--text-500)' }}>
                    {comp.files.length}
                  </span>
                </div>
              )}
              {isScored && (
                <Badge
                  className="text-[10px] px-1.5 py-0 rounded"
                  style={{
                    backgroundColor: 'rgba(var(--neon-rgb), 0.12)',
                    color: 'var(--neon-color)',
                  }}
                >
                  {((comp as any).score * 100).toFixed(0)}%
                </Badge>
              )}
              <ArrowUpRight
                size={14}
                className="opacity-0 group-hover:opacity-60 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                style={{ color: 'var(--text-300)' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
