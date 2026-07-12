import React, { useState, useEffect } from 'react';
import { Pencil, Folder } from 'lucide-react';
import { LibraryComponent, LibraryFolder } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CATEGORIES } from './constants';

interface EditComponentDialogProps {
  open: boolean;
  component: LibraryComponent | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (component: LibraryComponent) => void;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  folders?: LibraryFolder[];
}

export const EditComponentDialog: React.FC<EditComponentDialogProps> = ({
  open,
  component,
  onOpenChange,
  onSaved,
  onNotification,
  folders = [],
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<LibraryComponent['category']>('ui-widget');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (component && open) {
      setName(component.name);
      setCategory(component.category);
      setDescription(component.description);
      setTags(component.tags.join(', '));
      setFolderId(component.folderId || null);
    }
  }, [component, open]);

  useEffect(() => {
    if (!open) {
      requestAnimationFrame(() => {
        document.body.style.pointerEvents = '';
      });
    }
  }, [open]);

  const handleSave = async () => {
    if (!component || !name.trim()) return;
    try {
      const response = await fetch(`/api/library/components/${component.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          description: description.trim(),
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          folderId,
        }),
      });
      if (!response.ok) throw new Error('Failed to update component');
      const data = await response.json();
      onSaved(data.component);
      onOpenChange(false);
      onNotification?.('Component updated', 'success');
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg p-0 gap-0 overflow-hidden"
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
                <Pencil size={16} style={{ color: 'var(--neon-color)' }} />
              </div>
              Edit Component
            </DialogTitle>
            <DialogDescription className="text-sm" style={{ color: 'var(--text-500)' }}>
              Update component details and metadata
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Name + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>
                Name <span style={{ color: 'var(--neon-color)' }}>*</span>
              </Label>
              <Input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Component name"
                className="h-9 text-sm rounded-lg"
                style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Category</Label>
              <Select
                value={category}
                onValueChange={value => setCategory(value as any)}
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

          {/* Folder */}
          {folders.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Folder</Label>
              <Select
                value={folderId || '__none__'}
                onValueChange={value => setFolderId(value === '__none__' ? null : value)}
              >
                <SelectTrigger className="h-9 text-sm rounded-lg" style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}>
                  <SelectValue placeholder="No folder" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
                  <SelectItem value="__none__" className="text-sm" style={{ color: 'var(--text-100)' }}>
                    <span className="flex items-center gap-2">
                      <Folder size={12} style={{ color: 'var(--text-500)' }} />
                      No folder
                    </span>
                  </SelectItem>
                  {folders.map(f => (
                    <SelectItem key={f.id} value={f.id} className="text-sm" style={{ color: 'var(--text-100)' }}>
                      <span className="flex items-center gap-2">
                        <Folder size={12} style={{ color: f.color }} />
                        {f.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
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
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="react, animation, ui (comma-separated)"
              className="h-9 text-sm rounded-lg"
              style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
            />
          </div>

          <Separator style={{ backgroundColor: 'var(--border-300)' }} />

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 rounded-lg text-sm"
              style={{ color: 'var(--text-500)' }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim()}
              className="h-9 px-5 rounded-lg text-sm font-semibold"
              style={{
                background: 'linear-gradient(135deg, var(--neon-color), rgba(var(--neon-rgb), 0.8))',
                color: '#000',
                boxShadow: '0 2px 12px rgba(var(--neon-rgb), 0.25)',
              }}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
