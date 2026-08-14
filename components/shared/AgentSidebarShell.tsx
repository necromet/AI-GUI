import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Square, MoreVertical, MessageSquare, Trash2, Plus, ChevronLeft,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MessageBubble, EmptyState } from '@/components/library/agent/MessageBlocks';
import { ModelPicker } from '@/components/library/agent/ModelPicker';

export interface AgentSidebarShellProps {
  isOpen: boolean;
  onToggle: () => void;
  header: React.ReactNode;
  sessions: Array<{ id: string; title: string | null; createdAt: string; updatedAt: string }>;
  activeSessionId: string | null;
  onSwitchSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  messages: any[];
  taskStatuses: Record<string, string>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  input: string;
  setInput: (v: string) => void;
  isStreaming: boolean;
  pendingAskUser: string | null;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onAbort: () => void;
  placeholder?: string;
  models?: Array<{ id: string; name: string }>;
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;
  showStreamingBar?: boolean;
  showCollapseButton?: boolean;
  onToggleCollapse: (msgId: string, blockIdx: number) => void;
}

export const AgentSidebarShell: React.FC<AgentSidebarShellProps> = ({
  isOpen,
  onToggle,
  header,
  sessions,
  activeSessionId,
  onSwitchSession,
  onNewSession,
  onDeleteSession,
  messages,
  taskStatuses,
  messagesEndRef,
  input,
  setInput,
  isStreaming,
  pendingAskUser,
  onKeyDown,
  onSend,
  onAbort,
  placeholder,
  models,
  selectedModelId,
  onModelChange,
  showStreamingBar = false,
  showCollapseButton = false,
  onToggleCollapse,
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [collapsedCodeBlocks, setCollapsedCodeBlocks] = useState<Set<string>>(new Set());
  const [width, setWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

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
        className={`absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center ${showCollapseButton ? 'group/collapse' : ''}`}
        style={{ width: showCollapseButton ? 10 : 6, cursor: 'col-resize', transform: `translateX(${showCollapseButton ? -5 : -3}px)` }}
      >
        <div className="w-[3px] h-8 rounded-full transition-opacity" style={{ backgroundColor: isResizing ? 'var(--neon-color)' : 'var(--border-300)', opacity: isResizing ? 1 : 0.5 }} />
        {showCollapseButton && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="absolute top-1/2 -translate-y-1/2 w-5 h-8 rounded-l-md flex items-center justify-center opacity-0 group-hover/collapse:opacity-100 transition-opacity"
            style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)', borderRight: 'none', color: 'var(--text-500)', transform: 'translateY(-50%) translateX(-2px)' }}
            title="Collapse panel"
          >
            <ChevronLeft size={12} />
          </button>
        )}
      </div>

      <div className={`flex flex-col h-full transition-opacity duration-200 overflow-hidden ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
        {header}

        <SessionTabs
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSwitchSession={onSwitchSession}
          onNewSession={onNewSession}
          onDeleteSession={onDeleteSession}
        />

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

        <InputBar
          input={input}
          setInput={setInput}
          isStreaming={isStreaming}
          pendingAskUser={pendingAskUser}
          models={models}
          selectedModelId={selectedModelId}
          onModelChange={onModelChange}
          onKeyDown={onKeyDown}
          onSend={onSend}
          onAbort={onAbort}
          placeholder={placeholder}
          showStreamingBar={showStreamingBar}
        />
      </div>
    </aside>
  );
};

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
      <div className="flex items-end gap-0.5 overflow-x-auto">
        {sessions.slice(0, 3).map((session) => {
          const isActive = activeSessionId === session.id;
          return (
            <div key={session.id} className="flex items-center gap-0.5 group/session flex-shrink-0">
              <button
                onClick={() => onSwitchSession(session.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] transition-colors truncate max-w-[110px] rounded-t-lg"
                style={{ backgroundColor: isActive ? 'var(--bg-200)' : 'transparent', color: isActive ? 'var(--neon-color)' : 'var(--text-500)', borderBottom: isActive ? '2px solid var(--neon-color)' : '2px solid transparent' }}
                title={session.title || 'New chat'}
              >
                <MessageSquare size={10} style={{ flexShrink: 0, opacity: 0.6 }} />
                <span className="truncate">{(() => { const t = session.title || 'New chat'; const w = t.split(/\s+/); return w.length > 3 ? w.slice(0, 3).join(' ') + '...' : t; })()}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-5 h-5 rounded flex items-center justify-center transition-opacity opacity-0 group-hover/session:opacity-100 flex-shrink-0" style={{ color: 'var(--text-500)', marginBottom: 2 }}>
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
        {sessions.length < 3 && (
          <button onClick={onNewSession} className="flex items-center justify-center w-7 h-7 rounded-t-lg transition-colors flex-shrink-0 hover:opacity-80" style={{ color: 'var(--text-500)', marginBottom: 2 }} title="New chat">
            <Plus size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function InputBar({ input, setInput, isStreaming, pendingAskUser, models, selectedModelId, onModelChange, onKeyDown, onSend, onAbort, placeholder, showStreamingBar }: {
  input: string;
  setInput: (v: string) => void;
  isStreaming: boolean;
  pendingAskUser: string | null;
  models?: Array<{ id: string; name: string }>;
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onAbort: () => void;
  placeholder?: string;
  showStreamingBar?: boolean;
}) {
  return (
    <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid var(--border-300)' }}>
      {showStreamingBar && isStreaming && (
        <div className="h-[2px] w-full mb-3 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full w-full skema-ai-line" />
        </div>
      )}
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
          placeholder={pendingAskUser ? 'Type your answer...' : placeholder || 'Ask the agent...'}
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

export default AgentSidebarShell;
