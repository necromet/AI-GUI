import React, { useState, useEffect } from 'react';
import { Folder, Plus } from 'lucide-react';
import { LibraryFolder } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const FOLDER_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#64748b',
];

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (folder: LibraryFolder) => void;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
}

export const CreateFolderDialog: React.FC<CreateFolderDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
  onNotification,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(FOLDER_COLORS[0]);

  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setColor(FOLDER_COLORS[0]);
      requestAnimationFrame(() => {
        document.body.style.pointerEvents = '';
      });
    }
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const response = await fetch('/api/library/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), color }),
      });
      if (!response.ok) throw new Error('Failed to create folder');
      const data = await response.json();
      onCreated(data.folder);
      onOpenChange(false);
      onNotification?.('Folder created', 'success');
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md p-0 gap-0 overflow-hidden"
        style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)' }}
      >
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
                style={{ backgroundColor: `${color}1a` }}
              >
                <Folder size={16} style={{ color }} />
              </div>
              New Folder
            </DialogTitle>
            <DialogDescription className="text-sm" style={{ color: 'var(--text-500)' }}>
              Group related components together. Folders can be called by AI agents.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>
              Name <span style={{ color: 'var(--neon-color)' }}>*</span>
            </Label>
            <Input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Auth Components, Dashboard Widgets"
              className="h-9 text-sm rounded-lg"
              style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What components belong in this folder?"
              className="text-sm min-h-[56px] resize-y rounded-lg"
              style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Color</Label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-lg transition-all duration-150"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? '2px solid var(--text-100)' : 'none',
                    outlineOffset: '2px',
                    transform: color === c ? 'scale(1.1)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 rounded-lg text-sm"
              style={{ color: 'var(--text-500)' }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim()}
              className="h-9 px-5 rounded-lg text-sm font-semibold gap-1.5"
              style={{
                background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                color: '#fff',
                boxShadow: `0 2px 12px ${color}40`,
              }}
            >
              <Plus size={13} />
              Create Folder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
