import { useState, useCallback, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';

interface ExecutionEvent {
  type: string;
  nodeId?: string;
  data?: any;
  error?: string;
  state?: any;
  pendingAuth?: any;
}

export function useWorkflowExecution() {
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (workflowId: string, nodes: Node[], edges: Edge[]) => {
    if (isRunning) return;

    setIsRunning(true);
    setEvents([]);
    setNodeStatuses({});

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/workflows/${workflowId}/execute-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: {} }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;

          try {
            const event: ExecutionEvent = JSON.parse(payload);
            setEvents(prev => [...prev, event]);

            if (event.type.startsWith('node_')) {
              const status = event.type.replace('node_', '');
              if (event.nodeId) {
                setNodeStatuses(prev => ({ ...prev, [event.nodeId!]: status }));
              }
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setEvents(prev => [...prev, { type: 'error', error: err.message }]);
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [isRunning]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { isRunning, events, nodeStatuses, execute, cancel };
}
