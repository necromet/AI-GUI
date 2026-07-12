import React, { useRef, useState, useEffect } from 'react';
import { Upload, Trash2, Plus, Sparkles, File } from 'lucide-react';
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

  useEffect(() => {
    if (!open) {
      requestAnimationFrame(() => {
        document.body.style.pointerEvents = '';
      });
    }
  }, [open]);

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
                style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.1)' }}
              >
                <Plus size={16} style={{ color: 'var(--neon-color)' }} />
              </div>
              New Component
            </DialogTitle>
            <DialogDescription className="text-sm" style={{ color: 'var(--text-500)' }}>
              Create a reusable component for your library
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
                placeholder="e.g. Animated Card"
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
              placeholder="What does this component do?"
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
              placeholder="react, animation, ui (comma-separated)"
              className="h-9 text-sm rounded-lg"
              style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
            />
          </div>

          <Separator style={{ backgroundColor: 'var(--border-300)' }} />

          {/* Files section */}
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
                background: 'linear-gradient(135deg, var(--neon-color), rgba(var(--neon-rgb), 0.8))',
                color: '#000',
                boxShadow: '0 2px 12px rgba(var(--neon-rgb), 0.25)',
              }}
            >
              <Sparkles size={13} />
              Create Component
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
