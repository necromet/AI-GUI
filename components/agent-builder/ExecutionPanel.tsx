import { useState } from 'react';
import { Play, Square, ChevronUp, ChevronDown } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import { useWorkflowExecution } from './useWorkflowExecution';

interface Props {
  nodes: Node[];
  edges: Edge[];
  workflowId?: string;
}

export default function ExecutionPanel({ nodes, edges, workflowId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { isRunning, events, nodeStatuses, execute, cancel } = useWorkflowExecution();

  const handleRun = () => {
    if (!workflowId) return;
    execute(workflowId, nodes, edges);
  };

  const statusColor = (status: string) => {
    if (status === 'running') return '#e4a853';
    if (status === 'completed') return '#34d399';
    if (status === 'failed') return '#f87171';
    return 'var(--text-500)';
  };

  return (
    <div
      className="rounded-t-lg border border-b-0 overflow-hidden"
      style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)', minWidth: 360 }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={handleRun}
          disabled={isRunning || !workflowId}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: isRunning ? 'var(--bg-300)' : 'var(--neon-color)', color: isRunning ? 'var(--text-300)' : '#000' }}
        >
          {isRunning ? <Square size={12} /> : <Play size={12} />}
          {isRunning ? 'Running...' : 'Run'}
        </button>

        {!workflowId && (
          <span className="text-[10px]" style={{ color: 'var(--text-500)' }}>Save workflow first</span>
        )}

        <div className="ml-auto flex items-center gap-1">
          {Object.entries(nodeStatuses).map(([nodeId, status]) => (
            <div
              key={nodeId}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusColor(status) }}
              title={`${nodeId}: ${status}`}
            />
          ))}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 rounded hover:bg-[var(--bg-300)] cursor-pointer"
            style={{ color: 'var(--text-500)' }}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t px-3 py-2 max-h-48 overflow-y-auto" style={{ borderColor: 'var(--border-300)' }}>
          {events.length === 0 ? (
            <p className="text-[10px]" style={{ color: 'var(--text-500)' }}>No execution events yet.</p>
          ) : (
            <div className="space-y-1">
              {events.map((evt, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px] font-mono" style={{ color: 'var(--text-400)' }}>
                  <span className="flex-shrink-0" style={{ color: statusColor(evt.type?.replace('node_', '') || '') }}>
                    {evt.type}
                  </span>
                  {evt.nodeId && <span style={{ color: 'var(--text-500)' }}>{evt.nodeId}</span>}
                  {evt.error && <span style={{ color: '#f87171' }}>{evt.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
