import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { Plus, Workflow, Trash2, FileCode } from 'lucide-react';
import WorkflowCanvas from './WorkflowCanvas';
import TemplateGallery from './TemplateGallery';
import { useWorkflow } from './useWorkflow';
import { toast } from 'sonner';
import type { WorkflowHeaderControls } from './types';
export type { WorkflowHeaderControls };

function WorkflowListView() {
  const navigate = useNavigate();
  const { workflows, loading, fetchWorkflows, saveWorkflow, deleteWorkflow } = useWorkflow();
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleNew = async () => {
    const result = await saveWorkflow(undefined, { name: 'Untitled Workflow', nodes: [], edges: [] });
    if (result?.id) navigate(`/agent-builder/${result.id}`);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteWorkflow(id);
  };

  const handleTemplateSelect = async (template: any) => {
    setShowTemplates(false);
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
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Workflow size={18} style={{ color: 'var(--neon-color)' }} />
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-100)' }}>Agent Builder</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)', border: '1px solid var(--border-300)' }}
          >
            <FileCode size={14} />
            Templates
          </button>
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
          >
            <Plus size={14} />
            New Workflow
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
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
                  <button
                    onClick={(e) => handleDelete(wf.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--bg-300)] transition-opacity cursor-pointer"
                    style={{ color: 'var(--text-500)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showTemplates && (
        <TemplateGallery
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplates(false)}
        />
      )}
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
        onLoadTemplate={() => navigate('/agent-builder')}
        onBack={() => navigate('/agent-builder')}
        onHeaderControls={onHeaderControls}
      />
    </div>
  );
}

export default function AgentBuilderMode({ onHeaderControls }: { onHeaderControls?: (controls: WorkflowHeaderControls | null) => void }) {
  return (
    <Routes>
      <Route index element={<WorkflowListView />} />
      <Route path=":workflowId" element={<WorkflowCanvasView onHeaderControls={onHeaderControls} />} />
    </Routes>
  );
}
