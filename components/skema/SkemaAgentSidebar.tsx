import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { SkemaAgentSidebarProps } from './agent/types';
import { useSkemaAgentStream } from './agent/useSkemaAgentStream';
import { useSkemaAgentSessions } from './agent/useSkemaAgentSessions';
import { AgentSidebarShell } from '@/components/shared/AgentSidebarShell';

export const SkemaAgentSidebar: React.FC<SkemaAgentSidebarProps> = ({
  isOpen,
  onToggle,
  project,
  activeBoardIdx,
  currentHtml,
  modelConfig,
  onNotification,
  onHtmlGenerated,
  models,
  selectedModelId,
  onModelChange,
  gridState,
  onComponentPlaced,
  onComponentRemoved,
  onComponentUpdated,
}) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isStreaming,
    pendingAskUser,
    setPendingAskUser,
    agentPlanTasks,
    taskStatuses,
    shouldAutoScrollRef,
    isStreamingRef,
    resetAgentState,
    handleSend: streamSend,
    handleAbort,
  } = useSkemaAgentStream({
    messages,
    setMessages,
    modelConfig,
    selectedModelId,
    project,
    activeBoardIdx,
    currentHtml,
    onNotification,
    onHtmlGenerated,
    gridState,
    onComponentPlaced,
    onComponentRemoved,
    onComponentUpdated,
  });

  const {
    sessions,
    activeSessionId,
    handleSwitchSession,
    handleNewSession,
    handleDeleteSession,
  } = useSkemaAgentSessions({
    project,
    activeBoardIdx,
    isStreaming,
    messages,
    setMessages,
    onResetAgentState: resetAgentState,
  });

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      shouldAutoScrollRef.current = false;
    }
  }, [messages, shouldAutoScrollRef]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    streamSend(input);
    setInput('');
  }, [input, streamSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const handleToggleCollapse = useCallback((msgId: string, blockIdx: number) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || !m.blocks) return m;
      return { ...m, blocks: m.blocks.map((b: any, i: number) => i === blockIdx && b.type === 'tool_call' ? { ...b, collapsed: !b.collapsed } : b) };
    }));
  }, [setMessages]);

  return (
    <AgentSidebarShell
      isOpen={isOpen}
      onToggle={onToggle}
      header={
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-300)' }}>
          <Sparkles size={18} style={{ color: 'var(--neon-color)', flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-100)' }}>Canvas Agent</p>
            <p className="truncate text-xs" style={{ color: 'var(--text-500)' }}>{isStreaming ? 'Working...' : 'Ready to assist'}</p>
          </div>
          <button onClick={onToggle} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-80" style={{ color: 'var(--text-500)' }} title="Close panel">
            <X size={14} />
          </button>
        </div>
      }
      sessions={sessions}
      activeSessionId={activeSessionId}
      onSwitchSession={handleSwitchSession}
      onNewSession={handleNewSession}
      onDeleteSession={handleDeleteSession}
      messages={messages}
      taskStatuses={taskStatuses}
      messagesEndRef={messagesEndRef}
      input={input}
      setInput={setInput}
      isStreaming={isStreaming}
      pendingAskUser={pendingAskUser}
      onKeyDown={handleKeyDown}
      onSend={handleSend}
      onAbort={handleAbort}
      placeholder="Ask about your design..."
      models={models}
      selectedModelId={selectedModelId}
      onModelChange={onModelChange}
      showStreamingBar={true}
      showCollapseButton={true}
      onToggleCollapse={handleToggleCollapse}
    />
  );
};

export default SkemaAgentSidebar;
