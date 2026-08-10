import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen, X, Square, MoreVertical, MessageSquare, Trash2, Plus, Undo2, Redo2,
} from 'lucide-react';
import { CATEGORY_LABELS } from './constants';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { AgentSidebarProps } from './agent/types';
import { useAgentStream } from './agent/useAgentStream';
import { useAgentSessions } from './agent/useAgentSessions';
import { MessageBubble, EmptyState } from './agent/MessageBlocks';
import { ModelPicker } from './agent/ModelPicker';

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
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [collapsedCodeBlocks, setCollapsedCodeBlocks] = useState<Set<string>>(new Set());
  const [width, setWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!isResizing) return;
    function onMouseMove(e: MouseEvent) {
      e.preventDefault();
      const rect = sidebarRef.current?.getBoundingClientRect();
      if (!rect) return;
      setWidth(Math.min(700, Math.max(280, rect.right - e.clientX)));
    }
    function onMouseUp() {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    streamSend(input);
    setInput('');
  }, [input, streamSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const handleCopyCode = useCallback(async (code: string, key: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(key);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {}
  }, []);

  const toggleCodeBlock = useCallback((key: string) => {
    setCollapsedCodeBlocks(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const handleToggleCollapse = useCallback((msgId: string, blockIdx: number) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || !m.blocks) return m;
      return { ...m, blocks: m.blocks.map((b: any, i: number) => i === blockIdx && b.type === 'tool_call' ? { ...b, collapsed: !b.collapsed } : b) };
    }));
  }, [setMessages]);

  if (!selectedComponent) return null;

  const categoryLabel = CATEGORY_LABELS[selectedComponent.category] || selectedComponent.category;

  return (
    <aside
      ref={sidebarRef}
      className={`
        flex-shrink-0 h-full flex flex-col relative
        fixed md:relative z-50 md:z-auto right-0
        ${isOpen ? 'translate-x-0' : 'w-0 translate-x-full md:translate-x-0 overflow-hidden'}
        ${isResizing ? '' : 'transition-[width] duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)]'}
      `}
      style={{ width: isOpen ? width : 0, backgroundColor: 'var(--bg-100)', borderLeft: isOpen ? '1px solid var(--border-300)' : 'none' }}
    >
      <div
        onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
        className="absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center"
        style={{ width: 6, cursor: 'col-resize', transform: 'translateX(-3px)' }}
      >
        <div className="w-[3px] h-8 rounded-full transition-opacity" style={{ backgroundColor: isResizing ? 'var(--neon-color)' : 'var(--border-300)', opacity: isResizing ? 1 : 0.5 }} />
      </div>

      <div className={`flex flex-col h-full transition-opacity duration-200 overflow-hidden ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
        <Header
          selectedComponent={selectedComponent}
          categoryLabel={categoryLabel}
          isStreaming={isStreaming}
          onToggle={onToggle}
          onUndoAgent={onUndoAgent}
          onRedoAgent={onRedoAgent}
          canUndoAgent={canUndoAgent}
          canRedoAgent={canRedoAgent}
        />

        <SessionTabs
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSwitchSession={handleSwitchSession}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
        />

        <MessageList
          messages={messages}
          taskStatuses={taskStatuses}
          collapsedCodeBlocks={collapsedCodeBlocks}
          toggleCodeBlock={toggleCodeBlock}
          copiedCode={copiedCode}
          handleCopyCode={handleCopyCode}
          onToggleCollapse={handleToggleCollapse}
          messagesEndRef={messagesEndRef}
        />

        <InputBar
          input={input}
          setInput={setInput}
          isStreaming={isStreaming}
          pendingAskUser={pendingAskUser}
          selectedComponent={selectedComponent}
          models={models}
          selectedModelId={selectedModelId}
          onModelChange={onModelChange}
          onKeyDown={handleKeyDown}
          onSend={handleSend}
          onAbort={handleAbort}
        />
      </div>
    </aside>
  );
};

function Header({ selectedComponent, categoryLabel, isStreaming, onToggle, onUndoAgent, onRedoAgent, canUndoAgent, canRedoAgent }: {
  selectedComponent: any;
  categoryLabel: string;
  isStreaming: boolean;
  onToggle: () => void;
  onUndoAgent?: () => void;
  onRedoAgent?: () => void;
  canUndoAgent?: boolean;
  canRedoAgent?: boolean;
}) {
  return (
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
  );
}

function SessionTabs({ sessions, activeSessionId, onSwitchSession, onNewSession, onDeleteSession }: {
  sessions: Array<{ id: string; title: string | null; createdAt: string; updatedAt: string }>;
  activeSessionId: string | null;
  onSwitchSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
}) {
  if (sessions.length === 0) return null;

  return (
    <div className="flex-shrink-0 px-3 pt-2 pb-0" style={{ borderBottom: '1px solid var(--border-300)' }}>
      <div className="flex flex-col gap-0.5 overflow-y-auto max-h-32">
        {sessions.map((session) => {
          const isActive = activeSessionId === session.id;
          return (
            <div key={session.id} className="flex items-center gap-1.5 group/session">
              <button
                onClick={() => onSwitchSession(session.id)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] transition-colors truncate flex-1 rounded-md"
                style={{ backgroundColor: isActive ? 'var(--bg-200)' : 'transparent', color: isActive ? 'var(--neon-color)' : 'var(--text-500)' }}
                title={session.title || 'New chat'}
              >
                <MessageSquare size={10} style={{ flexShrink: 0, opacity: 0.6 }} />
                <span className="truncate">{session.title || 'New chat'}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`w-5 h-5 rounded flex items-center justify-center transition-opacity flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-0 group-hover/session:opacity-100'}`} style={{ color: 'var(--text-500)' }}>
                    <MoreVertical size={10} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="bottom" style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)' }}>
                  <DropdownMenuItem onClick={() => onDeleteSession(session.id)} className="text-xs cursor-pointer" style={{ color: '#ef4444' }}>
                    <Trash2 size={11} className="mr-1.5" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
        <button onClick={onNewSession} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors hover:opacity-80 text-[11px]" style={{ color: 'var(--text-500)' }} title="New chat">
          <Plus size={10} />
          <span>New session</span>
        </button>
      </div>
    </div>
  );
}

