import { useState, useCallback, useEffect } from 'react';
import type {
  AgentBuilderTool,
  AgentBuilderAgent,
  AgentBuilderWorkflow,
  WorkflowDetail,
} from '../types';

const API = '/api/agent-builder';

export function useAgentBuilder() {
  const [tools, setTools] = useState<AgentBuilderTool[]>([]);
  const [agents, setAgents] = useState<AgentBuilderAgent[]>([]);
  const [workflows, setWorkflows] = useState<AgentBuilderWorkflow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTools = useCallback(async () => {
    try {
      const res = await fetch(`${API}/tools`);
      const data = await res.json();
      setTools(data.tools || []);
    } catch (err) {
      console.error('[useAgentBuilder] fetchTools error:', err);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API}/agents`);
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (err) {
      console.error('[useAgentBuilder] fetchAgents error:', err);
    }
  }, []);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch(`${API}/workflows`);
      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch (err) {
      console.error('[useAgentBuilder] fetchWorkflows error:', err);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchTools(), fetchAgents(), fetchWorkflows()]);
    setLoading(false);
  }, [fetchTools, fetchAgents, fetchWorkflows]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Tools ───

  const createTool = useCallback(async (input: Partial<AgentBuilderTool>) => {
    const res = await fetch(`${API}/tools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (res.ok) setTools(prev => [data, ...prev]);
    return data;
  }, []);

  const updateTool = useCallback(async (id: string, input: Partial<AgentBuilderTool>) => {
    const res = await fetch(`${API}/tools/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (res.ok) setTools(prev => prev.map(t => t.id === id ? data : t));
    return data;
  }, []);

  const deleteTool = useCallback(async (id: string) => {
    const res = await fetch(`${API}/tools/${id}`, { method: 'DELETE' });
    if (res.ok) setTools(prev => prev.filter(t => t.id !== id));
    return res.ok;
  }, []);

  // ─── Agents ───

  const createAgent = useCallback(async (input: Partial<AgentBuilderAgent>) => {
    const res = await fetch(`${API}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (res.ok) setAgents(prev => [data, ...prev]);
    return data;
  }, []);

  const updateAgent = useCallback(async (id: string, input: Partial<AgentBuilderAgent>) => {
    const res = await fetch(`${API}/agents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (res.ok) setAgents(prev => prev.map(a => a.id === id ? data : a));
    return data;
  }, []);

  const deleteAgent = useCallback(async (id: string) => {
    const res = await fetch(`${API}/agents/${id}`, { method: 'DELETE' });
    if (res.ok) setAgents(prev => prev.filter(a => a.id !== id));
    return res.ok;
  }, []);

  const getAgentWithTools = useCallback(async (id: string): Promise<AgentBuilderAgent | null> => {
    try {
      const res = await fetch(`${API}/agents/${id}`);
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }, []);

  const attachTool = useCallback(async (agentId: string, toolId: string) => {
    await fetch(`${API}/agents/${agentId}/tools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolId }),
    });
    await fetchAgents();
  }, [fetchAgents]);

  const detachTool = useCallback(async (agentId: string, toolId: string) => {
    await fetch(`${API}/agents/${agentId}/tools/${toolId}`, { method: 'DELETE' });
    await fetchAgents();
  }, [fetchAgents]);

  // ─── Workflows ───

  const createWorkflow = useCallback(async (input: Partial<AgentBuilderWorkflow>) => {
    const res = await fetch(`${API}/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (res.ok) setWorkflows(prev => [data, ...prev]);
    return data;
  }, []);

  const updateWorkflow = useCallback(async (id: string, input: Partial<AgentBuilderWorkflow>) => {
    const res = await fetch(`${API}/workflows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (res.ok) setWorkflows(prev => prev.map(w => w.id === id ? data : w));
    return data;
  }, []);

  const deleteWorkflow = useCallback(async (id: string) => {
    const res = await fetch(`${API}/workflows/${id}`, { method: 'DELETE' });
    if (res.ok) setWorkflows(prev => prev.filter(w => w.id !== id));
    return res.ok;
  }, []);

  // ─── Workflow Detail + Junction CRUD ───

  const fetchWorkflowDetail = useCallback(async (id: string): Promise<WorkflowDetail | null> => {
    try {
      const res = await fetch(`${API}/workflows/${id}/detail`);
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }, []);

  const addAgentToWorkflow = useCallback(async (workflowId: string, agentId: string) => {
    await fetch(`${API}/workflows/${workflowId}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId }),
    });
  }, []);

  const removeAgentFromWorkflow = useCallback(async (workflowId: string, agentId: string) => {
    await fetch(`${API}/workflows/${workflowId}/agents/${agentId}`, { method: 'DELETE' });
  }, []);

  const addToolToWorkflow = useCallback(async (workflowId: string, toolId: string) => {
    await fetch(`${API}/workflows/${workflowId}/tools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolId }),
    });
  }, []);

  const removeToolFromWorkflow = useCallback(async (workflowId: string, toolId: string) => {
    await fetch(`${API}/workflows/${workflowId}/tools/${toolId}`, { method: 'DELETE' });
  }, []);

  const saveWorkflowGraph = useCallback(async (workflowId: string, graphJson: Record<string, any>) => {
    await fetch(`${API}/workflows/${workflowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph_json: graphJson }),
    });
  }, []);

  return {
    tools, agents, workflows, loading,
    fetchTools, fetchAgents, fetchWorkflows, fetchAll,
    createTool, updateTool, deleteTool,
    createAgent, updateAgent, deleteAgent, getAgentWithTools, attachTool, detachTool,
    createWorkflow, updateWorkflow, deleteWorkflow,
    fetchWorkflowDetail, addAgentToWorkflow, removeAgentFromWorkflow, addToolToWorkflow, removeToolFromWorkflow, saveWorkflowGraph,
  };
}
