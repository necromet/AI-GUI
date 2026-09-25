import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowUp, Bot, Check, Copy, Moon, RotateCcw, Share2, Sparkles, Square, Sun, Trash2, Workflow } from 'lucide-react';
import MarkdownRenderer from '../chat/MarkdownRenderer';
import { parseSSEStream } from './shared/useSSEStream';

interface SharedWorkflowChatProps {
  token: string;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

interface ChatMetadata {
  name: string;
  description: string;
  suggestions: string[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

const id = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export default function SharedWorkflowChat({ token, theme, onToggleTheme }: SharedWorkflowChatProps) {
  const storageKey = `edward:labs_sharedChat_${token}`;
  const conversationKey = `edward:labs_sharedChatConversation_${token}`;
  const [conversationId, setConversationId] = useState(() => {
    const stored = localStorage.getItem(conversationKey);
    if (stored) return stored;
    const created = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `chat_${id()}_${id()}`;
    localStorage.setItem(conversationKey, created);
    return created;
  });
  const [metadata, setMetadata] = useState<ChatMetadata | null>(null);
  const [loadError, setLoadError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const clearConversation = useCallback(() => {
    if (isRunning) return;
    const created = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `chat_${id()}_${id()}`;
    localStorage.setItem(conversationKey, created);
    setConversationId(created);
    setMessages([]);
  }, [conversationKey, isRunning]);

  useEffect(() => {
    let active = true;
    fetch(`/api/shared-workflows/${encodeURIComponent(token)}`)
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'This shared chat is unavailable.');
        return body;
      })
      .then(data => active && setMetadata(data))
      .catch(error => active && setLoadError(error.message));
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!metadata) return;
    const previousTitle = document.title;
    document.title = `${metadata.name} · Shared chat`;
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const created = !robots;
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    const previousRobots = robots.content;
    robots.content = 'noindex, nofollow, noarchive';
    return () => {
      document.title = previousTitle;
      if (created) robots?.remove();
      else if (robots) robots.content = previousRobots;
    };
  }, [metadata]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.filter(message => message.content)));
    } catch {}
    endRef.current?.scrollIntoView({ behavior: isRunning ? 'smooth' : 'auto' });
  }, [messages, storageKey, isRunning]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
  }, [input]);

  const runChat = useCallback(async (content: string, history: ChatMessage[]) => {
    const text = content.trim();
    if (!text || isRunning) return;

    const userMessage: ChatMessage = { id: id(), role: 'user', content: text };
    const assistantId = id();
    setMessages([...history, userMessage, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setIsRunning(true);
    setProgress('Starting workflow');

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch(`/api/shared-workflows/${encodeURIComponent(token)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId,
          history: history.filter(message => message.content).slice(-20).map(({ role, content: value }) => ({ role, content: value })),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${response.status})`);
      }

      let receivedMessage = false;
      for await (const event of parseSSEStream(response)) {
        if (event.type === 'progress') {
          const verb = event.status === 'completed' ? 'Finished' : event.status === 'failed' ? 'Failed' : 'Running';
          setProgress(`${verb} ${event.label || 'workflow step'}`);
        } else if (event.type === 'message') {
          receivedMessage = true;
          setMessages(current => current.map(message => message.id === assistantId ? { ...message, content: event.content || '' } : message));
        } else if (event.type === 'error') {
          throw new Error(event.error || 'The workflow could not complete.');
        }
      }
      if (!receivedMessage) throw new Error('The workflow finished without a response.');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setMessages(current => current.filter(message => message.id !== assistantId));
      } else {
        setMessages(current => current.map(message => message.id === assistantId
          ? { ...message, content: error.message || 'Something went wrong.', error: true }
          : message));
      }
    } finally {
      abortRef.current = null;
      setIsRunning(false);
      setProgress('');
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [isRunning, token, conversationId]);

  const submit = useCallback(() => void runChat(input, messages), [input, messages, runChat]);

  const retry = useCallback((assistantIndex: number) => {
    const userIndex = assistantIndex - 1;
    if (userIndex < 0 || messages[userIndex]?.role !== 'user') return;
    const base = messages.slice(0, userIndex);
    void runChat(messages[userIndex].content, base);
  }, [messages, runChat]);

  const copyMessage = useCallback(async (message: ChatMessage) => {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  }, []);

  const sharePage = useCallback(async () => {
    const shareData = { title: metadata?.name || 'Shared workflow chat', text: metadata?.description, url: window.location.href };
    if (navigator.share) await navigator.share(shareData).catch(() => {});
    else await navigator.clipboard.writeText(window.location.href);
  }, [metadata]);

  const initials = useMemo(() => (metadata?.name || 'AI').split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase(), [metadata]);

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-0)', color: 'var(--text-100)' }}>
        <div className="max-w-md text-center rounded-3xl border p-8" style={{ borderColor: 'var(--border-200)', background: 'var(--bg-100)', boxShadow: 'var(--card-shadow)' }}>
          <AlertCircle size={28} className="mx-auto mb-4" style={{ color: 'var(--semantic-danger)' }} />
          <h1 className="text-xl font-semibold mb-2">Chat unavailable</h1>
          <p className="text-sm leading-6" style={{ color: 'var(--text-400)' }}>{loadError}</p>
        </div>
      </div>
    );
  }

  if (!metadata) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-0)' }}><div className="h-7 w-7 rounded-full border-2 border-transparent border-t-[var(--neon-color)] animate-spin" /></div>;
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col relative" style={{ background: 'var(--bg-0)', color: 'var(--text-100)' }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/3 h-96 w-96 rounded-full blur-3xl opacity-[0.08]" style={{ background: 'var(--neon-color)' }} />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full blur-3xl opacity-[0.05]" style={{ background: 'var(--neon-secondary)' }} />
      </div>

      <header className="relative z-10 h-16 shrink-0 px-4 md:px-6 flex items-center gap-3 backdrop-blur-xl" style={{ background: 'color-mix(in srgb, var(--bg-0) 82%, transparent)' }}>
        <div className="h-9 w-9 rounded-xl flex items-center justify-center font-semibold text-xs" style={{ background: 'rgba(var(--neon-rgb),.13)', color: 'var(--neon-color)', border: '1px solid rgba(var(--neon-rgb),.2)' }}>{initials}</div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold truncate">{metadata.name}</h1>
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-400)' }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--semantic-success)' }} />Workflow agent</div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {messages.length > 0 && <button onClick={clearConversation} disabled={isRunning} className="h-9 w-9 rounded-xl flex items-center justify-center cursor-pointer disabled:opacity-35 hover:bg-[var(--bg-200)]" title="Clear conversation"><Trash2 size={15} /></button>}
          <button onClick={sharePage} className="h-9 w-9 rounded-xl flex items-center justify-center cursor-pointer hover:bg-[var(--bg-200)]" title="Share this chat"><Share2 size={15} /></button>
          <button onClick={onToggleTheme} className="h-9 w-9 rounded-xl flex items-center justify-center cursor-pointer hover:bg-[var(--bg-200)]" title="Toggle theme">{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button>
        </div>
      </header>

      <main className="relative z-[1] flex-1 min-h-0 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="min-h-full max-w-3xl mx-auto px-5 py-12 md:py-20 flex flex-col justify-center">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'rgba(var(--neon-rgb),.12)', color: 'var(--neon-color)', border: '1px solid rgba(var(--neon-rgb),.22)', boxShadow: '0 12px 40px rgba(var(--neon-rgb),.12)' }}><Sparkles size={24} /></div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] mb-3" style={{ color: 'var(--neon-color)' }}>Powered by a custom workflow</p>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-[-0.035em] leading-[1.08] max-w-2xl">Talk to {metadata.name}</h2>
            <p className="mt-4 text-sm md:text-base leading-7 max-w-xl" style={{ color: 'var(--text-400)' }}>{metadata.description}</p>
            <div className="mt-9 grid sm:grid-cols-3 gap-2.5">
              {metadata.suggestions?.slice(0, 3).map(suggestion => (
                <button key={suggestion} onClick={() => void runChat(suggestion, [])} className="group rounded-2xl p-4 text-left cursor-pointer transition-all hover:-translate-y-0.5" style={{ background: 'color-mix(in srgb, var(--bg-100) 88%, transparent)', boxShadow: 'var(--card-shadow)' }}>
                  <Workflow size={14} className="mb-3 transition-colors" style={{ color: 'var(--neon-color)' }} />
                  <span className="text-xs leading-5" style={{ color: 'var(--text-300)' }}>{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 pb-40 space-y-7">
            {messages.map((message, index) => (
              <div key={message.id} className={`group flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && <div className="mt-1 h-8 w-8 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(var(--neon-rgb),.12)', color: 'var(--neon-color)' }}><Bot size={15} /></div>}
                <div className={message.role === 'user' ? 'max-w-[85%] md:max-w-[72%]' : 'min-w-0 max-w-[calc(100%_-_44px)] flex-1'}>
                  {message.role === 'user' ? (
                    <div className="rounded-2xl rounded-br-md px-4 py-3 text-sm leading-6" style={{ background: 'var(--bg-200)', border: '1px solid var(--border-200)' }}>{message.content}</div>
                  ) : message.content ? (
                    <div className="rounded-2xl px-4 py-3.5" style={{ background: message.error ? 'rgba(248,113,113,.06)' : 'color-mix(in srgb, var(--bg-100) 46%, transparent)' }}>
                      {message.error ? <p className="text-sm" style={{ color: 'var(--semantic-danger)' }}>{message.content}</p> : <MarkdownRenderer content={message.content} />}
                      <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        <button onClick={() => void copyMessage(message)} className="h-7 px-2 rounded-lg text-[10px] flex items-center gap-1.5 cursor-pointer hover:bg-[var(--bg-200)]" style={{ color: 'var(--text-400)' }}>{copiedId === message.id ? <Check size={11} /> : <Copy size={11} />}{copiedId === message.id ? 'Copied' : 'Copy'}</button>
                        <button onClick={() => retry(index)} disabled={isRunning} className="h-7 px-2 rounded-lg text-[10px] flex items-center gap-1.5 cursor-pointer disabled:opacity-40 hover:bg-[var(--bg-200)]" style={{ color: 'var(--text-400)' }}><RotateCcw size={11} />Retry</button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-2">
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-400)' }}><span className="flex gap-1"><i className="h-1.5 w-1.5 rounded-full animate-pulse bg-[var(--neon-color)]" /><i className="h-1.5 w-1.5 rounded-full animate-pulse [animation-delay:120ms] bg-[var(--neon-color)]" /><i className="h-1.5 w-1.5 rounded-full animate-pulse [animation-delay:240ms] bg-[var(--neon-color)]" /></span>{progress || 'Thinking'}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </main>

      <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-4 pt-12 md:pb-6" style={{ background: 'linear-gradient(to top, var(--bg-0) 58%, transparent)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border p-2 shadow-xl backdrop-blur-xl" style={{ borderColor: 'var(--border-200)', background: 'color-mix(in srgb, var(--bg-100) 94%, transparent)' }}>
            <textarea ref={textareaRef} value={input} onChange={event => setInput(event.target.value.slice(0, 10_000))} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} disabled={isRunning} rows={1} placeholder={`Message ${metadata.name}…`} className="w-full max-h-[180px] resize-none bg-transparent border-none outline-none px-3 py-2.5 text-sm leading-6 disabled:opacity-60" style={{ color: 'var(--text-100)' }} />
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-[9px] pl-2" style={{ color: 'var(--text-500)' }}>Enter to send · Shift+Enter for a new line</span>
              {isRunning ? (
                <button onClick={() => abortRef.current?.abort()} className="h-9 w-9 rounded-xl flex items-center justify-center cursor-pointer" style={{ background: 'var(--text-100)', color: 'var(--bg-0)' }} title="Stop"><Square size={13} fill="currentColor" /></button>
              ) : (
                <button onClick={submit} disabled={!input.trim()} className="h-9 w-9 rounded-xl flex items-center justify-center cursor-pointer disabled:opacity-25 transition-transform hover:scale-105" style={{ background: 'var(--neon-color)', color: '#050505' }} title="Send"><ArrowUp size={17} /></button>
              )}
            </div>
          </div>
          <p className="mt-2 text-center text-[9px]" style={{ color: 'var(--text-500)' }}>Responses are generated by a custom workflow. Verify important information.</p>
        </div>
      </div>
    </div>
  );
}
