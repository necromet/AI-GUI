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
        if (event.type === 'workflow_completed') {
          setState(prev => ({ ...prev, status: 'completed' }));
        } else if (event.type === 'workflow_paused' && event.pendingAction) {
          setState(prev => ({
            ...prev,
            status: 'paused',
            pendingApproval: {
              approvalId: event.pendingAction.approvalId,
              nodeId: event.pendingAction.nodeId,
              message: event.pendingAction.message,
              executionId: event.pendingAction.executionId,
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
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setState(prev => ({ ...prev, status: 'running', pendingApproval: undefined }));
      for await (const event of parseSSEStream(response)) {
        if (event.type === 'workflow_completed') {
          setState(prev => ({ ...prev, status: 'completed', variables: event.state?.variables || prev.variables, nodeResults: event.state?.nodeResults || prev.nodeResults }));
        } else if (event.type === 'workflow_paused') {
          setState(prev => ({ ...prev, status: 'paused', pendingApproval: event.pendingAction }));
        } else if (event.type === 'error') {
          setState(prev => ({ ...prev, status: 'failed', error: event.error }));
        }
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
