import { useState, useCallback, useEffect, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { AgentBuilderCanvas } from './AgentBuilderCanvas';
import { AgentDetailPanel } from './AgentDetailPanel';
import { ToolDetailPanel } from './ToolDetailPanel';
import { AgentChatView } from './AgentChatView';
import { useAgentBuilder } from './hooks/useAgentBuilder';
import type { AgentBuilderAgent, AgentBuilderTool, AgentBuilderWorkflow, WorkflowDetail } from './types';
import './styles.css';

export interface AgentBuilderSidebarControls {
  agents: AgentBuilderAgent[];
  tools: AgentBuilderTool[];
  workflows: AgentBuilderWorkflow[];
  workflowDetail: WorkflowDetail | null;
  selectedAgentId: string | null;
  selectedWorkflowId: string | null;
  view: 'canvas' | 'chat';
  onSelectAgent: (id: string | null) => void;
  onSelectWorkflow: (id: string | null) => void;
  onSwitchView: (view: 'canvas' | 'chat') => void;
  onCreateAgent: (data: Partial<AgentBuilderAgent>) => Promise<any>;
  onCreateTool: (data: Partial<AgentBuilderTool>) => Promise<any>;
  onCreateWorkflow: (data: Partial<AgentBuilderWorkflow>) => Promise<any>;
  onDeleteWorkflow: (id: string) => Promise<any>;
  onAddAgentToWorkflow: (workflowId: string, agentId: string) => Promise<void>;
  onRemoveAgentFromWorkflow: (workflowId: string, agentId: string) => Promise<void>;
  onAddToolToWorkflow: (workflowId: string, toolId: string) => Promise<void>;
  onRemoveToolFromWorkflow: (workflowId: string, toolId: string) => Promise<void>;
}

interface AgentBuilderPanelProps {
  theme: 'dark' | 'light';
  onNotification: (msg: string, type: 'success' | 'error') => void;
  onSidebarControls?: (controls: AgentBuilderSidebarControls | null) => void;
}

const PANEL_CLOSE_MS = 300;

export default function AgentBuilderPanel({ theme, onNotification, onSidebarControls }: AgentBuilderPanelProps) {
  const {
    tools, agents, workflows, loading,
    fetchAll,
    createTool, updateTool, deleteTool,
    createAgent, updateAgent, deleteAgent, getAgentWithTools, attachTool, detachTool,
    createWorkflow, updateWorkflow, deleteWorkflow,
    fetchWorkflowDetail, addAgentToWorkflow, removeAgentFromWorkflow, addToolToWorkflow, removeToolFromWorkflow, saveWorkflowGraph,
  } = useAgentBuilder();

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [workflowDetail, setWorkflowDetail] = useState<WorkflowDetail | null>(null);
  const [view, setView] = useState<'canvas' | 'chat'>('canvas');
  const [detailNode, setDetailNode] = useState<{ id: string; type: 'agent' | 'tool' } | null>(null);
  const [isClosingDetail, setIsClosingDetail] = useState(false);
  const [fullAgent, setFullAgent] = useState<AgentBuilderAgent | null>(null);

  const controlsRef = useRef<AgentBuilderSidebarControls | null>(null);
  const onSidebarControlsRef = useRef(onSidebarControls);
  onSidebarControlsRef.current = onSidebarControls;

  const loadWorkflowDetail = useCallback(async (id: string) => {
    const detail = await fetchWorkflowDetail(id);
    setWorkflowDetail(detail);
  }, [fetchWorkflowDetail]);

  useEffect(() => {
    setSelectedAgentId(null);
    if (selectedWorkflowId) {
      loadWorkflowDetail(selectedWorkflowId);
    } else {
      setWorkflowDetail(null);
    }
  }, [selectedWorkflowId, loadWorkflowDetail]);

  useEffect(() => {
    if (view === 'chat' && selectedWorkflowId && workflowDetail?.agents.length && !selectedAgentId) {
      setSelectedAgentId(workflowDetail.agents[0].id);
    }
  }, [view, selectedWorkflowId, workflowDetail, selectedAgentId]);

  useEffect(() => {
    const setter = onSidebarControlsRef.current;
    if (!setter) return;
    const next: AgentBuilderSidebarControls = {
      agents, tools, workflows, workflowDetail,
      selectedAgentId, selectedWorkflowId, view,
      onSelectAgent: setSelectedAgentId,
      onSelectWorkflow: setSelectedWorkflowId,
      onSwitchView: setView,
      onCreateAgent: createAgent,
      onCreateTool: createTool,
      onCreateWorkflow: createWorkflow,
      onDeleteWorkflow: deleteWorkflow,
      onAddAgentToWorkflow: handleAddAgentToWorkflow,
      onRemoveAgentFromWorkflow: handleRemoveAgentFromWorkflow,
      onAddToolToWorkflow: handleAddToolToWorkflow,
      onRemoveToolFromWorkflow: handleRemoveToolFromWorkflow,
    };
    const prev = controlsRef.current;
    const changed = !prev
      || prev.agents !== next.agents
      || prev.tools !== next.tools
      || prev.workflows !== next.workflows
      || prev.workflowDetail !== next.workflowDetail
      || prev.selectedAgentId !== next.selectedAgentId
      || prev.selectedWorkflowId !== next.selectedWorkflowId
      || prev.view !== next.view;
    if (changed) {
      controlsRef.current = next;
      setter(next);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, tools, workflows, workflowDetail, selectedAgentId, selectedWorkflowId, view]);

  useEffect(() => {
    return () => {
      onSidebarControlsRef.current?.(null);
      controlsRef.current = null;
    };
  }, []);

  const selectedAgent = (() => {
    if (!selectedAgentId) return null;
    const wfAgent = workflowDetail?.agents.find(a => a.id === selectedAgentId);
    if (wfAgent) return wfAgent;
    return agents.find(a => a.id === selectedAgentId) || null;
  })();

  useEffect(() => {
    if (selectedAgentId) {
      getAgentWithTools(selectedAgentId).then(setFullAgent);
    } else {
      setFullAgent(null);
    }
  }, [selectedAgentId, getAgentWithTools, tools]);

  const handleCloseDetail = useCallback(() => {
    setIsClosingDetail(true);
    setTimeout(() => {
      setDetailNode(null);
      setIsClosingDetail(false);
    }, PANEL_CLOSE_MS);
  }, []);

  const handleOpenDetail = useCallback((id: string, type: 'agent' | 'tool') => {
    setDetailNode({ id, type });
  }, []);

  const handleUpdateAgent = useCallback(async (id: string, data: Partial<AgentBuilderAgent>) => {
    const result = await updateAgent(id, data);
    if (result) {
      onNotification('Agent updated', 'success');
      if (id === selectedAgentId) {
        const fresh = await getAgentWithTools(id);
        if (fresh) setFullAgent(fresh);
      }
      if (selectedWorkflowId) loadWorkflowDetail(selectedWorkflowId);
    }
    return result;
  }, [updateAgent, onNotification, selectedAgentId, getAgentWithTools, selectedWorkflowId, loadWorkflowDetail]);

  const handleDeleteAgent = useCallback(async (id: string) => {
    const ok = await deleteAgent(id);
    if (ok) {
      onNotification('Agent deleted', 'success');
      if (selectedAgentId === id) setSelectedAgentId(null);
      if (selectedWorkflowId) loadWorkflowDetail(selectedWorkflowId);
    }
    return ok;
  }, [deleteAgent, onNotification, selectedAgentId, selectedWorkflowId, loadWorkflowDetail]);

  const handleUpdateTool = useCallback(async (id: string, data: Partial<AgentBuilderTool>) => {
    const result = await updateTool(id, data);
    if (result) {
      onNotification('Tool updated', 'success');
      if (selectedWorkflowId) loadWorkflowDetail(selectedWorkflowId);
    }
    return result;
  }, [updateTool, onNotification, selectedWorkflowId, loadWorkflowDetail]);

  const handleDeleteTool = useCallback(async (id: string) => {
    const ok = await deleteTool(id);
    if (ok) {
      onNotification('Tool deleted', 'success');
      if (selectedWorkflowId) loadWorkflowDetail(selectedWorkflowId);
    }
    return ok;
  }, [deleteTool, onNotification, selectedWorkflowId, loadWorkflowDetail]);

  const handleAttachTool = useCallback(async (agentId: string, toolId: string) => {
    await attachTool(agentId, toolId);
    const updated = await getAgentWithTools(agentId);
    if (updated) setFullAgent(updated);
    if (selectedWorkflowId) loadWorkflowDetail(selectedWorkflowId);
    onNotification('Tool attached', 'success');
  }, [attachTool, getAgentWithTools, onNotification, selectedWorkflowId, loadWorkflowDetail]);

  const handleDetachTool = useCallback(async (agentId: string, toolId: string) => {
    await detachTool(agentId, toolId);
    const updated = await getAgentWithTools(agentId);
    if (updated) setFullAgent(updated);
    if (selectedWorkflowId) loadWorkflowDetail(selectedWorkflowId);
    onNotification('Tool detached', 'success');
  }, [detachTool, getAgentWithTools, onNotification, selectedWorkflowId, loadWorkflowDetail]);

  const handleCanvasConnect = useCallback(async (agentId: string, toolId: string) => {
    await attachTool(agentId, toolId);
    onNotification('Tool connected', 'success');
  }, [attachTool, onNotification]);

  const handleAddAgentToWorkflow = useCallback(async (workflowId: string, agentId: string) => {
    await addAgentToWorkflow(workflowId, agentId);
    await loadWorkflowDetail(workflowId);
  }, [addAgentToWorkflow, loadWorkflowDetail]);

  const handleRemoveAgentFromWorkflow = useCallback(async (workflowId: string, agentId: string) => {
    await removeAgentFromWorkflow(workflowId, agentId);
    await loadWorkflowDetail(workflowId);
  }, [removeAgentFromWorkflow, loadWorkflowDetail]);

  const handleAddToolToWorkflow = useCallback(async (workflowId: string, toolId: string) => {
    await addToolToWorkflow(workflowId, toolId);
    await loadWorkflowDetail(workflowId);
  }, [addToolToWorkflow, loadWorkflowDetail]);

  const handleRemoveToolFromWorkflow = useCallback(async (workflowId: string, toolId: string) => {
    await removeToolFromWorkflow(workflowId, toolId);
    await loadWorkflowDetail(workflowId);
  }, [removeToolFromWorkflow, loadWorkflowDetail]);

  const detailAgent = detailNode?.type === 'agent' ? agents.find(a => a.id === detailNode.id) || (fullAgent?.id === detailNode.id ? fullAgent : null) : null;
  const detailTool = detailNode?.type === 'tool' ? tools.find(t => t.id === detailNode.id) || null : null;

  return (
    <ReactFlowProvider>
      <div className="ab-container">
        <div className="ab-main">
          {!selectedWorkflowId ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.08)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--neon-color)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v6m0 6v6M3 12h6m6 0h6"/></svg>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-100)' }}>Select a workflow to get started</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-500)' }}>Pick a workflow from the sidebar or create a new one</p>
              </div>
            </div>
          ) : view === 'canvas' ? (
            <AgentBuilderCanvas
              workflowDetail={workflowDetail}
              agents={agents}
              tools={tools}
              selectedAgentId={selectedAgentId}
              onNodeClick={(id, type) => {
                if (type === 'agent') setSelectedAgentId(id);
                handleOpenDetail(id, type);
              }}
              onOpenDetail={handleOpenDetail}
              onConnect={handleCanvasConnect}
              onGraphChange={(graphJson) => saveWorkflowGraph(selectedWorkflowId, graphJson)}
            />
          ) : (
            <AgentChatView
              key={selectedWorkflowId}
              agent={fullAgent || selectedAgent}
              workflowAgents={workflowDetail?.agents}
              onSelectAgent={(id) => setSelectedAgentId(id || null)}
            />
          )}
        </div>

        {detailNode && detailAgent && (
          <AgentDetailPanel
            agent={detailAgent}
            allTools={tools}
            onClose={handleCloseDetail}
            onUpdate={handleUpdateAgent}
            onDelete={handleDeleteAgent}
            onAttachTool={handleAttachTool}
            onDetachTool={handleDetachTool}
            isClosing={isClosingDetail}
          />
        )}

        {detailNode && detailTool && (
          <ToolDetailPanel
            tool={detailTool}
            onClose={handleCloseDetail}
            onUpdate={handleUpdateTool}
            onDelete={handleDeleteTool}
            isClosing={isClosingDetail}
          />
        )}
      </div>
    </ReactFlowProvider>
  );
}
