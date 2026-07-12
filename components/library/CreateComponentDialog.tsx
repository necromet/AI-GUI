import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Upload, Trash2, Plus, Sparkles, File, Palette } from 'lucide-react';
import { LibraryComponent } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CATEGORIES, deriveContentType, getFileIcon } from './constants';

interface CreateComponentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (component: LibraryComponent) => void;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  defaultFolderId?: string;
}

interface CreateFileEntry {
  filename: string;
  contentType: string;
  content: string;
  isEntry: boolean;
}

interface NewComponentState {
  name: string;
  category: LibraryComponent['category'];
  contentType: LibraryComponent['contentType'];
  description: string;
  tags: string;
  content: string;
}

const defaultNewComponent: NewComponentState = {
  name: '',
  category: 'ui-widget',
  contentType: 'html',
  description: '',
  tags: '',
  content: '',
};

const defaultCreateFiles: CreateFileEntry[] = [
  { filename: 'index.html', contentType: 'html', content: '', isEntry: true },
];

const THEME_TEMPLATE = `:root {
  --card: #ffffff;
  --ring: #8839ef;
  --input: #ccd0da;
  --muted: #dce0e8;
  --accent: #04a5e5;
  --border: #bcc0cc;
  --radius: 0.35rem;
  --chart-1: #8839ef;
  --chart-2: #04a5e5;
  --chart-3: #40a02b;
  --chart-4: #fe640b;
  --chart-5: #dc8a78;
  --popover: #ccd0da;
  --primary: #8839ef;
  --sidebar: #e6e9ef;
  --font-mono: Fira Code, monospace;
  --font-sans: Montserrat, sans-serif;
  --secondary: #ccd0da;
  --background: #eff1f5;
  --font-serif: Georgia, serif;
  --foreground: #4c4f69;
  --destructive: #d20f39;
  --shadow-blur: 6px;
  --shadow-color: hsl(240 30% 25%);
  --sidebar-ring: #8839ef;
  --shadow-spread: 0px;
  --shadow-opacity: 0.12;
  --sidebar-accent: #04a5e5;
  --sidebar-border: #bcc0cc;
  --card-foreground: #4c4f69;
  --shadow-offset-x: 0px;
  --shadow-offset-y: 4px;
  --sidebar-primary: #8839ef;
  --muted-foreground: #6c6f85;
  --accent-foreground: #ffffff;
  --popover-foreground: #4c4f69;
  --primary-foreground: #ffffff;
  --sidebar-foreground: #4c4f69;
  --secondary-foreground: #4c4f69;
  --destructive-foreground: #ffffff;
  --sidebar-accent-foreground: #ffffff;
  --sidebar-primary-foreground: #ffffff;
}

.dark {
  --card: #1e1e2e;
  --ring: #cba6f7;
  --input: #313244;
  --muted: #292c3c;
  --accent: #89dceb;
  --border: #313244;
  --chart-1: #cba6f7;
  --chart-2: #89dceb;
  --chart-3: #a6e3a1;
  --chart-4: #fab387;
  --chart-5: #f5e0dc;
  --popover: #45475a;
  --primary: #cba6f7;
  --sidebar: #11111b;
  --secondary: #585b70;
  --background: #181825;
  --foreground: #cdd6f4;
  --destructive: #f38ba8;
  --sidebar-ring: #cba6f7;
  --sidebar-accent: #89dceb;
  --sidebar-border: #45475a;
  --card-foreground: #cdd6f4;
  --sidebar-primary: #cba6f7;
  --muted-foreground: #a6adc8;
  --accent-foreground: #1e1e2e;
  --popover-foreground: #cdd6f4;
  --primary-foreground: #1e1e2e;
  --sidebar-foreground: #cdd6f4;
  --secondary-foreground: #cdd6f4;
  --destructive-foreground: #1e1e2e;
  --sidebar-accent-foreground: #1e1e2e;
  --sidebar-primary-foreground: #1e1e2e;
}`;

