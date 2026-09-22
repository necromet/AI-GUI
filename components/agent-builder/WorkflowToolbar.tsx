import { useState, useCallback, useEffect, useRef } from 'react';
import { Save, Download, Code, Undo2, Redo2, Maximize2, FileCode, BookmarkPlus, Network, Share2, Globe, AlertTriangle, CheckCircle2, LayoutDashboard, Eye, Upload, Settings } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import { useWorkflow } from './useWorkflow';
import { toast } from 'sonner';
import { ShortcutButton } from './ShortcutOverlay';
import type { ValidationIssue } from './validateWorkflow';
import { SEMANTIC_COLORS } from './shared/colors';
import SaveAsTemplateModal from './SaveAsTemplateModal';
import PublishModal from './PublishModal';
import type { WorkflowHeaderControls } from './types';
import WorkflowPreviewModal from './WorkflowPreviewModal';
import AgentBuilderSettingsModal from './AgentBuilderSettingsModal';

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
  onAutoLayout: () => void;
  onFocusIssue: (nodeId?: string) => void;
  validationIssues: ValidationIssue[];
  onShowShortcuts: () => void;
  onBack?: () => void;
  onHeaderControls?: (controls: WorkflowHeaderControls | null) => void;
}

export default function WorkflowToolbar({
  name, onNameChange, nodes, edges, workflowId, onWorkflowSaved, onLoadTemplate,
  canUndo, canRedo, onUndo, onRedo, onFitView, onAutoLayout, onFocusIssue, validationIssues, onShowShortcuts, onBack, onHeaderControls,
}: Props) {
  const { saveWorkflow } = useWorkflow();
  const [saving, setSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

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
      if (!result) throw new Error('The server did not save the workflow');
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
      const res = await fetch('/api/workflows/' + workflowId + '/export-code', { method: 'POST' });
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

  const handleExportMermaid = useCallback(async () => {
    if (!workflowId) return;
    try {
      const res = await fetch('/api/workflows/' + workflowId + '/export-mermaid', { method: 'POST' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      await navigator.clipboard.writeText(data.mermaid);
      toast.success('Mermaid diagram copied to clipboard');
    } catch (err: any) {
      toast.error('Export failed: ' + err.message);
    }
  }, [workflowId]);

  const handleShare = useCallback(() => {
    const data = { name, nodes, edges };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name.replace(/\s+/g, '-').toLowerCase() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Workflow file downloaded');
  }, [name, nodes, edges]);

  const handleImport = useCallback(() => importRef.current?.click(), []);
  const handlePreview = useCallback(() => setShowPreview(true), []);
  const handleSettings = useCallback(() => setShowSettings(true), []);

  const importWorkflow = useCallback(async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) throw new Error('Workflow JSON must contain nodes and edges arrays');
      const response = await fetch('/api/workflows/import-langgraph', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: parsed.name || file.name.replace(/\.json$/i, ''), description: parsed.description, nodes: parsed.nodes, edges: parsed.edges }),
      });
      const imported = await response.json();
      if (!response.ok) throw new Error(imported.error || 'Import failed');
      toast.success('Workflow imported');
      window.location.assign(`/agent-builder/${imported.id}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  }, []);

  // Ref always holds the latest values — callbacks read from here, never from stale closures
  const controlsRef = useRef({
    name, onNameChange, nodes, edges, workflowId,
    canUndo, canRedo, onUndo, onRedo, onFitView, onAutoLayout, onFocusIssue, validationIssues, onShowShortcuts, onBack,
    handleSave, saving, handleExport, handleExportCode, handleExportMermaid, handleShare, handleImport, handlePreview, handleSettings, onLoadTemplate,
    showValidation, setShowValidation, showSaveAsTemplate, setShowSaveAsTemplate, showPublish, setShowPublish,
  });
  controlsRef.current = {
    name, onNameChange, nodes, edges, workflowId,
    canUndo, canRedo, onUndo, onRedo, onFitView, onAutoLayout, onFocusIssue, validationIssues, onShowShortcuts, onBack,
    handleSave, saving, handleExport, handleExportCode, handleExportMermaid, handleShare, handleImport, handlePreview, handleSettings, onLoadTemplate,
    showValidation, setShowValidation, showSaveAsTemplate, setShowSaveAsTemplate, showPublish, setShowPublish,
  };

  const onHeaderControlsRef = useRef(onHeaderControls);
  onHeaderControlsRef.current = onHeaderControls;

  useEffect(() => () => onHeaderControlsRef.current?.(null), []);

  // Push controls to the parent header when data changes.
  // Uses JSON.stringify for nodes/edges/prevNodes/prevEdges to avoid false positives from
  // unstable object references (e.g. React Flow returning new arrays each render).
  const prevSerializedRef = useRef<string>('');
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      // Push once on mount so the parent gets initial controls
      onHeaderControlsRef.current?.(controlsRef.current);
      return;
    }

    const serialized = JSON.stringify({ name, workflowId, canUndo, canRedo, saving, showValidation, showSaveAsTemplate, showPublish })
      + '|' + nodes.length + ':' + nodes.map(n => n.id + (n.data as any)?.label).join(',')
      + '|' + edges.length + ':' + edges.map(e => e.id + e.source + e.target + (e.label || '')).join(',');

    if (serialized === prevSerializedRef.current) return;
    prevSerializedRef.current = serialized;
    onHeaderControlsRef.current?.(controlsRef.current);
  });

  const errors = validationIssues.filter(i => i.severity === 'error');
  const warnings = validationIssues.filter(i => i.severity === 'warning');

  const btnBase = "p-1.5 rounded-md transition-colors cursor-pointer";

  if (onHeaderControls) {
    return (
      <>
        <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={event => void importWorkflow(event.target.files?.[0])} />
        {showSaveAsTemplate && (
          <SaveAsTemplateModal
            workflowId={workflowId}
            name={name}
            nodes={nodes}
            edges={edges}
            onClose={() => setShowSaveAsTemplate(false)}
          />
        )}
        {showPublish && workflowId && (
          <PublishModal
            workflowId={workflowId}
            workflowName={name}
            onClose={() => setShowPublish(false)}
          />
        )}
        {showPreview && <WorkflowPreviewModal name={name} nodes={nodes} edges={edges} onClose={() => setShowPreview(false)} />}
        {showSettings && <AgentBuilderSettingsModal onClose={() => setShowSettings(false)} />}
      </>
    );
  }

  return (
    <div className="contents">
    <div className="flex items-center gap-1.5 px-3 py-2 border-b" style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-100)' }}>
      {onBack && (
        <button
          onClick={onBack}
          className="px-2.5 py-1.5 rounded-md text-sm font-medium cursor-pointer"
          style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)', border: '1px solid var(--border-300)' }}
        >
          ← Back
        </button>
      )}
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className="text-sm font-semibold bg-transparent border-none outline-none min-w-0 w-[180px] max-w-[220px]"
        style={{ color: 'var(--text-100)' }}
        placeholder="Workflow name"
      />

      <div className="w-px h-5 mx-1.5 flex-shrink-0" style={{ backgroundColor: 'var(--border-300)' }} />

      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onUndo} disabled={!canUndo} className={btnBase} style={{ color: canUndo ? 'var(--text-300)' : 'var(--text-500)', opacity: canUndo ? 1 : 0.4 }} title="Undo (Ctrl+Z)">
          <Undo2 size={15} />
        </button>
        <button onClick={onRedo} disabled={!canRedo} className={btnBase} style={{ color: canRedo ? 'var(--text-300)' : 'var(--text-500)', opacity: canRedo ? 1 : 0.4 }} title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={15} />
        </button>
        <button onClick={onFitView} className={btnBase} style={{ color: 'var(--text-300)' }} title="Fit View (F)">
          <Maximize2 size={15} />
        </button>
        <button onClick={onAutoLayout} className={btnBase} style={{ color: 'var(--text-300)' }} title="Auto layout">
          <LayoutDashboard size={15} />
        </button>
        <ShortcutButton onClick={onShowShortcuts} />
      </div>

      <div className="w-px h-5 mx-1.5 flex-shrink-0" style={{ backgroundColor: 'var(--border-300)' }} />

      {validationIssues.length > 0 && (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowValidation(!showValidation)}
            className="flex items-center gap-1.5 px-1.5 py-1 rounded-md cursor-pointer"
            style={{ color: errors.length > 0 ? SEMANTIC_COLORS.danger : SEMANTIC_COLORS.warning }}
            title="Validation issues"
          >
            <AlertTriangle size={15} />
            <span className="text-[11px] font-medium">{validationIssues.length}</span>
          </button>
          {showValidation && (
            <div
              className="absolute top-full left-0 mt-1 w-[280px] rounded-lg border shadow-xl z-40 overflow-hidden transition-all duration-150"
              style={{
                borderColor: 'var(--border-300)',
                backgroundColor: 'var(--bg-100, #1a1a1a)',
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
                  <button key={i} onClick={() => { onFocusIssue(issue.nodeId); setShowValidation(false); }} className="flex items-start gap-2 px-3 py-1.5 w-full text-left cursor-pointer" style={{ borderBottom: '1px solid var(--border-300)' }}>
                    <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" style={{ color: issue.severity === 'error' ? SEMANTIC_COLORS.danger : SEMANTIC_COLORS.warning }} />
                    <span className="text-[10px]" style={{ color: 'var(--text-300)' }}>{issue.message}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {validationIssues.length === 0 && nodes.length > 0 && (
        <CheckCircle2 size={15} className="flex-shrink-0" style={{ color: SEMANTIC_COLORS.success }} />
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-1 flex-shrink-0">
        <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={event => void importWorkflow(event.target.files?.[0])} />
        {onLoadTemplate && (
          <button onClick={onLoadTemplate} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer" style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)' }} title="Templates">
            <FileCode size={14} />
            Templates
          </button>
        )}
        {workflowId && nodes.length > 0 && (
          <button onClick={() => setShowSaveAsTemplate(true)} className={btnBase} style={{ color: 'var(--text-400)' }} title="Save as Template">
            <BookmarkPlus size={15} />
          </button>
        )}
        <button onClick={handleExport} className={btnBase} style={{ color: 'var(--text-400)' }} title="Export JSON">
          <Download size={15} />
        </button>
        <button onClick={handleImport} className={btnBase} style={{ color: 'var(--text-400)' }} title="Import workflow"><Upload size={15} /></button>
        <button onClick={handlePreview} className={btnBase} style={{ color: 'var(--text-400)' }} title="Preview workflow"><Eye size={15} /></button>
        <button onClick={handleSettings} className={btnBase} style={{ color: 'var(--text-400)' }} title="Agent Builder settings"><Settings size={15} /></button>
        {workflowId && (
          <button onClick={handleExportCode} className={btnBase} style={{ color: 'var(--text-400)' }} title="Export as Code">
            <Code size={15} />
          </button>
        )}
        {workflowId && (
          <button onClick={handleExportMermaid} className={btnBase} style={{ color: 'var(--text-400)' }} title="Export Mermaid Diagram">
            <Network size={15} />
          </button>
        )}
        {workflowId && (
          <button onClick={() => setShowPublish(true)} className={btnBase} style={{ color: 'var(--text-400)' }} title="Publish as API">
            <Globe size={15} />
          </button>
        )}
        <button onClick={handleShare} className={btnBase} style={{ color: 'var(--text-400)' }} title="Download Workflow">
          <Share2 size={15} />
        </button>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-50" style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}>
          <Save size={14} />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
    {showSaveAsTemplate && (
      <SaveAsTemplateModal
        workflowId={workflowId}
        name={name}
        nodes={nodes}
        edges={edges}
        onClose={() => setShowSaveAsTemplate(false)}
      />
    )}
    {showPublish && workflowId && (
      <PublishModal
        workflowId={workflowId}
        workflowName={name}
        onClose={() => setShowPublish(false)}
      />
    )}
    {showPreview && <WorkflowPreviewModal name={name} nodes={nodes} edges={edges} onClose={() => setShowPreview(false)} />}
    {showSettings && <AgentBuilderSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
