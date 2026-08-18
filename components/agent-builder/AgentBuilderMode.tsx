import { useState, useEffect } from 'react';
import { Plus, Workflow, Trash2 } from 'lucide-react';
import WorkflowCanvas from './WorkflowCanvas';
import { useWorkflow } from './useWorkflow';

export default function AgentBuilderMode() {
  const { workflows, loading, fetchWorkflows, saveWorkflow, deleteWorkflow } = useWorkflow();
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | undefined>();

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleNew = async () => {
    const result = await saveWorkflow(undefined, { name: 'Untitled Workflow', nodes: [], edges: [] });
    if (result?.id) setActiveWorkflowId(result.id);
  };

  const handleDelete = async (id: string) => {
    await deleteWorkflow(id);
    if (activeWorkflowId === id) setActiveWorkflowId(undefined);
  };

  return (
    <div className="h-full flex flex-col">
      {!activeWorkflowId ? (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2">
              <Workflow size={18} style={{ color: 'var(--neon-color)' }} />
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-100)' }}>Agent Builder</h2>
            </div>
            <button
              onClick={handleNew}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
            >
              <Plus size={14} />
              New Workflow
            </button>
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
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.3)';
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(var(--neon-rgb), 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-300)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div className="flex items-start justify-between" onClick={() => setActiveWorkflowId(wf.id)}>
                      <div>
                        <h3 className="text-sm font-medium" style={{ color: 'var(--text-100)' }}>{wf.name}</h3>
                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-500)' }}>
                          {wf.nodes?.length || 0} nodes · {wf.edges?.length || 0} edges
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(wf.id); }}
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
        </div>
      ) : (
        <div className="h-full relative">
          <button
            onClick={() => setActiveWorkflowId(undefined)}
            className="absolute top-2 left-2 z-10 px-2 py-1 rounded text-xs font-medium cursor-pointer"
            style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)', border: '1px solid var(--border-300)' }}
          >
            ← Back to workflows
          </button>
          <WorkflowCanvas
            workflowId={activeWorkflowId}
            onWorkflowSaved={(id) => setActiveWorkflowId(id)}
          />
        </div>
      )}
    </div>
  );
}
