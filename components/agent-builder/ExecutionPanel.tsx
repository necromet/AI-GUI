import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, RotateCcw, CheckCircle2, XCircle, Clock, Loader2, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import { parseSSEStream } from './shared/useSSEStream';

interface NodeStatus {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: any;
  error?: string;
  toolCalls?: Array<{ name: string; arguments: any; output?: any }>;
  startedAt?: string;
  completedAt?: string;
}

interface Props {
  nodes: Node[];
  edges: Edge[];
  workflowId?: string;
}

export default function ExecutionPanel({ nodes, edges, workflowId }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [nodeStatuses, setNodeStatuses] = useState<Map<string, NodeStatus>>(new Map());
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [pendingApproval, setPendingApproval] = useState<any>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    if (!workflowId || isRunning) return;

    setIsRunning(true);
    setError(null);
    setOutput(null);
    setNodeStatuses(new Map());
    setPendingApproval(null);

    // Initialize all nodes as pending
    const initialStatuses = new Map<string, NodeStatus>();
    for (const node of nodes) {
      initialStatuses.set(node.id, { nodeId: node.id, status: 'pending' });
    }
    setNodeStatuses(initialStatuses);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch(`/api/workflows/${workflowId}/execute-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      for await (const event of parseSSEStream(response)) {
        handleEvent(event);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [workflowId, nodes, input, isRunning]);

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
          next.set(nodeId, {
            ...existing,
            status: 'completed',
            output: event.data?.output || event.output,
            toolCalls: event.data?.toolCalls,
            completedAt: new Date().toISOString(),
          });
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
      // Update statuses from state
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
  }, []);

  const handleApproval = useCallback(async (approved: boolean) => {
    if (!pendingApproval || !workflowId) return;
    try {
      await fetch(`/api/workflows/${workflowId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionId: pendingApproval.executionId,
          approved,
        }),
      });
      setPendingApproval(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, [pendingApproval, workflowId]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (isRunning && !startTime) setStartTime(Date.now());
    if (!isRunning && startTime) { setStartTime(null); }
  }, [isRunning, startTime]);

  useEffect(() => {
    if (!isRunning || !startTime) return;
    const interval = setInterval(() => setElapsed(Date.now() - startTime), 100);
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Loader2 size={12} className="animate-spin" style={{ color: '#fbbf24' }} />;
      case 'completed': return <CheckCircle2 size={12} style={{ color: '#34d399' }} />;
      case 'failed': return <XCircle size={12} style={{ color: '#f87171' }} />;
      default: return <Clock size={12} style={{ color: 'var(--text-500)' }} />;
    }
  };

  const completedCount = Array.from(nodeStatuses.values()).filter(s => s.status === 'completed').length;
  const failedCount = Array.from(nodeStatuses.values()).filter(s => s.status === 'failed').length;
  const totalCount = nodes.length;

  return (
    <div
      className="rounded-lg border shadow-xl transition-all"
      style={{
        borderColor: 'var(--border-300)',
        backgroundColor: 'var(--bg-100, #111114)',
        width: isExpanded ? '500px' : '300px',
        maxHeight: isExpanded ? '500px' : '200px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border-300)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--text-100)' }}>
            Execution
          </span>
          {isRunning && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
              Running
            </span>
          )}
          {!isRunning && completedCount > 0 && failedCount === 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
              {completedCount}/{totalCount} done
            </span>
          )}
          {failedCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
              {failedCount} failed
            </span>
          )}
          {(isRunning || elapsed > 0) && (
            <span className="text-[10px] font-mono ml-1" style={{ color: 'var(--text-500)' }}>
              {isRunning ? ((Date.now() - (startTime || Date.now())) / 1000).toFixed(1) : (elapsed / 1000).toFixed(1)}s
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 cursor-pointer" style={{ color: 'var(--text-500)' }}>
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        </div>
      </div>

      {/* Input bar */}
      <div className="flex gap-2 px-3 py-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Workflow input..."
          className="flex-1 px-2 py-1 text-xs rounded border bg-transparent"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
          onKeyDown={e => e.key === 'Enter' && execute()}
          disabled={isRunning}
        />
        {isRunning ? (
          <button onClick={cancel} className="px-2 py-1 rounded text-xs cursor-pointer" style={{ backgroundColor: '#f8717120', color: '#f87171' }}>
            <Square size={12} />
          </button>
        ) : (
          <button onClick={execute} disabled={!workflowId} className="px-2 py-1 rounded text-xs cursor-pointer" style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}>
            <Play size={12} />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mx-3 mb-2">
          <div className="ab-exec-progress">
            <div
              className={`ab-exec-progress-fill ${failedCount > 0 ? 'has-error' : ''}`}
              style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Approval dialog */}
      {pendingApproval && (
        <div className="mx-3 mb-2 p-2 rounded border" style={{ borderColor: '#fbbf24', backgroundColor: '#fbbf2410' }}>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={12} style={{ color: '#fbbf24' }} />
            <span className="text-xs font-medium" style={{ color: '#fbbf24' }}>Approval Required</span>
          </div>
          <p className="text-[11px] mb-2" style={{ color: 'var(--text-300)' }}>{pendingApproval.message}</p>
          <div className="flex gap-2">
            <button onClick={() => handleApproval(true)} className="px-3 py-1 rounded text-xs cursor-pointer" style={{ backgroundColor: '#34d39920', color: '#34d399' }}>
              Approve
            </button>
            <button onClick={() => handleApproval(false)} className="px-3 py-1 rounded text-xs cursor-pointer" style={{ backgroundColor: '#f8717120', color: '#f87171' }}>
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Node statuses */}
      {isExpanded && (
        <div className="px-3 pb-2 overflow-y-auto" style={{ maxHeight: '300px' }}>
          {Array.from(nodeStatuses.values()).map(status => (
            <div key={status.nodeId} className="mb-1">
              <button
                onClick={() => toggleNode(status.nodeId)}
                className="flex items-center gap-2 w-full text-left py-1 cursor-pointer"
              >
                {statusIcon(status.status)}
                <span className="text-[11px] font-mono" style={{ color: 'var(--text-300)' }}>
                  {status.nodeId}
                </span>
                {status.toolCalls && status.toolCalls.length > 0 && (
                  <span className="text-[9px] px-1 rounded bg-blue-500/20 text-blue-400">
                    {status.toolCalls.length} tools
                  </span>
                )}
              </button>
              {expandedNodes.has(status.nodeId) && status.output && (
                <div className="ml-5 mt-1 relative">
                  <button
                    onClick={() => navigator.clipboard.writeText(typeof status.output === 'string' ? status.output : JSON.stringify(status.output, null, 2))}
                    className="absolute top-1 right-1 p-1 rounded text-[9px] cursor-pointer z-10"
                    style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}
                    title="Copy output"
                  >
                    Copy
                  </button>
                  <div className="p-2 rounded text-[10px] font-mono overflow-x-auto" style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)' }}>
                    <pre className="whitespace-pre-wrap">{typeof status.output === 'string' ? status.output : JSON.stringify(status.output, null, 2)}</pre>
                  </div>
                </div>
              )}
              {expandedNodes.has(status.nodeId) && status.error && (
                <div className="ml-5 mt-1 p-2 rounded text-[10px] font-mono" style={{ backgroundColor: '#f8717110', color: '#f87171' }}>
                  {status.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-3 mb-2 p-2 rounded text-[11px]" style={{ backgroundColor: '#f8717110', color: '#f87171' }}>
          {error}
        </div>
      )}
    </div>
  );
}
