import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, X, Undo2, Redo2 } from 'lucide-react';
import { CATEGORY_LABELS } from './constants';
import { Badge } from '@/components/ui/badge';
import type { AgentSidebarProps } from './agent/types';
import { useAgentStream } from './agent/useAgentStream';
import { useAgentSessions } from './agent/useAgentSessions';
import { AgentSidebarShell } from '@/components/shared/AgentSidebarShell';

export const AgentSidebar: React.FC<AgentSidebarProps> = ({
  isOpen,
  onToggle,
  selectedComponent,
  modelConfig,
  onNotification,
  onComponentUpdated,
  onComponentsReload,
  models,
  selectedModelId,
  onModelChange,
  onUndoAgent,
  onRedoAgent,
  canUndoAgent,
  canRedoAgent,
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
  } = useAgentStream({
    messages,
    setMessages,
    modelConfig,
    selectedComponent,
    onNotification,
    onComponentUpdated,
    onComponentsReload,
  });

  const {
    sessions,
    activeSessionId,
    handleSwitchSession,
    handleNewSession,
    handleDeleteSession,
  } = useAgentSessions({
    selectedComponent,
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

  if (!selectedComponent) return null;

  const categoryLabel = CATEGORY_LABELS[selectedComponent.category] || selectedComponent.category;

  return (
    <AgentSidebarShell
      isOpen={isOpen}
      onToggle={onToggle}
      header={
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-300)' }}>
          <BookOpen size={18} style={{ color: 'var(--neon-color)', flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-100)' }}>Librarian</p>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 flex-shrink-0" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}>{categoryLabel}</Badge>
              {selectedComponent.files && selectedComponent.files.length > 1 && (
                <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-500)' }}>{selectedComponent.files.length} files</span>
              )}
            </div>
            <p className="truncate text-xs" style={{ color: 'var(--text-500)' }}>{isStreaming ? 'Working...' : `Editing ${selectedComponent.name}`}</p>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {onUndoAgent && (
              <button
                onClick={onUndoAgent}
                disabled={!canUndoAgent}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-80 disabled:opacity-30"
                style={{ color: 'var(--text-500)' }}
                title="Undo agent change"
              >
                <Undo2 size={13} />
              </button>
            )}
            {onRedoAgent && (
              <button
                onClick={onRedoAgent}
                disabled={!canRedoAgent}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-80 disabled:opacity-30"
                style={{ color: 'var(--text-500)' }}
                title="Redo agent change"
              >
                <Redo2 size={13} />
              </button>
            )}
            <button onClick={onToggle} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-80" style={{ color: 'var(--text-500)' }} title="Close panel">
              <X size={14} />
            </button>
          </div>
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
      placeholder={selectedComponent ? `Ask about ${selectedComponent.name}...` : 'Ask the agent...'}
      models={models}
      selectedModelId={selectedModelId}
      onModelChange={onModelChange}
      showStreamingBar={false}
      showCollapseButton={false}
      onToggleCollapse={handleToggleCollapse}
    />
  );
};

export default AgentSidebar;
