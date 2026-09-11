import { useState, useCallback, useRef } from 'react';
import { parseSSEStream } from './shared/useSSEStream';

interface ExecutionState {
  executionId?: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
  nodeResults: Record<string, any>;
  variables: Record<string, any>;
  error?: string;
  pendingApproval?: {
    approvalId: string;
    nodeId: string;
    message: string;
    executionId?: string;
  };
}

export function useWorkflowExecution() {
  const [state, setState] = useState<ExecutionState>({
    status: 'idle',
    nodeResults: {},
    variables: {},
  });
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (workflowId: string, input: any) => {
    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      status: 'running',
      nodeResults: {},
      variables: {},
    });

    try {
      const response = await fetch(`/api/workflows/${workflowId}/execute-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      for await (const event of parseSSEStream(response)) {
        if (event.type === 'completed') {
          setState(prev => ({ ...prev, status: 'completed' }));
        } else if (event.type === 'paused' && event.pendingAuth) {
          setState(prev => ({
            ...prev,
            status: 'paused',
            pendingApproval: {
              approvalId: event.pendingAuth.authId,
              nodeId: event.pendingAuth.nodeId,
              message: event.pendingAuth.message,
              executionId: event.pendingAuth.executionId,
            },
          }));
        } else if (event.type === 'error') {
          setState(prev => ({ ...prev, status: 'failed', error: event.error }));
        } else if (event.type === 'state_update' && event.state) {
          setState(prev => ({
            ...prev,
            nodeResults: { ...prev.nodeResults, ...(event.state.nodeResults || {}) },
            variables: { ...prev.variables, ...(event.state.variables || {}) },
          }));
        } else if (event.nodeId && event.data) {
          setState(prev => ({
            ...prev,
            nodeResults: {
              ...prev.nodeResults,
              [event.nodeId]: event.data,
            },
          }));
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setState(prev => ({ ...prev, status: 'failed', error: err.message }));
      }
    } finally {
      abortRef.current = null;
    }
  }, []);

  const resume = useCallback(async (workflowId: string, executionId: string, approved: boolean) => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId, approved }),
      });
      const data = await response.json();
      if (data.success) {
        setState(prev => ({ ...prev, status: 'running', pendingApproval: undefined }));
      }
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message }));
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState(prev => ({ ...prev, status: 'idle' }));
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle', nodeResults: {}, variables: {} });
  }, []);

  return {
    ...state,
    execute,
    resume,
    cancel,
    reset,
    isRunning: state.status === 'running',
    isPaused: state.status === 'paused',
  };
}