function buildThemePreviewInline(): string {
  return `<!DOCTYPE html><html class="dark"><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script><style>${THEME_TEMPLATE}*{margin:0;padding:0;box-sizing:border-box}body{font-family:var(--font-sans,system-ui);background:var(--background,#fff);color:var(--foreground,#333);padding:1rem;min-height:100vh;overflow:hidden}</style></head><body><div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;flex-wrap:wrap"><span style="background:var(--primary);color:var(--primary-foreground);padding:0.25rem 0.625rem;border-radius:var(--radius);font-size:0.6875rem;font-weight:600">Primary</span><span style="background:var(--secondary);color:var(--secondary-foreground);padding:0.25rem 0.625rem;border-radius:var(--radius);font-size:0.6875rem;font-weight:600">Secondary</span><span style="background:var(--accent);color:var(--accent-foreground);padding:0.25rem 0.625rem;border-radius:var(--radius);font-size:0.6875rem;font-weight:600">Accent</span><span style="background:var(--destructive);color:var(--destructive-foreground);padding:0.25rem 0.625rem;border-radius:var(--radius);font-size:0.6875rem;font-weight:600">Destructive</span></div><div style="background:var(--card);color:var(--card-foreground);border:1px solid var(--border);border-radius:var(--radius);padding:0.875rem;margin-bottom:0.75rem"><div style="font-size:0.875rem;font-weight:700;margin-bottom:0.125rem">Card Title</div><div style="font-size:0.6875rem;color:var(--muted-foreground);margin-bottom:0.75rem">Styled with theme variables</div><div style="display:flex;gap:0.375rem"><button style="background:var(--primary);color:var(--primary-foreground);border:none;padding:0.375rem 0.75rem;border-radius:var(--radius);font-size:0.6875rem;font-weight:600">Button</button><button style="background:transparent;color:var(--foreground);border:1px solid var(--border);padding:0.375rem 0.75rem;border-radius:var(--radius);font-size:0.6875rem;font-weight:600">Outline</button></div></div><div style="display:flex;gap:0.375rem;align-items:center"><div style="width:1.25rem;height:1.25rem;border-radius:var(--radius);background:var(--chart-1)"></div><div style="width:1.25rem;height:1.25rem;border-radius:var(--radius);background:var(--chart-2)"></div><div style="width:1.25rem;height:1.25rem;border-radius:var(--radius);background:var(--chart-3)"></div><div style="width:1.25rem;height:1.25rem;border-radius:var(--radius);background:var(--chart-4)"></div><div style="width:1.25rem;height:1.25rem;border-radius:var(--radius);background:var(--chart-5)"></div><span style="font-size:0.625rem;color:var(--muted-foreground);margin-left:0.375rem">Charts</span></div></body></html>`;
}

