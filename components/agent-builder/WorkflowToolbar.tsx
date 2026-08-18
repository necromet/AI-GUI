import { useState, useCallback } from 'react';
import { Save, Download, Upload, Play } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import { useWorkflow } from './useWorkflow';
import { toast } from 'sonner';

interface Props {
  name: string;
  onNameChange: (name: string) => void;
  nodes: Node[];
  edges: Edge[];
  workflowId?: string;
  onWorkflowSaved?: (id: string) => void;
}

export default function WorkflowToolbar({ name, onNameChange, nodes, edges, workflowId, onWorkflowSaved }: Props) {
  const { saveWorkflow } = useWorkflow();
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const workflowNodes = nodes.map(n => ({
        id: n.id,
        type: (n.data as any)?.nodeType || 'agent',
        position: n.position,
        data: n.data,
        label: (n.data as any)?.label,
      }));
      const workflowEdges = edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || undefined,
        label: e.label as string | undefined,
        animated: e.animated,
      }));

      const result = await saveWorkflow(workflowId, { name, nodes: workflowNodes, edges: workflowEdges });
      if (result?.id) onWorkflowSaved?.(result.id);
      toast.success('Workflow saved');
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [name, nodes, edges, workflowId, saveWorkflow, onWorkflowSaved]);

  const handleExport = useCallback(() => {
    const data = { name, nodes, edges };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [name, nodes, edges]);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b" style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-100)' }}>
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className="text-sm font-semibold bg-transparent border-none outline-none flex-1 min-w-0"
        style={{ color: 'var(--text-100)' }}
        placeholder="Workflow name"
      />

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
        style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
      >
        <Save size={12} />
        {saving ? 'Saving...' : 'Save'}
      </button>

      <button
        onClick={handleExport}
        className="p-1.5 rounded hover:bg-[var(--bg-200)] cursor-pointer"
        style={{ color: 'var(--text-400)' }}
        title="Export JSON"
      >
        <Download size={14} />
      </button>
    </div>
  );
}