function MessageList({ messages, taskStatuses, collapsedCodeBlocks, toggleCodeBlock, copiedCode, handleCopyCode, onToggleCollapse, messagesEndRef }: {
  messages: any[];
  taskStatuses: Record<string, string>;
  collapsedCodeBlocks: Set<string>;
  toggleCodeBlock: (key: string) => void;
  copiedCode: string | null;
  handleCopyCode: (code: string, key: string) => void;
  onToggleCollapse: (msgId: string, blockIdx: number) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 pt-2 min-h-0">
      <div className="space-y-3 pb-2">
        {messages.length === 0 && <EmptyState />}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            taskStatuses={taskStatuses}
            collapsedCodeBlocks={collapsedCodeBlocks}
            toggleCodeBlock={toggleCodeBlock}
            copiedCode={copiedCode}
            handleCopyCode={handleCopyCode}
            onToggleCollapse={onToggleCollapse}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

function InputBar({ input, setInput, isStreaming, pendingAskUser, selectedComponent, models, selectedModelId, onModelChange, onKeyDown, onSend, onAbort }: {
  input: string;
  setInput: (v: string) => void;
  isStreaming: boolean;
  pendingAskUser: string | null;
  selectedComponent: any;
  models?: Array<{ id: string; name: string }>;
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onAbort: () => void;
}) {
  return (
    <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid var(--border-300)' }}>
      {pendingAskUser && (
        <div className="px-3 py-1.5 rounded-lg text-xs mb-2" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.06)', color: 'var(--text-300)' }}>
          <span style={{ color: 'var(--neon-color)', fontWeight: 600 }}>Question: </span>{pendingAskUser}
        </div>
      )}
      <div className="rounded-2xl p-2 transition-all duration-300" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
        <textarea
          aria-label="Message agent"
          className="w-full bg-transparent text-sm leading-5 outline-none resize-none min-h-[36px] max-h-[120px] px-2 py-1.5"
          style={{ color: 'var(--text-100)' }}
          onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; }}
          onKeyDown={onKeyDown}
          placeholder={pendingAskUser ? 'Type your answer...' : selectedComponent ? `Ask about ${selectedComponent.name}...` : 'Ask the agent...'}
          rows={1}
          value={input}
          disabled={isStreaming}
        />
        <div className="flex items-center justify-end gap-2 pt-1">
          <div className="flex items-center gap-1">
            {models && models.length > 1 && <ModelPicker models={models} selectedModelId={selectedModelId} onModelChange={onModelChange} />}
          </div>
          <button
            type="button"
            onClick={() => { if (isStreaming) onAbort(); else onSend(); }}
            disabled={!isStreaming && !input.trim()}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200"
            style={{ backgroundColor: isStreaming ? 'rgba(239,68,68,0.15)' : input.trim() ? 'var(--neon-color)' : 'var(--bg-300)', color: isStreaming ? '#f87171' : input.trim() ? '#000' : 'var(--text-500)', opacity: !isStreaming && !input.trim() ? 0.5 : 1 }}
          >
            {isStreaming ? <Square size={11} className="fill-current" /> : <span style={{ fontSize: 14 }}>&#8593;</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AgentSidebar;