export const CreateComponentDialog: React.FC<CreateComponentDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
  onNotification,
  defaultFolderId,
}) => {
  const [newComponent, setNewComponent] = useState<NewComponentState>(defaultNewComponent);
  const [createFiles, setCreateFiles] = useState<CreateFileEntry[]>(defaultCreateFiles);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isTheme = newComponent.category === 'theme';
  const themePreviewHtml = useMemo(() => buildThemePreviewInline(), []);

  useEffect(() => {
    if (!open) {
      requestAnimationFrame(() => {
        document.body.style.pointerEvents = '';
      });
    }
  }, [open]);

  useEffect(() => {
    if (isTheme) {
      setCreateFiles([{ filename: 'theme.css', contentType: 'css', content: THEME_TEMPLATE, isEntry: true }]);
    } else {
      setCreateFiles(defaultCreateFiles);
    }
  }, [isTheme]);

  const handleRemoveCreateFile = (index: number) => {
    setCreateFiles(prev => {
      const remaining = prev.filter((_, i) => i !== index);
      if (remaining.length === 0) return [{ filename: 'index.html', contentType: 'html', content: '', isEntry: true }];
      if (!remaining.some(f => f.isEntry)) remaining[0].isEntry = true;
      return remaining;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const readFile = (file: File): Promise<CreateFileEntry> =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            filename: file.name,
            contentType: deriveContentType(file.name),
            content: typeof reader.result === 'string' ? reader.result : '',
            isEntry: false,
          });
        };
        reader.readAsText(file);
      });

    const uploaded = await Promise.all(Array.from(files).map(readFile));
    if (uploaded.length > 0) uploaded[0].isEntry = true;

    setCreateFiles(prev => {
      const merged = prev.length === 1 && !prev[0].content.trim() ? uploaded : [...prev, ...uploaded];
      if (!merged.some(f => f.isEntry)) merged[0].isEntry = true;
      return merged;
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreate = async () => {
    if (!newComponent.name) return;
    const filesToSend = createFiles.map(f => ({
      filename: f.filename,
      contentType: f.contentType,
      content: f.content,
      isEntry: f.isEntry,
    }));
    try {
      const body: any = {
        name: newComponent.name,
        category: newComponent.category,
        description: newComponent.description,
        tags: newComponent.tags.split(',').map(t => t.trim()).filter(Boolean),
        isGlobal: true,
        agentAccessible: true,
        folderId: defaultFolderId || null,
        files: filesToSend,
      };

      const response = await fetch('/api/library/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Failed to create component');
      const data = await response.json();
      onCreated(data.component);
      onOpenChange(false);
      setNewComponent(defaultNewComponent);
      setCreateFiles(defaultCreateFiles);
      onNotification?.('Component created', 'success');
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setCreateFiles(defaultCreateFiles);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl p-0 gap-0 overflow-hidden"
        style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)' }}
      >
        {/* Header */}
        <div
          className="px-6 pt-6 pb-4"
          style={{
            background: 'linear-gradient(180deg, rgba(var(--neon-rgb), 0.04), transparent)',
          }}
        >
          <DialogHeader className="gap-1">
            <DialogTitle className="flex items-center gap-2 text-lg" style={{ color: 'var(--text-100)' }}>
              <div
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: isTheme ? '#8839ef1a' : 'rgba(var(--neon-rgb), 0.1)' }}
              >
                {isTheme ? <Palette size={16} style={{ color: '#8839ef' }} /> : <Plus size={16} style={{ color: 'var(--neon-color)' }} />}
              </div>
              {isTheme ? 'New Theme' : 'New Component'}
            </DialogTitle>
            <DialogDescription className="text-sm" style={{ color: 'var(--text-500)' }}>
              {isTheme
                ? 'Create a color theme with CSS variables. A starter template is pre-filled for you.'
                : 'Create a reusable component for your library'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Name + Category row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>
                Name <span style={{ color: 'var(--neon-color)' }}>*</span>
              </Label>
              <Input
                type="text"
                value={newComponent.name}
                onChange={e => setNewComponent(prev => ({ ...prev, name: e.target.value }))}
                placeholder={isTheme ? 'e.g. Catppuccin Latte' : 'e.g. Animated Card'}
                className="h-9 text-sm rounded-lg"
                style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Category</Label>
              <Select
                value={newComponent.category}
                onValueChange={value => setNewComponent(prev => ({ ...prev, category: value as any }))}
              >
                <SelectTrigger className="h-9 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
                  {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                    <SelectItem key={c.key} value={c.key} className="text-sm" style={{ color: 'var(--text-100)' }}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Description</Label>
            <Textarea
              value={newComponent.description}
              onChange={e => setNewComponent(prev => ({ ...prev, description: e.target.value }))}
              placeholder={isTheme ? 'e.g. A warm pastel light/dark theme inspired by Catppuccin' : 'What does this component do?'}
              className="text-sm min-h-[72px] resize-y rounded-lg"
              style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Tags</Label>
            <Input
              type="text"
              value={newComponent.tags}
              onChange={e => setNewComponent(prev => ({ ...prev, tags: e.target.value }))}
              placeholder={isTheme ? 'catppuccin, pastel, light, dark (comma-separated)' : 'react, animation, ui (comma-separated)'}
              className="h-9 text-sm rounded-lg"
              style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
            />
          </div>

          <Separator style={{ backgroundColor: 'var(--border-300)' }} />

          {/* Theme preview or Files section */}
          {isTheme ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>
                  Theme Preview
                </Label>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded font-mono" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}>
                  theme.css
                </Badge>
              </div>
              <div
                className="rounded-xl overflow-hidden"
                style={{ height: 200, backgroundColor: '#11111b', border: '1px solid var(--border-300)' }}
              >
                <iframe
                  srcDoc={themePreviewHtml}
                  className="w-full h-full border-0"
                  style={{
                    width: '200%',
                    height: '200%',
                    transform: 'scale(0.5)',
                    transformOrigin: 'top left',
                  }}
                  title="Theme preview"
                  tabIndex={-1}
                />
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-500)' }}>
                A starter CSS template with all theme variables is pre-filled. Edit colors in the component editor after creation.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>
                  Files <span style={{ color: 'var(--neon-color)' }}>*</span>
                </Label>
                <span className="text-[10px]" style={{ color: 'var(--text-500)' }}>
                  {createFiles.length} file{createFiles.length !== 1 ? 's' : ''}
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                accept=".html,.htm,.css,.js,.jsx,.ts,.tsx,.json,.md"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 py-5 rounded-xl border border-dashed transition-all duration-200 hover:border-[rgba(var(--neon-rgb),0.3)] hover:bg-[rgba(var(--neon-rgb),0.02)]"
                style={{ borderColor: 'var(--border-300)', color: 'var(--text-500)' }}
              >
                <Upload size={18} style={{ color: 'var(--neon-color)', opacity: 0.5 }} />
                <div className="text-left">
                  <span className="text-sm font-medium block" style={{ color: 'var(--text-300)' }}>
                    Click to upload files
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text-500)' }}>
                    HTML, CSS, JS, TS, TSX, JSON, Markdown
                  </span>
                </div>
              </button>

              {createFiles.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg p-1" style={{ backgroundColor: 'var(--bg-200)' }}>
                  {createFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--bg-300)]"
                    >
                      <div className="flex-shrink-0" style={{ color: 'var(--text-500)' }}>
                        {getFileIcon(file.filename)}
                      </div>
                      <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--text-100)' }}>
                        {file.filename}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1.5 py-0 rounded font-mono"
                        style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}
                      >
                        {file.contentType}
                      </Badge>
                      {file.isEntry && (
                        <Badge
                          className="text-[9px] px-1.5 py-0 rounded"
                          style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.12)', color: 'var(--neon-color)' }}
                        >
                          entry
                        </Badge>
                      )}
                      <button
                        onClick={() => handleRemoveCreateFile(idx)}
                        className="p-1 rounded-md transition-colors hover:bg-red-500/10"
                        style={{ color: 'var(--text-500)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={handleCancel}
              className="h-9 px-4 rounded-lg text-sm"
              style={{ color: 'var(--text-500)' }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newComponent.name}
              className="h-9 px-5 rounded-lg text-sm font-semibold gap-1.5"
              style={{
                background: isTheme
                  ? 'linear-gradient(135deg, #8839ef, #cba6f7)'
                  : 'linear-gradient(135deg, var(--neon-color), rgba(var(--neon-rgb), 0.8))',
                color: '#000',
                boxShadow: isTheme ? '0 2px 12px rgba(136, 57, 239, 0.25)' : '0 2px 12px rgba(var(--neon-rgb), 0.25)',
              }}
            >
              <Sparkles size={13} />
              {isTheme ? 'Create Theme' : 'Create Component'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
