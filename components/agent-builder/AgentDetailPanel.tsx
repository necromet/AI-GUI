import { useState, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { X, Save, Trash2, Link, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_MODELS } from '../../constants';
import type { AgentBuilderAgent, AgentBuilderTool } from './types';

const chatModels = DEFAULT_MODELS.filter(m => m.modelType === 'chat');

interface AgentDetailPanelProps {
  agent: AgentBuilderAgent;
  allTools: AgentBuilderTool[];
  onClose: () => void;
  onUpdate: (id: string, data: Partial<AgentBuilderAgent>) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
  onAttachTool: (agentId: string, toolId: string) => Promise<void>;
  onDetachTool: (agentId: string, toolId: string) => Promise<void>;
  isClosing?: boolean;
}

export function AgentDetailPanel({
  agent,
  allTools,
  onClose,
  onUpdate,
  onDelete,
  onAttachTool,
  onDetachTool,
  isClosing = false,
}: AgentDetailPanelProps) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || '');
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt);
  const [model, setModel] = useState(agent.model);
  const [color, setColor] = useState(agent.color);
  const [saving, setSaving] = useState(false);

  const selectedModelConfig = chatModels.find(m => m.id === model);
  const provider = selectedModelConfig?.provider || agent.provider || 'mimo';

  useEffect(() => {
    setName(agent.name);
    setDescription(agent.description || '');
    setSystemPrompt(agent.system_prompt);
    setModel(agent.model);
    setColor(agent.color);
  }, [agent]);

  const attachedToolIds = new Set((agent.tools || []).map(t => t.id));
  const availableTools = allTools.filter(t => !attachedToolIds.has(t.id));

  const handleSave = useCallback(async () => {
    setSaving(true);
    await onUpdate(agent.id, { name, description, system_prompt: systemPrompt, model, color, provider });
    setSaving(false);
  }, [agent.id, name, description, systemPrompt, model, color, provider, onUpdate]);

  const handleDelete = useCallback(async () => {
    await onDelete(agent.id);
    onClose();
  }, [agent.id, onDelete, onClose]);

  return (
    <div className={`ab-detail-panel ${isClosing ? 'ab-detail-closing' : ''}`}>
      <header className="ab-detail-header">
        <h3 style={{ color }}>{agent.name}</h3>
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
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this agent do?" />
        </section>

        <section className="ab-detail-section">
          <label className="ab-detail-label">Model</label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {chatModels.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name} ({m.provider})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[10px] mt-1 block" style={{ color: 'var(--text-500)' }}>
            Provider: {provider}
          </span>
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
          <label className="ab-detail-label">System Prompt</label>
          <div className="ab-editor-wrapper">
            <Editor
              height="200px"
              defaultLanguage="markdown"
              value={systemPrompt}
              onChange={(val) => setSystemPrompt(val || '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineHeight: 1.5,
                padding: { top: 8, bottom: 8 },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
              }}
            />
          </div>
        </section>

        <Separator className="my-3" style={{ backgroundColor: 'var(--border-300)' }} />

        <section className="ab-detail-section">
          <label className="ab-detail-label">
            Attached Tools ({(agent.tools || []).length})
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(agent.tools || []).map(t => (
              <Badge key={t.id} variant="outline" className="gap-1 text-[10px]" style={{ borderColor: t.color, color: t.color }}>
                {t.name}
                <button onClick={() => onDetachTool(agent.id, t.id)} className="ml-1 hover:opacity-70">
                  <Unlink size={10} />
                </button>
              </Badge>
            ))}
            {(agent.tools || []).length === 0 && (
              <span className="text-xs" style={{ color: 'var(--text-500)' }}>No tools attached</span>
            )}
          </div>

          {availableTools.length > 0 && (
            <>
              <label className="ab-detail-label text-[10px] mt-2">Available Tools</label>
              <div className="flex flex-wrap gap-1.5">
                {availableTools.map(t => (
                  <Button
                    key={t.id}
                    variant="outline"
                    size="sm"
                    className="h-6 gap-1 px-2 text-[10px]"
                    style={{ borderColor: 'var(--border-300)', color: 'var(--text-300)' }}
                    onClick={() => onAttachTool(agent.id, t.id)}
                  >
                    <Link size={10} />
                    {t.name}
                  </Button>
                ))}
              </div>
            </>
          )}
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
