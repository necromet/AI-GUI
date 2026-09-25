import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Workflow, Trash2, Copy } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import WorkflowCanvas from './WorkflowCanvas';
import TemplateGallery from './TemplateGallery';
import { useWorkflow } from './useWorkflow';
import { toast } from 'sonner';
import type { WorkflowHeaderControls } from './types';
import FlyingConfirmCard, { type ConfirmCardRequest } from './FlyingConfirmCard';
export type { WorkflowHeaderControls };

export interface WorkflowListHeaderControls {
  workflowCount: number;
  creating: boolean;
  onNewWorkflow: () => void;
  onTemplates: () => void;
}

function WorkflowListView({
  onHeaderControls,
  onEditorHeaderControls,
}: {
  onHeaderControls?: (controls: WorkflowListHeaderControls | null) => void;
  onEditorHeaderControls?: (controls: WorkflowHeaderControls | null) => void;
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { workflows, loading, error, fetchWorkflows, saveWorkflow, deleteWorkflow, duplicateWorkflow } = useWorkflow();
  const [showTemplates, setShowTemplates] = useState(searchParams.get('templates') === '1');
  const [creating, setCreating] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmCardRequest | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  useEffect(() => {
    if (searchParams.get('templates') === '1') setShowTemplates(true);
  }, [searchParams]);

  const closeTemplates = () => {
    setShowTemplates(false);
    if (searchParams.has('templates')) setSearchParams({}, { replace: true });
  };

  const handleNew = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    const startId = `start_${Date.now()}`;
    try {
      const result = await saveWorkflow(undefined, {
        name: 'Untitled Workflow',
        nodes: [{ id: startId, type: 'start', position: { x: 180, y: 220 }, data: { nodeType: 'start', label: 'Start', inputVariables: [] } }],
        edges: [],
      });
      if (result?.id) navigate(`/agent-builder/${result.id}`);
    } finally {
      setCreating(false);
    }
  }, [creating, saveWorkflow, navigate]);

  const openTemplates = useCallback(() => {
    setShowTemplates(true);
    setSearchParams({ templates: '1' }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    onEditorHeaderControls?.(null);
    onHeaderControls?.({ workflowCount: workflows.length, creating, onNewWorkflow: () => void handleNew(), onTemplates: openTemplates });
  }, [onHeaderControls, onEditorHeaderControls, workflows.length, creating, handleNew, openTemplates]);

  useEffect(() => () => onHeaderControls?.(null), [onHeaderControls]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const workflow = workflows.find(item => item.id === id);
    setConfirmRequest({
      title: 'Delete workflow?',
      description: `“${workflow?.name || 'This workflow'}” and its execution history will be permanently removed.`,
      confirmLabel: 'Delete workflow',
      anchor: { x: e.clientX, y: e.clientY },
      onConfirm: async () => {
        setConfirmBusy(true);
        await deleteWorkflow(id);
        setConfirmBusy(false);
        setConfirmRequest(null);
        toast.success('Workflow deleted');
      },
    });
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const copy = await duplicateWorkflow(id);
    if (copy?.id) toast.success('Workflow duplicated');
    else toast.error('Could not duplicate workflow');
  };

  const handleTemplateSelect = async (template: any) => {
    closeTemplates();
    try {
      const result = await saveWorkflow(undefined, {
        name: template.name,
        nodes: template.nodes,
        edges: template.edges,
      });
      if (result?.id) {
        navigate(`/agent-builder/${result.id}`);
        toast.success(`Created from template: ${template.name}`);
      }
    } catch (err: any) {
      toast.error(`Failed to create from template: ${err.message}`);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {error && <div className="mb-3 rounded-lg border px-3 py-2 text-xs text-red-400" style={{ borderColor: 'rgba(248,113,113,.35)', background: 'rgba(248,113,113,.14)' }}>{error}</div>}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-sm" style={{ color: 'var(--text-500)' }}>Loading workflows...</div>
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Workflow size={32} style={{ color: 'var(--text-500)' }} />
            <p className="text-sm" style={{ color: 'var(--text-500)' }}>No workflows yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="group p-4 rounded-xl border cursor-pointer transition-all"
                style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)' }}
                onClick={() => navigate(`/agent-builder/${wf.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.3)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(var(--neon-rgb), 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-300)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-medium" style={{ color: 'var(--text-100)' }}>{wf.name}</h3>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-500)' }}>
                      {wf.nodes?.length || 0} nodes · {wf.edges?.length || 0} edges
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity">
                    <button onClick={(e) => handleDuplicate(wf.id, e)} className="p-1 rounded hover:bg-[var(--bg-300)] cursor-pointer" style={{ color: 'var(--text-500)' }} title="Duplicate"><Copy size={14} /></button>
                    <button onClick={(e) => handleDelete(wf.id, e)} className="p-1 rounded hover:bg-[var(--bg-300)] cursor-pointer" style={{ color: 'var(--text-500)' }} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showTemplates && (
        <TemplateGallery
          onSelect={handleTemplateSelect}
          onClose={closeTemplates}
        />
      )}
      <AnimatePresence>
        {confirmRequest && <FlyingConfirmCard {...confirmRequest} busy={confirmBusy} onCancel={() => !confirmBusy && setConfirmRequest(null)} />}
      </AnimatePresence>
    </div>
  );
}

function WorkflowCanvasView({ onHeaderControls }: { onHeaderControls?: (controls: WorkflowHeaderControls | null) => void }) {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();

  return (
    <div className="h-full relative">
      <WorkflowCanvas
        workflowId={workflowId}
        onWorkflowSaved={() => {}}
        onLoadTemplate={() => navigate('/agent-builder?templates=1')}
        onBack={() => navigate('/agent-builder')}
        onHeaderControls={onHeaderControls}
      />
    </div>
  );
}

export default function AgentBuilderMode({
  onHeaderControls,
  onListHeaderControls,
}: {
  onHeaderControls?: (controls: WorkflowHeaderControls | null) => void;
  onListHeaderControls?: (controls: WorkflowListHeaderControls | null) => void;
}) {
  return (
    <Routes>
      <Route index element={<WorkflowListView onHeaderControls={onListHeaderControls} onEditorHeaderControls={onHeaderControls} />} />
      <Route path=":workflowId" element={<WorkflowCanvasView onHeaderControls={onHeaderControls} />} />
    </Routes>
  );
}
