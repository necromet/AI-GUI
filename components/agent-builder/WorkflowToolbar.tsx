import { useState, useCallback } from 'react';
import { Save, Download, Code, Undo2, Redo2, Maximize2, FileCode, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import { useWorkflow } from './useWorkflow';
import { toast } from 'sonner';
import { ShortcutButton } from './ShortcutOverlay';
import type { ValidationIssue } from './validateWorkflow';
import { SEMANTIC_COLORS } from './shared/colors';

interface Props {
  name: string;
  onNameChange: (name: string) => void;
  nodes: Node[];
  edges: Edge[];
  workflowId?: string;
  onWorkflowSaved?: (id: string) => void;
  onLoadTemplate?: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  validationIssues: ValidationIssue[];
  onShowShortcuts: () => void;
}

export default function WorkflowToolbar({
  name, onNameChange, nodes, edges, workflowId, onWorkflowSaved, onLoadTemplate,
  canUndo, canRedo, onUndo, onRedo, onFitView, validationIssues, onShowShortcuts,
}: Props) {
  const { saveWorkflow } = useWorkflow();
  const [saving, setSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

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
      toast.error('Save failed: ' + err.message);
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
    a.download = name.replace(/\s+/g, '-').toLowerCase() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [name, nodes, edges]);

  const handleExportCode = useCallback(async () => {
    if (!workflowId) return;
    try {
      const res = await fetch('/api/workflows/' + workflowId + '/export-code');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const blob = new Blob([data.code || JSON.stringify(data, null, 2)], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name.replace(/\s+/g, '-').toLowerCase() + '.ts';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Code exported');
    } catch (err: any) {
      toast.error('Export failed: ' + err.message);
    }
  }, [workflowId, name]);

  const errors = validationIssues.filter(i => i.severity === 'error');
  const warnings = validationIssues.filter(i => i.severity === 'warning');

  const btnBase = "p-1.5 rounded transition-colors cursor-pointer";

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b overflow-hidden" style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-100)' }}>
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className="text-sm font-semibold bg-transparent border-none outline-none flex-1 min-w-[120px]"
        style={{ color: 'var(--text-100)' }}
        placeholder="Workflow name"
      />

      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button onClick={onUndo} disabled={!canUndo} className={btnBase} style={{ color: canUndo ? 'var(--text-300)' : 'var(--text-500)', opacity: canUndo ? 1 : 0.4 }} title="Undo (Ctrl+Z)">
          <Undo2 size={14} />
        </button>
        <button onClick={onRedo} disabled={!canRedo} className={btnBase} style={{ color: canRedo ? 'var(--text-300)' : 'var(--text-500)', opacity: canRedo ? 1 : 0.4 }} title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={14} />
        </button>
        <button onClick={onFitView} className={btnBase} style={{ color: 'var(--text-300)' }} title="Fit View (F)">
          <Maximize2 size={14} />
        </button>
        <ShortcutButton onClick={onShowShortcuts} />
        <div className="w-px h-4 mx-0.5" style={{ backgroundColor: 'var(--border-300)' }} />
      </div>

      {validationIssues.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowValidation(!showValidation)}
            className="flex items-center gap-1 px-1.5 py-1 rounded cursor-pointer"
            style={{ color: errors.length > 0 ? SEMANTIC_COLORS.danger : SEMANTIC_COLORS.warning }}
            title="Validation issues"
          >
            <AlertTriangle size={13} />
            <span className="text-[10px] font-medium">{validationIssues.length}</span>
          </button>
          {showValidation && (
            <div
              className="absolute top-full right-0 mt-1 w-[280px] rounded-lg border shadow-xl z-40 overflow-hidden transition-all duration-150"
              style={{
                borderColor: 'var(--border-300)',
                backgroundColor: 'var(--bg-100, #111114)',
                opacity: showValidation ? 1 : 0,
                transform: showValidation ? 'translateY(0)' : 'translateY(-4px)',
                pointerEvents: showValidation ? 'auto' : 'none',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 border-b text-[11px] font-medium" style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}>
                Validation ({errors.length} errors, {warnings.length} warnings)
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {validationIssues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid var(--border-300)' }}>
                    <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" style={{ color: issue.severity === 'error' ? SEMANTIC_COLORS.danger : SEMANTIC_COLORS.warning }} />
                    <span className="text-[10px]" style={{ color: 'var(--text-300)' }}>{issue.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {validationIssues.length === 0 && nodes.length > 0 && (
        <CheckCircle2 size={13} style={{ color: SEMANTIC_COLORS.success }} />
      )}

      <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer disabled:opacity-50" style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}>
        <Save size={12} />
        {saving ? 'Saving...' : 'Save'}
      </button>

      <button onClick={handleExport} className="p-1.5 rounded hover:bg-[var(--bg-200)] cursor-pointer" style={{ color: 'var(--text-400)' }} title="Export JSON">
        <Download size={14} />
      </button>

      {workflowId && (
        <button onClick={handleExportCode} className="p-1.5 rounded hover:bg-[var(--bg-200)] cursor-pointer" style={{ color: 'var(--text-400)' }} title="Export as Code">
          <Code size={14} />
        </button>
      )}

      {onLoadTemplate && (
        <button onClick={onLoadTemplate} className="flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer" style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)' }} title="Templates">
          <FileCode size={12} />
          Templates
        </button>
      )}
    </div>
  );
}
