import { useState, useCallback } from 'react';
import type { Workflow, WorkflowNodeType, WorkflowNode, WorkflowEdge } from './types';

const API_BASE = '/api/workflows';

export function useWorkflow() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE);
      const data = await res.json();
      setWorkflows(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWorkflow = useCallback(async (id: string): Promise<Workflow | null> => {
    const res = await fetch(`${API_BASE}/${id}`);
    if (!res.ok) return null;
    return res.json();
  }, []);

  const saveWorkflow = useCallback(async (id: string | undefined, data: { name: string; nodes: WorkflowNode[]; edges: WorkflowEdge[] }) => {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/${id}` : API_BASE;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Save failed');
    const result = await res.json();
    await fetchWorkflows();
    return result;
  }, [fetchWorkflows]);

  const deleteWorkflow = useCallback(async (id: string) => {
    await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    await fetchWorkflows();
  }, [fetchWorkflows]);

  return { workflows, loading, fetchWorkflows, fetchWorkflow, saveWorkflow, deleteWorkflow };
}
