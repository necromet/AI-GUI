import { useState, useCallback, useEffect, useRef } from 'react';

interface WorkflowListItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  nodes: any[];
  edges: any[];
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useWorkflow() {
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workflows');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setWorkflows(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveWorkflow = useCallback(async (id: string | undefined, data: Partial<WorkflowListItem>) => {
    try {
      const method = id ? 'PUT' : 'POST';
      const url = id ? `/api/workflows/${id}` : '/api/workflows';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      await fetchWorkflows();
      return result;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [fetchWorkflows]);

  const deleteWorkflow = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchWorkflows();
    } catch (err: any) {
      setError(err.message);
    }
  }, [fetchWorkflows]);

  const duplicateWorkflow = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/workflows/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const workflow = await res.json();
      const { id: _, createdAt: _c, updatedAt: _u, ...rest } = workflow;
      return await saveWorkflow(undefined, { ...rest, name: `${rest.name} (Copy)` });
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [saveWorkflow]);

  return {
    workflows,
    loading,
    error,
    fetchWorkflows,
    saveWorkflow,
    deleteWorkflow,
    duplicateWorkflow,
  };
}
