import { useState, useCallback, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AgentBuilderTool } from './types';

interface ToolDetailPanelProps {
  tool: AgentBuilderTool;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<AgentBuilderTool>) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
  isClosing?: boolean;
}

export function ToolDetailPanel({ tool, onClose, onUpdate, onDelete, isClosing = false }: ToolDetailPanelProps) {
  const [name, setName] = useState(tool.name);
  const [description, setDescription] = useState(tool.description);
  const [schemaText, setSchemaText] = useState(JSON.stringify(tool.parameters_schema, null, 2));
  const [color, setColor] = useState(tool.color);
  const [saving, setSaving] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    setName(tool.name);
    setDescription(tool.description);
    setSchemaText(JSON.stringify(tool.parameters_schema, null, 2));
    setColor(tool.color);
    setSchemaError(null);
  }, [tool]);

  const handleSave = useCallback(async () => {
    let schema: Record<string, any>;
    try {
      schema = JSON.parse(schemaText);
      setSchemaError(null);
    } catch {
      setSchemaError('Invalid JSON');
      return;
    }
    setSaving(true);
    await onUpdate(tool.id, { name, description, parameters_schema: schema, color });
    setSaving(false);
  }, [tool.id, name, description, schemaText, color, onUpdate]);

  const handleDelete = useCallback(async () => {
    await onDelete(tool.id);
    onClose();
  }, [tool.id, onDelete, onClose]);

  return (
    <div className={`ab-detail-panel ${isClosing ? 'ab-detail-closing' : ''}`}>
      <header className="ab-detail-header">
        <h3 style={{ color }}>{tool.name}</h3>
        <button onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </header>

      <ScrollArea className="ab-detail-body">
        <section className="ab-detail-section">
          <label className="ab-detail-label">Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </section>

        <section className="ab-detail-section">
          <label className="ab-detail-label">Description</label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What does this tool do?"
            rows={3}
          />
        </section>

        <section className="ab-detail-section">
          <label className="ab-detail-label">Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
            <span className="text-xs" style={{ color: 'var(--text-500)' }}>{color}</span>
          </div>
        </section>

        <Separator className="my-3" style={{ backgroundColor: 'var(--border-300)' }} />

        <section className="ab-detail-section">
          <label className="ab-detail-label">Parameters Schema (JSON)</label>
          <Textarea
            value={schemaText}
            onChange={e => { setSchemaText(e.target.value); setSchemaError(null); }}
            rows={10}
            className="font-mono text-xs"
            placeholder='{"type":"object","properties":{"input":{"type":"string","description":"Input text"}},"required":["input"]}'
          />
          {schemaError && <p className="text-xs text-red-400 mt-1">{schemaError}</p>}
        </section>

        <Separator className="my-3" style={{ backgroundColor: 'var(--border-300)' }} />

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5"
            style={{ borderColor: 'var(--neon-color, #5ABDAC)', color: 'var(--neon-color, #5ABDAC)' }}
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="gap-1.5 text-red-400 hover:text-red-300"
          >
            <Trash2 size={14} />
            Delete
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
}
