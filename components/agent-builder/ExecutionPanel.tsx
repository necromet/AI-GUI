import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, CheckCircle2, XCircle, Clock, Loader2, ChevronUp, ChevronDown, Shield, RotateCcw } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import { parseSSEStream } from './shared/useSSEStream';
import { useExecutionStatus } from './ExecutionStatusContext';
import { STATUS_COLORS } from './shared/colors';

interface Props {
  nodes: Node[];
  edges: Edge[];
  workflowId?: string;
}

export default function ExecutionPanel({ nodes, edges, workflowId }: Props) {
  const { nodeStatuses, setNodeStatuses, isExecuting, setIsExecuting } = useExecutionStatus();
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [pendingApproval, setPendingApproval] = useState<any>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [entered, setEntered] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { requestAnimationFrame(() => setEntered(true)); }, []);

  const execute = useCallback(async () => {
    if (!workflowId || isExecuting) return;

    setIsExecuting(true);
    setError(null);
    setOutput(null);
    setNodeStatuses(new Map());
    setPendingApproval(null);
    setElapsed(0);

    const initialStatuses = new Map();
    for (const node of nodes) {
      initialStatuses.set(node.id, { nodeId: node.id, status: 'pending' });
    }
    setNodeStatuses(initialStatuses);
    setStartTime(Date.now());

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch(`/api/workflows/${workflowId}/execute-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      for await (const event of parseSSEStream(response)) {
        handleEvent(event);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setIsExecuting(false);
      setStartTime(null);
      abortRef.current = null;
    }
  }, [workflowId, nodes, input, isExecuting, setIsExecuting, setNodeStatuses]);

  const handleEvent = useCallback((event: any) => {
    if (event.type === 'node_running' || event.type === 'node_start') {
      setNodeStatuses(prev => {
        const next = new Map(prev);
        const existing = next.get(event.nodeId) || { nodeId: event.nodeId, status: 'pending' };
        next.set(event.nodeId, { ...existing, status: 'running', startedAt: new Date().toISOString() });
        return next;
      });
    } else if (event.type === 'node_completed' || event.type === 'completed') {
      setNodeStatuses(prev => {
        const next = new Map(prev);
        const nodeId = event.nodeId || event.data?.nodeId;
        if (nodeId) {
          const existing = next.get(nodeId) || { nodeId, status: 'pending' };
          next.set(nodeId, { ...existing, status: 'completed', output: event.data?.output || event.output, completedAt: new Date().toISOString() });
        }
        return next;
      });
      if (event.data?.output) setOutput(event.data.output);
    } else if (event.type === 'node_error' || event.type === 'error') {
      setNodeStatuses(prev => {
        const next = new Map(prev);
        const nodeId = event.nodeId || event.data?.nodeId;
        if (nodeId) {
          const existing = next.get(nodeId) || { nodeId, status: 'pending' };
          next.set(nodeId, { ...existing, status: 'failed', error: event.error || event.data?.error, completedAt: new Date().toISOString() });
        }
        return next;
      });
      if (event.error) setError(event.error);
    } else if (event.type === 'pending-auth' || event.type === 'pending_approval') {
      setPendingApproval(event.data || event.pendingAuth);
    } else if (event.type === 'state_update') {
      if (event.state?.nodeResults) {
        setNodeStatuses(prev => {
          const next = new Map(prev);
          for (const [nodeId, result] of Object.entries(event.state.nodeResults)) {
            next.set(nodeId, { nodeId, ...(result as any) });
          }
          return next;
        });
      }
    }
  }, [setNodeStatuses]);

  const handleApproval = useCallback(async (approved: boolean) => {
    if (!pendingApproval || !workflowId) return;
    try {
      await fetch(`/api/workflows/${workflowId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId: pendingApproval.executionId, approved }),
      });
      setPendingApproval(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, [pendingApproval, workflowId]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsExecuting(false);
    setStartTime(null);
  }, [setIsExecuting]);

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isExecuting || !startTime) return;
    const interval = setInterval(() => setElapsed(Date.now() - startTime), 100);
    return () => clearInterval(interval);
  }, [isExecuting, startTime]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Loader2 size={11} className="animate-spin" style={{ color: STATUS_COLORS.running }} />;
      case 'completed': return <CheckCircle2 size={11} style={{ color: STATUS_COLORS.completed }} />;
      case 'failed': return <XCircle size={11} style={{ color: STATUS_COLORS.failed }} />;
      default: return <Clock size={11} style={{ color: 'var(--text-500)' }} />;
    }
  };

  const completedCount = Array.from(nodeStatuses.values()).filter(s => s.status === 'completed').length;
  const failedCount = Array.from(nodeStatuses.values()).filter(s => s.status === 'failed').length;
  const runningCount = Array.from(nodeStatuses.values()).filter(s => s.status === 'running').length;
  const totalCount = nodes.length;
  const hasRun = nodeStatuses.size > 0;

  return (
    <div
      className="rounded-t-lg border border-b-0 shadow-xl transition-all"
      style={{
        borderColor: 'var(--border-300)',
        backgroundColor: 'var(--bg-100, #111114)',
        width: isExpanded ? 'min(560px, calc(100vw - 120px))' : 'min(340px, calc(100vw - 120px))',
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : 'translateY(4px)',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
        style={{ borderBottom: isExpanded ? '1px solid var(--border-300)' : 'none' }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExecuting ? (
            <Loader2 size={12} className="animate-spin" style={{ color: STATUS_COLORS.running }} />
          ) : failedCount > 0 ? (
            <XCircle size={12} style={{ color: STATUS_COLORS.failed }} />
          ) : completedCount > 0 ? (
            <CheckCircle2 size={12} style={{ color: STATUS_COLORS.completed }} />
          ) : (
            <Play size={12} style={{ color: 'var(--text-500)' }} />
          )}
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-100)' }}>
            {isExecuting ? 'Running' : failedCount > 0 ? 'Failed' : completedCount > 0 ? 'Done' : 'Execution'}
          </span>
          {isExecuting && runningCount > 0 && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/15 text-yellow-400">
              {runningCount} active
            </span>
          )}
          {!isExecuting && completedCount > 0 && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/15 text-green-400">
              {completedCount}/{totalCount}
            </span>
          )}
          {(isExecuting || elapsed > 0) && (
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-500)' }}>
              {isExecuting ? ((Date.now() - (startTime || Date.now())) / 1000).toFixed(1) : (elapsed / 1000).toFixed(1)}s
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {hasRun && !isExecuting && (
            <button
              onClick={(e) => { e.stopPropagation(); setNodeStatuses(new Map()); setElapsed(0); setError(null); setOutput(null); }}
              className="p-0.5 rounded cursor-pointer"
              style={{ color: 'var(--text-500)' }}
              title="Clear results"
            >
              <RotateCcw size={11} />
            </button>
          )}
          {isExpanded ? <ChevronDown size={11} style={{ color: 'var(--text-500)' }} /> : <ChevronUp size={11} style={{ color: 'var(--text-500)' }} />}
        </div>
      </div>

      {!isExpanded && hasRun && (
        <div className="px-3 pb-1.5">
          <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-300)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
                backgroundColor: failedCount > 0 ? STATUS_COLORS.failed : STATUS_COLORS.completed,
              }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 px-3 py-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Workflow input..."
          className="flex-1 px-2 py-1 text-[11px] rounded border bg-transparent"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
          onKeyDown={e => e.key === 'Enter' && execute()}
          disabled={isExecuting}
          onClick={e => e.stopPropagation()}
        />
        {isExecuting ? (
          <button onClick={(e) => { e.stopPropagation(); cancel(); }} className="px-2 py-1 rounded text-xs cursor-pointer" style={{ backgroundColor: STATUS_COLORS.failed + '20', color: STATUS_COLORS.failed }}>
            <Square size={11} />
          </button>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); execute(); }} disabled={!workflowId} className="px-2 py-1 rounded text-xs cursor-pointer disabled:opacity-40" style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}>
            <Play size={11} />
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="overflow-hidden transition-all duration-200" style={{ maxHeight: isExpanded ? '400px' : '0px', opacity: isExpanded ? 1 : 0 }}>
        <>          {pendingApproval && (
            <div className="mx-3 mb-2 p-2 rounded border" style={{ borderColor: STATUS_COLORS.running, backgroundColor: STATUS_COLORS.running + '10' }}>
              <div className="flex items-center gap-2 mb-1.5">
                <Shield size={11} style={{ color: STATUS_COLORS.running }} />
                <span className="text-[11px] font-medium" style={{ color: STATUS_COLORS.running }}>Approval Required</span>
              </div>
              <p className="text-[10px] mb-2" style={{ color: 'var(--text-300)' }}>{pendingApproval.message}</p>
              <div className="flex gap-2">
                <button onClick={() => handleApproval(true)} className="px-2.5 py-1 rounded text-[11px] cursor-pointer" style={{ backgroundColor: STATUS_COLORS.completed + '20', color: STATUS_COLORS.completed }}>Approve</button>
                <button onClick={() => handleApproval(false)} className="px-2.5 py-1 rounded text-[11px] cursor-pointer" style={{ backgroundColor: STATUS_COLORS.failed + '20', color: STATUS_COLORS.failed }}>Reject</button>
              </div>
            </div>
          )}

          {hasRun && (
            <div className="px-3 pb-2 overflow-y-auto" style={{ maxHeight: '250px' }}>
              {Array.from(nodeStatuses.values()).map(status => (
                <div key={status.nodeId} className="mb-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleNode(status.nodeId); }}
                    className="flex items-center gap-2 w-full text-left py-1 px-1 rounded cursor-pointer transition-colors"
                    style={{ backgroundColor: expandedNodes.has(status.nodeId) ? 'var(--bg-200)' : 'transparent' }}
                  >
                    {statusIcon(status.status)}
                    <span className="text-[10px] font-mono flex-1" style={{ color: 'var(--text-300)' }}>
                      {nodes.find(n => n.id === status.nodeId)?.data?.label || status.nodeId}
                    </span>
                    {status.status === 'completed' && status.output && (
                      <span className="text-[9px] truncate max-w-[120px]" style={{ color: 'var(--text-500)' }}>
                        {typeof status.output === 'string' ? status.output.slice(0, 40) : JSON.stringify(status.output).slice(0, 40)}
                      </span>
                    )}
                  </button>
                  {expandedNodes.has(status.nodeId) && status.output && (
                    <div className="ml-5 mt-1 mb-1 relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(typeof status.output === 'string' ? status.output : JSON.stringify(status.output, null, 2)); }}
                        className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[8px] cursor-pointer z-10"
                        style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}
                      >
                        Copy
                      </button>
                      <div className="p-2 rounded text-[10px] font-mono overflow-x-auto max-h-[120px] overflow-y-auto" style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)' }}>
                        <pre className="whitespace-pre-wrap">{typeof status.output === 'string' ? status.output : JSON.stringify(status.output, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                  {expandedNodes.has(status.nodeId) && status.error && (
                    <div className="ml-5 mt-1 mb-1 p-2 rounded text-[10px] font-mono" style={{ backgroundColor: STATUS_COLORS.failed + '10', color: STATUS_COLORS.failed }}>
                      {status.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mx-3 mb-2 p-2 rounded text-[10px]" style={{ backgroundColor: STATUS_COLORS.failed + '10', color: STATUS_COLORS.failed }}>
              {error}
            </div>
          )}

          {output && !isExecuting && (
            <div className="mx-3 mb-2">
              <div className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-500)' }}>Final Output</div>
              <div className="p-2 rounded text-[10px] font-mono max-h-[100px] overflow-auto" style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)' }}>
                <pre className="whitespace-pre-wrap">{typeof output === 'string' ? output : JSON.stringify(output, null, 2)}</pre>
              </div>
            </div>
          )}
        </>
        </div>
      )}
    </div>
  );
}
