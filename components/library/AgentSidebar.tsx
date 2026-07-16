import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot, X, Sparkles, ChevronDown, ChevronRight, Copy, Check, Square,
  MoreVertical, MessageSquare, Trash2, Plus, CheckCircle2, CircleX,
} from 'lucide-react';
import { MathCurveLoader } from '@/components/ui/math-curve-loader';
import { ModelConfig, LibraryComponent } from '../../types';
import { CATEGORY_LABELS } from './constants';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AgentPlan, AgentTask } from '@/components/ui/agent-plan';
import { getSystemPromptAppend } from '../../lib/agentConfig';

type MessageBlock =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; id?: string; name: string; arguments: Record<string, any>; result?: { output: string; error?: string }; collapsed?: boolean; progress?: string }
  | { type: 'ask_user'; question: string }
  | { type: 'agent_plan'; tasks: AgentTask[] };

interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isThinking?: boolean;
  blocks?: MessageBlock[];
}

interface AgentSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  selectedComponent: LibraryComponent | null;
  modelConfig?: ModelConfig;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  onComponentUpdated?: (comp: LibraryComponent) => void;
  onComponentsReload?: () => void;
  models?: Array<{ id: string; name: string }>;
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;
}

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
}) => {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingAskUser, setPendingAskUser] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [collapsedCodeBlocks, setCollapsedCodeBlocks] = useState<Set<string>>(new Set());
  const [agentPlanTasks, setAgentPlanTasks] = useState<AgentTask[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, string>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Array<{ id: string; title: string | null; createdAt: string; updatedAt: string }>>([]);
  const [width, setWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const shouldAutoScrollRef = useRef(false);
  const isStreamingRef = useRef(false);
  const agentPlanTasksRef = useRef<AgentTask[]>([]);
  const verifyingComponentRef = useRef<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const wasStreamingRef = useRef(false);

  agentPlanTasksRef.current = agentPlanTasks;

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

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      try {
        await fetch('/api/library-agent/verify-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            componentId: verifyingComponentRef.current,
            errors: detail.errors || [],
            success: detail.success !== false,
          }),
        });
      } catch {}
      verifyingComponentRef.current = null;
    };
    window.addEventListener('agent-verify-result', handler);
    return () => window.removeEventListener('agent-verify-result', handler);
  }, []);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      shouldAutoScrollRef.current = false;
    }
  }, [messages]);

  useEffect(() => {
    if (!selectedComponent) {
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
      return;
    }
    const loadSessions = async () => {
      try {
        const resp = await fetch(`/api/library/agent/sessions/${selectedComponent.id}`);
        if (!resp.ok) return;
        const data = await resp.json();
        const loadedSessions = data.sessions || [];
        setSessions(loadedSessions);
        if (loadedSessions.length > 0) {
          const latest = loadedSessions[0];
          setActiveSessionId(latest.id);
          try {
            const sessionResp = await fetch(`/api/library/agent/session/${latest.id}`);
            if (sessionResp.ok) {
              const sessionData = await sessionResp.json();
              setMessages(JSON.parse(sessionData.session?.messagesJson || '[]'));
              return;
            }
          } catch {}
          setMessages([]);
          return;
        }
        const createResp = await fetch('/api/library/agent/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ componentId: selectedComponent.id }),
        });
        if (createResp.ok) {
          const createData = await createResp.json();
          setActiveSessionId(createData.session.id);
          setSessions(prev => [createData.session, ...prev]);
        }
        setMessages([]);
      } catch {}
    };
    loadSessions();
  }, [selectedComponent?.id]);

  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming && activeSessionId) {
      const body: Record<string, any> = { messages };
      if (messages.length === 2 && messages[0].role === 'user') {
        body.title = messages[0].content.substring(0, 50);
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, title: body.title } : s));
      }
      fetch(`/api/library/agent/sessions/${activeSessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => {});
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, messages, activeSessionId]);

  const handleSwitchSession = async (sessionId: string) => {
    if (sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    setAgentPlanTasks([]);
    setTaskStatuses({});
    try {
      const resp = await fetch(`/api/library/agent/session/${sessionId}`);
      if (resp.ok) {
        const data = await resp.json();
        setMessages(JSON.parse(data.session?.messagesJson || '[]'));
      }
    } catch {}
  };

  const handleNewSession = async () => {
    if (!selectedComponent || sessions.length >= 3) return;
    try {
      const resp = await fetch('/api/library/agent/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ componentId: selectedComponent.id }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setActiveSessionId(data.session.id);
        setSessions(prev => [data.session, ...prev]);
        setMessages([]);
        setPendingAskUser(null);
      }
    } catch {}
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const resp = await fetch(`/api/library/agent/sessions/${sessionId}`, { method: 'DELETE' });
      if (resp.ok) {
        setSessions(prev => {
          const remaining = prev.filter(s => s.id !== sessionId);
          if (activeSessionId === sessionId) {
            if (remaining.length > 0) handleSwitchSession(remaining[0].id);
            else { setActiveSessionId(null); setMessages([]); }
          }
          return remaining;
        });
      }
    } catch {}
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isStreamingRef.current || !selectedComponent) return;

    isStreamingRef.current = true;
    setInput('');
    setPendingAskUser(null);
    setAgentPlanTasks([]);
    setTaskStatuses({});
    shouldAutoScrollRef.current = true;

    const userMsg: AgentMessage = { id: Math.random().toString(36).slice(2), role: 'user', content: text };
    const aiMsgId = Math.random().toString(36).slice(2);
    setMessages(prev => [...prev, userMsg, { id: aiMsgId, role: 'assistant', content: '', isThinking: true, blocks: [] }]);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const MAX_AGENT_ROUNDS = 10;
      let round = 0;

      const serverMessages: any[] = [];
      for (const m of messages) {
        const entry: any = { role: m.role, content: m.content };
        if (m.blocks) {
          const tcs = m.blocks.filter((b: any) => b.type === 'tool_call');
          if (tcs.length > 0) {
            const allHaveResults = tcs.every((tc: any) => tc.result);
            if (allHaveResults) {
              entry.tool_calls = tcs.map((tc: any) => ({
                id: tc.id || Math.random().toString(36).slice(2),
                type: 'function',
                function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
              }));
              serverMessages.push(entry);
              for (const tc of tcs) {
                serverMessages.push({
                  role: 'tool',
                  tool_call_id: tc.id || Math.random().toString(36).slice(2),
                  tool_name: tc.name,
                  content: tc.result.error ? `Error: ${tc.result.error}` : tc.result.output,
                });
              }
            } else {
              serverMessages.push({ role: m.role, content: m.content });
            }
            continue;
          }
        }
        serverMessages.push(entry);
      }
      serverMessages.push({ role: 'user', content: text });

      while (round < MAX_AGENT_ROUNDS) {
        round++;

        const response = await fetch('/api/library-agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: serverMessages,
            model: modelConfig?.apiModelId || modelConfig?.id || 'mimo-v2.5',
            provider: modelConfig?.provider,
            stream: true,
            componentId: selectedComponent.id,
            systemPromptAppend: getSystemPromptAppend('library'),
          }),
          signal: abortController.signal,
        });

        if (!response.ok) throw new Error(await response.text());

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let roundHadToolCalls = false;
        let roundHadAskUser = false;
        let roundTextContent = '';
        const roundToolCalls: Array<{ id: string; name: string; arguments: any }> = [];
        const roundToolResults: Array<{ toolCallId: string; name: string; output: string; error?: string }> = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;

            let parsed: any;
            try { parsed = JSON.parse(data); } catch { continue; }
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.done) continue;

            if (parsed.content) {
              roundTextContent += parsed.content;
              setMessages(prev => prev.map(m => {
                if (m.id !== aiMsgId) return m;
                const blocks = m.blocks ? [...m.blocks] : [];
                const lastBlock = blocks[blocks.length - 1];
                if (lastBlock && lastBlock.type === 'text') {
                  blocks[blocks.length - 1] = { ...lastBlock, content: lastBlock.content + parsed.content };
                } else {
                  blocks.push({ type: 'text', content: parsed.content });
                }
                return { ...m, blocks, isThinking: false };
              }));
            }

            if (parsed.reasoning) {
              setMessages(prev => prev.map(m => {
                if (m.id !== aiMsgId) return m;
                return { ...m, thinkingContent: ((m as any).thinkingContent || '') + parsed.reasoning };
              }));
            }

            if (parsed.tool_call) {
              const toolName = parsed.tool_call.name;
              const toolId = parsed.tool_call.id || `tc_${Math.random().toString(36).slice(2)}`;
              roundHadToolCalls = true;
              roundToolCalls.push({ id: toolId, name: toolName, arguments: parsed.tool_call.arguments });
              setMessages(prev => prev.map(m => {
                if (m.id !== aiMsgId) return m;
                const blocks = m.blocks ? [...m.blocks] : [];
                blocks.push({ type: 'tool_call', id: toolId, name: toolName, arguments: parsed.tool_call.arguments, collapsed: true });
                return { ...m, blocks, isThinking: false };
              }));
              const tasks = agentPlanTasksRef.current;
              if (tasks.length > 0) {
                const match = tasks.find(t =>
                  toolName.includes(t.title.toLowerCase().split(' ')[0]) ||
                  (toolName === 'read_component' && t.title.toLowerCase().includes('read')) ||
                  (toolName === 'create_todo_list' && t.title.toLowerCase().includes('plan')) ||
                  (toolName === 'write_component_file' && t.title.toLowerCase().includes('writ')) ||
                  (toolName === 'verify_component' && t.title.toLowerCase().includes('verif'))
                );
                if (match) setTaskStatuses(prev => ({ ...prev, [match.id]: 'in-progress' }));
              }
            }

            if (parsed.tool_result) {
              const { name: resultName, toolCallId, error: resultError } = parsed.tool_result;
              roundToolResults.push({ toolCallId, name: resultName, output: parsed.tool_result.output, error: resultError });
              setMessages(prev => prev.map(m => {
                if (m.id !== aiMsgId) return m;
                const blocks = m.blocks ? [...m.blocks] : [];
                for (let i = blocks.length - 1; i >= 0; i--) {
                  const b = blocks[i];
                  if (b.type === 'tool_call' && !b.result) {
                    if (b.id === toolCallId || b.name === resultName) {
                      blocks[i] = { ...b, result: { output: parsed.tool_result.output, error: resultError }, progress: undefined };
                      break;
                    }
                  }
                }
                return { ...m, blocks };
              }));
              const tasks = agentPlanTasksRef.current;
              if (tasks.length > 0) {
                const match = tasks.find(t =>
                  resultName.includes(t.title.toLowerCase().split(' ')[0]) ||
                  (resultName === 'read_component' && t.title.toLowerCase().includes('read')) ||
                  (resultName === 'create_todo_list' && t.title.toLowerCase().includes('plan')) ||
                  (resultName === 'write_component_file' && t.title.toLowerCase().includes('writ')) ||
                  (resultName === 'verify_component' && t.title.toLowerCase().includes('verif'))
                );
                if (match) setTaskStatuses(prev => ({ ...prev, [match.id]: resultError ? 'failed' : 'completed' }));
              }
            }

            if (parsed.ask_user) {
              roundHadAskUser = true;
              setPendingAskUser(parsed.ask_user.question);
              setMessages(prev => prev.map(m => {
                if (m.id !== aiMsgId) return m;
                const blocks = m.blocks ? [...m.blocks] : [];
                blocks.push({ type: 'ask_user', question: parsed.ask_user.question });
                return { ...m, blocks, isThinking: false };
              }));
            }

            if (parsed.verify_component) {
              verifyingComponentRef.current = parsed.verify_component.componentId;
              window.dispatchEvent(new CustomEvent('agent-verify-component', {
                detail: { componentId: parsed.verify_component.componentId },
              }));
            }

            if (parsed.component_created) {
              onNotification?.(`Created: ${parsed.component_created.name}`, 'success');
              onComponentsReload?.();
              window.dispatchEvent(new CustomEvent('agent-file-changed', {
                detail: { componentId: parsed.component_created.id, files: parsed.component_created.files },
              }));
            }

            if (parsed.component_updated) {
              onComponentUpdated?.(parsed.component_updated);
              onComponentsReload?.();
              window.dispatchEvent(new CustomEvent('agent-file-changed', {
                detail: { componentId: parsed.component_updated.id, files: parsed.component_updated.files },
              }));
            }

            if (parsed.todo_list && Array.isArray(parsed.todo_list)) {
              const tasks: AgentTask[] = parsed.todo_list.map((t: any) => ({
                id: String(t.id),
                title: t.title || `Task ${t.id}`,
                description: t.description || '',
                status: 'pending',
                priority: t.priority || 'medium',
                subtasks: [],
              }));
              setAgentPlanTasks(tasks);
              setTaskStatuses({});
              setMessages(prev => prev.map(m => {
                if (m.id !== aiMsgId) return m;
                const blocks = m.blocks ? [...m.blocks] : [];
                blocks.push({ type: 'agent_plan', tasks });
                return { ...m, blocks, isThinking: false };
              }));
            }
          }
        }

        if (!roundHadToolCalls || roundHadAskUser) break;

        serverMessages.push({
          role: 'assistant',
          content: roundTextContent || '',
          tool_calls: roundToolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        });
        for (const tr of roundToolResults) {
          serverMessages.push({
            role: 'tool',
            tool_call_id: tr.toolCallId,
            tool_name: tr.name,
            content: tr.error ? `Error: ${tr.error}` : tr.output,
          });
        }

        await new Promise(r => setTimeout(r, 300));
        if (abortController.signal.aborted) break;

        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, isThinking: true } : m
        ));
      }

      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, isThinking: false } : m
      ));
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, isThinking: false } : m
        ));
      } else {
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, content: `Error: ${err.message}`, isThinking: false } : m
        ));
      }
    } finally {
      abortControllerRef.current = null;
      isStreamingRef.current = false;
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleCopyCode = async (code: string, key: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(key);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {}
  };

  const toggleCodeBlock = (key: string) => {
    setCollapsedCodeBlocks(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

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
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-300)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.2), rgba(var(--neon-rgb), 0.05))', boxShadow: '0 0 12px rgba(var(--neon-rgb), 0.1)' }}>
            <Bot size={16} style={{ color: 'var(--neon-color)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-100)' }}>Library Agent</p>
            <p className="truncate text-xs" style={{ color: 'var(--text-500)' }}>{isStreaming ? 'Working...' : `Editing ${selectedComponent.name}`}</p>
          </div>
          <button onClick={onToggle} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-80" style={{ color: 'var(--text-500)' }} title="Close panel">
            <X size={14} />
          </button>
        </div>

        {/* Context Badge */}
        <div className="px-4 pt-3 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.06), rgba(var(--neon-rgb), 0.02))', border: '1px solid rgba(var(--neon-rgb), 0.12)' }}>
            <Sparkles size={12} style={{ color: 'var(--neon-color)', flexShrink: 0 }} />
            <span className="text-xs font-medium truncate" style={{ color: 'var(--text-100)' }}>{selectedComponent.name}</span>
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto flex-shrink-0" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}>{categoryLabel}</Badge>
            {selectedComponent.files && selectedComponent.files.length > 1 && (
              <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-500)' }}>{selectedComponent.files.length} files</span>
            )}
          </div>
        </div>

        {/* Session Tabs */}
        {sessions.length > 0 && (
          <div className="flex-shrink-0 px-3 pt-2 pb-0" style={{ borderBottom: '1px solid var(--border-300)' }}>
            <div className="flex items-end gap-0.5 overflow-x-auto">
              {sessions.slice(0, 3).map((session) => {
                const isActive = activeSessionId === session.id;
                return (
                  <div key={session.id} className="flex items-center gap-0.5 group/session flex-shrink-0">
                    <button
                      onClick={() => handleSwitchSession(session.id)}
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
                        <DropdownMenuItem onClick={() => handleDeleteSession(session.id)} className="text-xs cursor-pointer" style={{ color: '#ef4444' }}>
                          <Trash2 size={11} className="mr-1.5" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
              {sessions.length < 3 && (
                <button onClick={handleNewSession} className="flex items-center justify-center w-7 h-7 rounded-t-lg transition-colors flex-shrink-0 hover:opacity-80" style={{ color: 'var(--text-500)', marginBottom: 2 }} title="New chat">
                  <Plus size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 pt-2 min-h-0">
          <div className="space-y-3 pb-2">
            {messages.length === 0 && (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.12), rgba(var(--neon-rgb), 0.04))' }}>
                  <MessageSquare size={20} style={{ color: 'var(--neon-color)' }} />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-300)' }}>Start a conversation</p>
                <p className="text-xs" style={{ color: 'var(--text-500)' }}>Ask the agent to help with your component</p>
              </div>
            )}
            {messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[92%] rounded-2xl text-sm leading-relaxed" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.15)', color: 'var(--text-100)', wordBreak: 'break-word' }}>
                      <div className="px-3.5 py-2.5 whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                );
              }

              if (!msg.blocks || msg.blocks.length === 0) {
                if (msg.isThinking) {
                  return (
                    <div key={msg.id} className="flex justify-start">
                      <div className="rounded-2xl px-4 py-3 flex items-center gap-2.5" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}>
                        <MathCurveLoader size={28} />
                        <span className="text-xs" style={{ color: 'var(--text-500)' }}>Thinking...</span>
                      </div>
                    </div>
                  );
                }
                if (msg.content) {
                  return (
                    <div key={msg.id} className="flex justify-start">
                      <div className="max-w-[92%] rounded-2xl" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)', wordBreak: 'break-word' }}>
                        <div className="px-3.5 py-2.5 text-sm leading-relaxed" style={{ color: 'var(--text-100)' }}>
                          <MarkdownRenderer content={msg.content} msgId={msg.id} blockIdx={0} collapsedCodeBlocks={collapsedCodeBlocks} toggleCodeBlock={toggleCodeBlock} copiedCode={copiedCode} handleCopyCode={handleCopyCode} />
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }

              return (
                <React.Fragment key={msg.id}>
                  {msg.blocks.map((block, blockIdx) => {
                    if (block.type === 'text' && block.content) {
                      return (
                        <div key={blockIdx} className="flex justify-start">
                          <div className="max-w-[92%] rounded-2xl" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)', wordBreak: 'break-word' }}>
                            <div className="px-3.5 py-2.5 text-sm leading-relaxed [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:my-2 [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:my-2 [&>ol]:list-decimal [&>ol]:ml-4 [&>li]:mb-1 [&>h1]:text-lg [&>h1]:font-bold [&>h1]:mb-2 [&>h1]:mt-3 [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mb-2 [&>h2]:mt-3 [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mb-1 [&>h3]:mt-2 [&>blockquote]:border-l-2 [&>blockquote]:pl-3 [&>blockquote]:my-2 [&>blockquote]:italic [&>blockquote]:opacity-70" style={{ color: 'var(--text-100)' }}>
                              <MarkdownRenderer content={block.content} msgId={msg.id} blockIdx={blockIdx} collapsedCodeBlocks={collapsedCodeBlocks} toggleCodeBlock={toggleCodeBlock} copiedCode={copiedCode} handleCopyCode={handleCopyCode} />
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (block.type === 'tool_call') {
                      const status = block.progress ? 'running' : block.result?.error ? 'error' : block.result ? 'done' : 'running';
                      const statusColor = status === 'done' && !block.result?.error ? '#4ade80' : status === 'error' || block.result?.error ? '#f87171' : 'var(--neon-color)';
                      return (
                        <div key={blockIdx} className="flex justify-start">
                          <div className="max-w-[92%] rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-300)', borderLeft: `3px solid ${statusColor}`, backgroundColor: 'var(--bg-100)' }}>
                            <button
                              onClick={() => setMessages(prev => prev.map(m => {
                                if (m.id !== msg.id || !m.blocks) return m;
                                return { ...m, blocks: m.blocks.map((b, i) => i === blockIdx && b.type === 'tool_call' ? { ...b, collapsed: !b.collapsed } : b) };
                              }))}
                              className="w-full flex items-center gap-2 px-3 py-2 transition-colors hover:opacity-80"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-100)' }}
                            >
                              {status === 'done' ? (
                                <CheckCircle2 size={13} style={{ color: statusColor, flexShrink: 0 }} />
                              ) : status === 'error' ? (
                                <CircleX size={13} style={{ color: statusColor, flexShrink: 0 }} />
                              ) : (
                                <div className="flex-shrink-0"><MathCurveLoader size={16} color={statusColor} /></div>
                              )}
                              <span className="text-xs font-semibold font-mono truncate" style={{ color: 'var(--text-100)' }}>{block.name}</span>
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto flex-shrink-0" style={{ backgroundColor: `${statusColor}1a`, color: statusColor }}>
                                {block.result?.error ? 'error' : status === 'done' ? 'done' : 'running'}
                              </Badge>
                            </button>
                            {!block.collapsed && block.result && (
                              <div className="px-3 pb-2 pt-0 text-[11px] font-mono overflow-hidden" style={{ color: block.result.error ? '#f87171' : 'var(--text-500)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 150, overflowY: 'auto' }}>
                                {block.result.error || (block.result.output.length > 500 ? block.result.output.substring(0, 500) + '...' : block.result.output)}
                              </div>
                            )}
                            {!block.collapsed && block.progress && (
                              <div className="px-3 pb-2 pt-0 text-[11px] font-mono" style={{ color: 'var(--text-500)' }}>{block.progress}</div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (block.type === 'agent_plan') {
                      return (
                        <div key={blockIdx} className="flex justify-start">
                          <div className="max-w-[92%] rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-300)', borderLeft: '3px solid #a78bfa', backgroundColor: 'var(--bg-100)' }}>
                            <div className="px-3 py-2"><AgentPlan tasks={block.tasks} taskStatuses={taskStatuses} /></div>
                          </div>
                        </div>
                      );
                    }

                    if (block.type === 'ask_user') {
                      return (
                        <div key={blockIdx} className="flex justify-start">
                          <div className="max-w-[92%] rounded-xl px-3 py-2.5 text-xs" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.08)', border: '1px solid rgba(var(--neon-rgb), 0.15)', borderLeft: '3px solid var(--neon-color)' }}>
                            <span style={{ color: 'var(--neon-color)' }}>{block.question}</span>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })}
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
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
              onKeyDown={handleKeyDown}
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
                onClick={() => { if (isStreaming) abortControllerRef.current?.abort(); else handleSend(); }}
                disabled={!isStreaming && !input.trim()}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200"
                style={{ backgroundColor: isStreaming ? 'rgba(239,68,68,0.15)' : input.trim() ? 'var(--neon-color)' : 'var(--bg-300)', color: isStreaming ? '#f87171' : input.trim() ? '#000' : 'var(--text-500)', opacity: !isStreaming && !input.trim() ? 0.5 : 1 }}
              >
                {isStreaming ? <Square size={11} className="fill-current" /> : <span style={{ fontSize: 14 }}>&#8593;</span>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

function MarkdownRenderer({ content, msgId, blockIdx, collapsedCodeBlocks, toggleCodeBlock, copiedCode, handleCopyCode }: {
  content: string; msgId: string; blockIdx: number; collapsedCodeBlocks: Set<string>; toggleCodeBlock: (key: string) => void; copiedCode: string | null; handleCopyCode: (code: string, key: string) => void;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre: ({ children }) => {
          const getCodeString = (c: any): string => {
            if (typeof c === 'string') return c;
            if (c?.props?.children) { const ch = c.props.children; return Array.isArray(ch) ? ch.map(getCodeString).join('') : getCodeString(ch); }
            return '';
          };
          const codeString = getCodeString(children).replace(/\n$/, '');
          const codeNode = (children as any)?.props;
          const language = codeNode?.className?.replace('language-', '') || '';
          const blockKey = `${msgId}-b${blockIdx}-${language}-${codeString.substring(0, 30)}`;
          const isCollapsed = collapsedCodeBlocks.has(blockKey);
          const isCopied = copiedCode === blockKey;
          return (
            <div className="my-2 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-300)' }}>
              <div className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer" style={{ backgroundColor: 'var(--bg-100)' }} onClick={() => toggleCodeBlock(blockKey)}>
                <div className="flex items-center gap-1.5">
                  {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                  <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>{language || 'code'}</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-500)' }}>{codeString.split('\n').length} lines</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleCopyCode(codeString, blockKey); }} className="p-1 rounded transition-colors hover:opacity-80" style={{ color: isCopied ? 'var(--neon-color)' : 'var(--text-500)' }} title="Copy code">
                  {isCopied ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
              {!isCollapsed && (
                <pre className="p-3 overflow-auto text-[11px] font-mono" style={{ maxHeight: 300, background: '#1e1e2e', margin: 0 }}><code>{codeString}</code></pre>
              )}
            </div>
          );
        },
        code: ({ className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '');
          if (match) return <code className={className} {...props}>{children}</code>;
          return <code className="px-1 py-0.5 rounded text-[11px]" style={{ backgroundColor: 'var(--bg-100)', color: 'var(--neon-color)' }} {...props}>{children}</code>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function ModelPicker({ models, selectedModelId, onModelChange }: {
  models: Array<{ id: string; name: string }>; selectedModelId?: string; onModelChange?: (modelId: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="rounded-full transition-all flex items-center gap-1 px-2 py-1 h-7 text-[var(--text-500)] hover:text-[var(--text-300)]">
          <span className="text-xs truncate max-w-[80px]">{models.find(m => m.id === selectedModelId)?.name || 'Model'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-48 p-1" style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)' }}>
        {models.map(m => (
          <button key={m.id} type="button" onClick={() => onModelChange?.(m.id)} className="w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors hover:opacity-80" style={{ color: m.id === selectedModelId ? 'var(--neon-color)' : 'var(--text-300)', backgroundColor: m.id === selectedModelId ? 'rgba(var(--neon-rgb), 0.08)' : 'transparent' }}>
            {m.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export default AgentSidebar;
