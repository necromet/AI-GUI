import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Role, Message } from '../types';
import { CHATGPT_LOGO } from '../constants';
import { Copy, ThumbsUp, ThumbsDown, RefreshCw, Check, Globe, ChevronDown, ExternalLink, Search } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const catppuccinLatte: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': {
    color: '#4c4f69',
    background: '#eff1f5',
    textShadow: 'none',
    fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
    fontSize: 'var(--app-font-size, 15px)',
    lineHeight: '1.5',
  },
  'pre[class*="language-"]': {
    color: '#4c4f69',
    background: '#eff1f5',
    textShadow: 'none',
    fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
    fontSize: 'var(--app-font-size, 15px)',
    lineHeight: '1.5',
    padding: '1rem',
    margin: '0',
    overflow: 'auto',
  },
  'comment': { color: '#7c7f93', fontStyle: 'italic' },
  'prolog': { color: '#7c7f93' },
  'doctype': { color: '#7c7f93' },
  'cdata': { color: '#7c7f93' },
  'punctuation': { color: '#5c5f77' },
  'namespace': { opacity: 0.7 },
  'property': { color: '#1e66f5' },
  'tag': { color: '#d20f39' },
  'constant': { color: '#fe640b' },
  'symbol': { color: '#df8e1d' },
  'deleted': { color: '#d20f39' },
  'boolean': { color: '#fe640b' },
  'number': { color: '#fe640b' },
  'selector': { color: '#40a02b' },
  'attr-name': { color: '#df8e1d' },
  'string': { color: '#40a02b' },
  'char': { color: '#40a02b' },
  'builtin': { color: '#d20f39' },
  'inserted': { color: '#40a02b' },
  'operator': { color: '#04a5e5' },
  'entity': { color: '#df8e1d', cursor: 'help' },
  'url': { color: '#04a5e5' },
  'variable': { color: '#4c4f69' },
  'atrule': { color: '#df8e1d' },
  'attr-value': { color: '#40a02b' },
  'function': { color: '#1e66f5' },
  'class-name': { color: '#df8e1d' },
  'keyword': { color: '#8839ef' },
  'regex': { color: '#ea76cb' },
  'important': { color: '#fe640b', fontWeight: 'bold' },
  'bold': { fontWeight: 'bold' },
  'italic': { fontStyle: 'italic' },
};

const catppuccinMocha: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': {
    color: '#cdd6f4',
    background: '#1e1e2e',
    textShadow: 'none',
    fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
    fontSize: 'var(--app-font-size, 15px)',
    lineHeight: '1.5',
  },
  'pre[class*="language-"]': {
    color: '#cdd6f4',
    background: '#1e1e2e',
    textShadow: 'none',
    fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
    fontSize: 'var(--app-font-size, 15px)',
    lineHeight: '1.5',
    padding: '1rem',
    margin: '0',
    overflow: 'auto',
  },
  'comment': { color: '#6c7086', fontStyle: 'italic' },
  'prolog': { color: '#6c7086' },
  'doctype': { color: '#6c7086' },
  'cdata': { color: '#6c7086' },
  'punctuation': { color: '#bac2de' },
  'namespace': { opacity: 0.7 },
  'property': { color: '#89b4fa' },
  'tag': { color: '#f38ba8' },
  'constant': { color: '#fab387' },
  'symbol': { color: '#f9e2af' },
  'deleted': { color: '#f38ba8' },
  'boolean': { color: '#fab387' },
  'number': { color: '#fab387' },
  'selector': { color: '#a6e3a1' },
  'attr-name': { color: '#f9e2af' },
  'string': { color: '#a6e3a1' },
  'char': { color: '#a6e3a1' },
  'builtin': { color: '#f38ba8' },
  'inserted': { color: '#a6e3a1' },
  'operator': { color: '#89dceb' },
  'entity': { color: '#f9e2af', cursor: 'help' },
  'url': { color: '#89dceb' },
  'variable': { color: '#cdd6f4' },
  'atrule': { color: '#f9e2af' },
  'attr-value': { color: '#a6e3a1' },
  'function': { color: '#89b4fa' },
  'class-name': { color: '#f9e2af' },
  'keyword': { color: '#cba6f7' },
  'regex': { color: '#f5c2e7' },
  'important': { color: '#fab387', fontWeight: 'bold' },
  'bold': { fontWeight: 'bold' },
  'italic': { fontStyle: 'italic' },
};

interface ChatMessageProps {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  onFeedback?: (messageId: string, feedback: 'good' | 'bad') => void;
}

function preprocessMarkdown(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }
    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    const hasWinPath = /(?:[A-Z]:\\|[A-Z]:\/)/i.test(line) && /\\\s/.test(line.replace(/`[^`]*`/g, ''));
    const looksLikePath = /(?:^|\s)[A-Z]:\\(?:Users|Windows|Program|AppData|Documents|Desktop|Downloads|Music|Pictures|Videos|OneDrive|PerfLogs|Recovery|System|Temp|Roaming|Local|LocalLow)/i.test(line);

    if (hasWinPath || looksLikePath) {
      const escaped = line.replace(/\\(?=[A-Za-z<>\s]|$)/g, '\\\\');
      result.push(escaped);
      continue;
    }

    result.push(line);
  }

  return result.join('\n');
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onRegenerate, onFeedback }) => {
  const isUser = message.role === Role.User;
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [feedback, setFeedback] = useState<'good' | 'bad' | null>(null);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(true);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [selectedAttachment, setSelectedAttachment] = useState<string | null>(null);

  const closeAttachment = useCallback(() => setSelectedAttachment(null), []);

  useEffect(() => {
    if (!selectedAttachment) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAttachment();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [selectedAttachment, closeAttachment]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleCopyCode = async (code: string, language: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(language);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const handleFeedback = (type: 'good' | 'bad') => {
    setFeedback(type);
    if (onFeedback) onFeedback(message.id, type);
  };

  return (
    <div className={`group w-full text-gray-900 dark:text-gray-100 animate-message-in`}>
      <div className="gap-4 md:gap-6 md:max-w-4xl lg:max-w-[56rem] xl:max-w-[68rem] p-4 md:py-1 flex lg:px-0 m-auto">
        {/* Avatar */}
        <div className="flex-shrink-0 flex flex-col relative items-end">
          <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center`}>
            {isUser ? (
              <div
                className="bg-gray-100 dark:bg-black border rounded-full w-full h-full flex items-center justify-center p-1 transition-shadow duration-300"
                style={{
                  borderColor: 'rgba(var(--neon-rgb), 0.25)',
                  boxShadow: '0 0 12px rgba(var(--neon-rgb), 0.3)',
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" style={{ filter: 'drop-shadow(0 0 3px var(--neon-color))' }}>
                  <path d="m223-120-89-481q-37 7-65.5-17T40-680q0-33 23.5-56.5T120-760q33 0 56.5 23.5T200-680q0 14-4 26t-12 22q22 13 44.5 21.5T276-602q44 0 81.5-22t58.5-60l25-46q-19-11-30-29t-11-41q0-33 23.5-56.5T480-880q33 0 56.5 23.5T560-800q0 23-11 41t-30 29l25 46q21 38 58.5 60t81.5 22q25 0 47.5-8t44.5-21q-8-10-12-22.5t-4-26.5q0-33 23.5-56.5T840-760q33 0 56.5 23.5T920-680q0 38-28.5 62T826-601l-89 481H223Zm67-80h380l60-326q-11 2-23 3.5t-23 1.5q-63 0-117-30t-87-84q-33 54-87 84t-117 30q-11 0-23-1.5t-23-3.5l60 326Zm190 0Z" fill="var(--neon-color)" />
                </svg>
              </div>
            ) : (
              <div
                className="bg-gray-100 dark:bg-black border rounded-full w-full h-full flex items-center justify-center p-1 transition-shadow duration-300"
                style={{
                  borderColor: 'rgba(var(--neon-rgb), 0.25)',
                  boxShadow: '0 0 12px rgba(var(--neon-rgb), 0.3)',
                  color: 'var(--neon-color)',
                }}
              >
                {CHATGPT_LOGO}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="relative flex-1 overflow-hidden">
          <div className="font-semibold select-none mb-1.5 text-sm opacity-90 flex items-center gap-2">
            {isUser ? (
              <span style={{ color: 'var(--neon-color)', filter: 'drop-shadow(0 0 4px rgba(var(--neon-rgb), 0.4))' }}>You</span>
            ) : (
              <span style={{ color: 'var(--neon-color)', filter: 'drop-shadow(0 0 4px rgba(var(--neon-rgb), 0.4))' }}>Ember</span>
            )}
          </div>

          {message.isThinking ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--neon-color)' }}>
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: 'var(--neon-color)',
                        boxShadow: '0 0 6px var(--neon-color)',
                        animation: `pulse-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
                <span className="font-medium">Thinking...</span>
              </div>
              {message.thinkingContent && (
                <div
                  className="prose dark:prose-invert max-w-none leading-7 text-base italic opacity-70 pl-4 border-l-2 mt-3"
                  style={{ borderColor: 'rgba(var(--neon-rgb), 0.25)' }}
                >
                  <ReactMarkdown>{message.thinkingContent}</ReactMarkdown>
                </div>
              )}
            </div>
          ) : (
            <div>
              {message.attachments && message.attachments.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {message.attachments.map((att, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedAttachment(att.data)}
                      className="relative group/att rounded-lg overflow-hidden border transition-all duration-200 hover:scale-[1.02]"
                      style={{
                        borderColor: 'rgba(var(--neon-rgb), 0.2)',
                        boxShadow: '0 0 8px rgba(var(--neon-rgb), 0.1)',
                      }}
                    >
                      <img
                        src={att.data}
                        alt={att.name}
                        className="max-h-40 max-w-[280px] object-contain"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm px-2 py-1 opacity-0 group-hover/att:opacity-100 transition-opacity">
                        <span className="text-[10px] text-white truncate block">{att.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedAttachment && createPortal(
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
                  style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
                  onClick={closeAttachment}
                >
                  <button
                    onClick={closeAttachment}
                    className="absolute top-4 right-4 z-50 p-2 rounded-full transition-all duration-200 hover:scale-110"
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: 'white',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                  <img
                    src={selectedAttachment}
                    alt="Full size preview"
                    className="max-w-[92vw] max-h-[92vh] object-contain rounded-lg"
                    style={{
                      boxShadow: '0 0 40px rgba(var(--neon-rgb), 0.3), 0 0 80px rgba(var(--neon-rgb), 0.1)',
                      border: '1px solid rgba(var(--neon-rgb), 0.2)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>,
                document.body
              )}

            <div className="prose dark:prose-invert max-w-none leading-8 break-words [&>p]:mb-4 [&>ul]:my-4 [&>ul]:space-y-2 [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:pl-0 [&>ol]:my-4 [&>ol]:space-y-2 [&>ol]:list-decimal [&>ol]:ml-10 [&>ol]:pl-0 [&>ul>li]:mb-2 [&>ul>li]:list-item [&>ul>li]:ml-0 [&>ol>li]:mb-2 [&>ol>li]:list-item [&>ol>li]:ml-0 [&>li>ul]:list-disc [&>li>ul]:ml-6 [&>li>ul]:mt-2 [&>li>ul]:pl-0 [&>li>ul>li]:list-item [&>li>ul>li]:ml-0 [&>li>ol]:list-decimal [&>li>ol]:ml-10 [&>li>ol]:mt-2 [&>li>ol]:pl-0 [&>li>ol>li]:list-item [&>li>ol>li]:ml-0 [&>pre]:my-4 [&>blockquote]:my-4 [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:mb-4 [&>h1]:mt-6 [&>h2]:text-2xl [&>h2]:font-semibold [&>h2]:mb-3 [&>h2]:mt-5 [&>h3]:text-xl [&>h3]:font-medium [&>h3]:mb-3 [&>h3]:mt-4 [&>table]:my-4 [&>table]:border-collapse [&>table]:w-full [&>table]:text-sm [&>thead]:bg-gray-50/80 [&>thead]:dark:bg-white/[0.03] [&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:font-semibold [&>th]:text-xs [&>th]:uppercase [&>th]:tracking-wider [&>td]:px-4 [&>td]:py-3 [&>tr]:border-b [&>tr]:border-gray-200/60 [&>tr]:dark:border-white/[0.06]">
              {/* Collapsible reasoning section */}
              {message.thinkingContent && !message.isThinking && (
                <div className="mb-4">
                  <button
                    onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors w-full text-left group"
                  >
                    <svg
                      className={`w-3 h-3 transition-transform duration-200 ${isThinkingExpanded ? 'rotate-90' : ''}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: 'rgba(var(--neon-rgb), 0.6)' }}>Reasoning</span>
                  </button>
                  {isThinkingExpanded && (
                    <div className="mt-2 prose dark:prose-invert max-w-none leading-7 text-base italic opacity-60 pl-4 border-l-2" style={{ borderColor: 'rgba(var(--neon-rgb), 0.2)' }}>
                      <ReactMarkdown>{message.thinkingContent}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}

              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  pre: ({ node, children, ...props }) => {
                    const getCodeString = (c: any): string => {
                      if (typeof c === 'string') return c;
                      if (c?.props?.children) {
                        const ch = c.props.children;
                        if (Array.isArray(ch)) return ch.map(getCodeString).join('');
                        return getCodeString(ch);
                      }
                      return '';
                    };
                    const codeString = getCodeString(children).replace(/\n$/, '');
                    const lines = codeString.split('\n');
                    const arrowRe = /\s*(?:→|->|-->)\s*/g;
                    const hasWorkflow = lines.some(l => (l.match(arrowRe) || []).length >= 2);
                    const hasWinPath = /(?:[A-Z]:\\)/i.test(codeString) && codeString.split('\n').length <= 8;

                    if (hasWorkflow) {
                      const wfLine = lines.find(l => (l.match(arrowRe) || []).length >= 2) || codeString;
                      const steps = wfLine.split(/\s*(?:→|->|-->)\s*/).filter((s: string) => s.trim());
                      return (
                        <div className="my-5 flex flex-wrap items-center gap-2">
                          {steps.map((step: string, idx: number) => (
                            <React.Fragment key={idx}>
                              <div
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 hover:scale-[1.02]"
                                style={{
                                  borderColor: 'rgba(var(--neon-rgb), 0.2)',
                                  background: 'rgba(var(--neon-rgb), 0.05)',
                                  color: isDark ? 'rgba(var(--neon-rgb), 0.9)' : 'rgba(var(--neon-rgb), 0.8)',
                                }}
                              >
                                <span
                                  className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
                                  style={{ background: 'rgba(var(--neon-rgb), 0.15)', color: 'var(--neon-color)' }}
                                >
                                  {idx + 1}
                                </span>
                                <span>{step.trim()}</span>
                              </div>
                              {idx < steps.length - 1 && (
                                <svg className="w-4 h-4 flex-shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="var(--neon-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      );
                    }

                    if (hasWinPath) {
                      return (
                        <div className="my-4 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(var(--neon-rgb), 0.2)' }}>
                          <div className="flex items-center justify-between px-4 py-2" style={{ background: isDark ? 'rgba(var(--neon-rgb), 0.06)' : 'rgba(var(--neon-rgb), 0.04)' }}>
                            <span className="text-xs font-mono font-medium" style={{ color: 'var(--neon-color)' }}>Path</span>
                            <button
                              onClick={() => handleCopyCode(codeString, 'path')}
                              className={`flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded transition-all duration-200 ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/[0.08]' : 'text-gray-500 hover:text-gray-900 hover:bg-black/[0.08]'}`}
                              title="Copy path"
                            >
                              {copiedCode === 'path' ? <Check size={12} style={{ color: 'var(--neon-color)' }} /> : <Copy size={12} />}
                            </button>
                          </div>
                          <div className="px-4 py-3" style={{ background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.02)' }}>
                            {lines.map((line: string, i: number) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-gray-400 dark:text-gray-600 select-none text-xs w-4 text-right flex-shrink-0">{i + 1}</span>
                                <code
                                  className="text-sm break-all"
                                  style={{
                                    fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
                                    color: isDark ? '#89b4fa' : '#1e66f5',
                                  }}
                                >
                                  {line}
                                </code>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        className="relative my-6 mt-10 rounded-lg overflow-hidden transition-all duration-300"
                        style={{
                          border: '1px solid rgba(var(--neon-rgb), 0.4)',
                          boxShadow: '0 0 15px rgba(var(--neon-rgb), 0.15), 0 0 30px rgba(var(--neon-rgb), 0.05)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(var(--neon-rgb), 0.25), 0 0 40px rgba(var(--neon-rgb), 0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 15px rgba(var(--neon-rgb), 0.15), 0 0 30px rgba(var(--neon-rgb), 0.05)'; }}
                      >
                        <pre {...props} className="neon-code-block-container">{children}</pre>
                      </div>
                    );
                  },
                  code: ({ node, className, children, ...props }: any) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    const codeString = String(children).replace(/\n$/, '');
                    const isBlock = !match ? codeString.includes('\n') : true;
                    const isCopied = copiedCode === language || (!language && copiedCode === 'text');

                    const headerBg = isDark ? 'bg-[#000000]/95' : 'bg-[#dce0e8]/95';
                    const headerBtnClass = isDark
                      ? 'text-gray-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06] hover:border-white/[0.12]'
                      : 'text-gray-500 hover:text-gray-900 bg-black/[0.04] hover:bg-black/[0.08] border-black/[0.06] hover:border-black/[0.12]';
                    const blockBg = isDark ? '#1e1e2e' : '#eff1f5';
                    const codeTheme = isDark ? catppuccinMocha : catppuccinLatte;
                    const displayLanguage = language || 'text';

                    if (isBlock && language) {
                      return (
                        <>
                          <div className={`absolute -top-0 left-0 right-0 h-10 flex items-center justify-between px-4 ${headerBg} backdrop-blur-sm`}>
                            <span className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--neon-color)' }}>
                              {language}
                            </span>
                            <button
                              onClick={() => handleCopyCode(codeString, language)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-lg transition-all duration-200 ${headerBtnClass}`}
                              title="Copy code"
                            >
                              {isCopied ? (
                                <>
                                  <Check size={13} style={{ color: 'var(--neon-color)' }} />
                                  <span style={{ color: 'var(--neon-color)' }}>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={13} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                          <SyntaxHighlighter
                            language={language}
                            style={codeTheme}
                            customStyle={{
                              margin: 0,
                              padding: '1rem',
                              paddingTop: '1.5rem',
                              background: blockBg,
                              fontSize: 'var(--app-font-size, 15px)',
                              borderRadius: '0.5rem',
                              fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
                            }}
                            codeTagProps={{
                              style: {
                                fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
                              }
                            }}
                          >
                            {codeString}
                          </SyntaxHighlighter>
                        </>
                      );
                    }

                    if (isBlock) {
                      return (
                        <>
                          <div className={`absolute -top-0 left-0 right-0 h-10 flex items-center justify-between px-4 ${headerBg} backdrop-blur-sm`}>
                            <span className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--neon-color)' }}>
                              text
                            </span>
                            <button
                              onClick={() => handleCopyCode(codeString, 'text')}
                              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-lg transition-all duration-200 ${headerBtnClass}`}
                              title="Copy code"
                            >
                              {isCopied ? (
                                <>
                                  <Check size={13} style={{ color: 'var(--neon-color)' }} />
                                  <span style={{ color: 'var(--neon-color)' }}>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={13} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                          <pre
                            style={{
                              margin: 0,
                              padding: '1rem',
                              paddingTop: '1.5rem',
                              background: blockBg,
                              fontSize: 'var(--app-font-size, 15px)',
                              borderRadius: '0.5rem',
                              fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
                              color: isDark ? '#cdd6f4' : '#4c4f69',
                              overflow: 'auto',
                            }}
                          >
                            <code style={{ fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace' }}>{codeString}</code>
                          </pre>
                        </>
                      );
                    }

                    return <code className={className} {...props}>{children}</code>;
                  },
                  table: ({ node, ...props }) => (
                    <div className="my-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-white/[0.08]" style={{ borderColor: 'rgba(var(--neon-rgb), 0.12)' }}>
                      <table className="w-full text-sm border-collapse" {...props} />
                    </div>
                  ),
                  thead: ({ node, ...props }) => (
                    <thead className="bg-gray-50 dark:bg-white/[0.03]" {...props} />
                  ),
                  tbody: ({ node, ...props }) => (
                    <tbody className="divide-y divide-gray-200 dark:divide-white/[0.06]" {...props} />
                  ),
                  tr: ({ node, ...props }) => (
                    <tr className="border-b border-gray-200 dark:border-white/[0.06] last:border-0 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors" {...props} />
                  ),
                  th: ({ node, ...props }) => (
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap" {...props} />
                  ),
                  td: ({ node, ...props }) => (
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap" {...props} />
                  ),
                  p: ({ node, children, ...props }) => {
                    const getTextContent = (node: any): string => {
                      if (typeof node === 'string') return node;
                      if (typeof node === 'number') return String(node);
                      if (node?.props?.children) {
                        const c = node.props.children;
                        if (Array.isArray(c)) return c.map(getTextContent).join('');
                        return getTextContent(c);
                      }
                      return '';
                    };
                    const text = getTextContent({ props: { children } });
                    const arrowMatch = text.match(/\s*(?:→|->|-->)\s*/g);
                    if (arrowMatch && arrowMatch.length >= 2) {
                      const steps = text.split(/\s*(?:→|->|-->)\s*/).filter((s: string) => s.trim());
                      return (
                        <div className="my-5 flex flex-wrap items-center gap-2">
                          {steps.map((step: string, idx: number) => (
                            <React.Fragment key={idx}>
                              <div
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 hover:scale-[1.02]"
                                style={{
                                  borderColor: 'rgba(var(--neon-rgb), 0.2)',
                                  background: 'rgba(var(--neon-rgb), 0.05)',
                                  color: isDark ? 'rgba(var(--neon-rgb), 0.9)' : 'rgba(var(--neon-rgb), 0.8)',
                                }}
                              >
                                <span
                                  className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
                                  style={{
                                    background: 'rgba(var(--neon-rgb), 0.15)',
                                    color: 'var(--neon-color)',
                                  }}
                                >
                                  {idx + 1}
                                </span>
                                <span>{step.trim()}</span>
                              </div>
                              {idx < steps.length - 1 && (
                                <svg
                                  className="w-4 h-4 flex-shrink-0 opacity-50"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="var(--neon-color)"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      );
                    }
                    return <p {...props}>{children}</p>;
                  },
                }}
              >
                {preprocessMarkdown(message.content)}
              </ReactMarkdown>

              {!isUser && !message.isThinking && (
                <>
                  {/* Search citations */}
                  {message.annotations && message.annotations.length > 0 && (
                    <div className="mt-5 mb-3">
                      <button
                        onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
                        className="flex items-center gap-2 w-full text-left group/sources"
                      >
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200"
                          style={{
                            borderColor: 'rgba(var(--neon-rgb), 0.2)',
                            background: 'rgba(var(--neon-rgb), 0.04)',
                          }}
                        >
                          <Search size={13} style={{ color: 'var(--neon-color)' }} />
                          <span className="text-xs font-semibold" style={{ color: 'var(--neon-color)' }}>
                            {message.annotations.filter(a => a.type === 'url_citation').length} source{message.annotations.filter(a => a.type === 'url_citation').length !== 1 ? 's' : ''} found
                          </span>
                          <ChevronDown
                            size={13}
                            className={`transition-transform duration-200 ${isSourcesExpanded ? 'rotate-180' : ''}`}
                            style={{ color: 'var(--neon-color)' }}
                          />
                        </div>
                      </button>

                      {isSourcesExpanded && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {message.annotations
                            .filter((a) => a.type === 'url_citation')
                            .map((annotation, idx) => (
                              <a
                                key={idx}
                                href={annotation.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 hover:scale-[1.01]"
                                style={{
                                  borderColor: 'rgba(var(--neon-rgb), 0.08)',
                                  background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.25)';
                                  e.currentTarget.style.background = isDark ? 'rgba(var(--neon-rgb), 0.04)' : 'rgba(var(--neon-rgb), 0.03)';
                                  e.currentTarget.style.boxShadow = '0 0 12px rgba(var(--neon-rgb), 0.08)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.08)';
                                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                              >
                                <div
                                  className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold mt-0.5"
                                  style={{
                                    background: 'rgba(var(--neon-rgb), 0.12)',
                                    color: 'var(--neon-color)',
                                  }}
                                >
                                  {idx + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors line-clamp-2 leading-relaxed">
                                    {annotation.title || annotation.url}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    {annotation.logo_url ? (
                                      <img src={annotation.logo_url} alt="" className="w-3 h-3 rounded-sm flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    ) : (
                                      <Globe size={10} className="text-gray-400 flex-shrink-0" />
                                    )}
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                                      {annotation.site_name || new URL(annotation.url).hostname.replace('www.', '')}
                                    </span>
                                    {annotation.publish_time && (
                                      <>
                                        <span className="text-[10px] text-gray-300 dark:text-gray-600">&middot;</span>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                                          {annotation.publish_time}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  {annotation.summary && (
                                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2 leading-relaxed opacity-80">
                                      {annotation.summary}
                                    </div>
                                  )}
                                </div>
                                <ExternalLink size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-400 flex-shrink-0 mt-1 transition-colors" />
                              </a>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Token usage */}
                  {message.usageMetadata && (
                    <div className="text-xs text-gray-600 dark:text-white mt-3 flex items-center gap-3 opacity-70">
                      <span title="Total tokens used">
                        <span className="font-bold" style={{ color: 'var(--neon-color)' }}>
                          {message.usageMetadata.totalTokens.toLocaleString()}
                        </span>
                        {' '}tokens
                      </span>
                      {message.usageMetadata.promptTokens > 0 && (
                        <span title="Input tokens" className="font-semibold" style={{ color: 'var(--neon-color)' }}>
                          ({message.usageMetadata.promptTokens.toLocaleString()} in
                          {message.usageMetadata.candidatesTokens > 0 && `, ${message.usageMetadata.candidatesTokens.toLocaleString()} out`})
                        </span>
                      )}
                    </div>
                  )}
                  {/* Action buttons */}
                  <div className="flex items-center gap-1 mt-3 pb-2 mb-2 text-gray-500 opacity-0 group-hover:opacity-100 hover:!opacity-100 transition-all duration-300">
                    <button
                      onClick={handleCopyMessage}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all duration-200"
                      title={copiedMessage ? "Copied!" : "Copy message"}
                      style={{ color: copiedMessage ? 'var(--neon-color)' : undefined }}
                    >
                      {copiedMessage ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                    <button
                      onClick={() => handleFeedback('good')}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all duration-200"
                      title="Good response"
                      style={{ color: feedback === 'good' ? 'var(--neon-color)' : undefined }}
                    >
                      <ThumbsUp size={15} />
                    </button>
                    <button
                      onClick={() => handleFeedback('bad')}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all duration-200"
                      title="Bad response"
                      style={{ color: feedback === 'bad' ? 'var(--neon-color)' : undefined }}
                    >
                      <ThumbsDown size={15} />
                    </button>
                    <button
                      onClick={() => onRegenerate?.(message.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all duration-200"
                      title="Regenerate response"
                    >
                      <RefreshCw size={15} />
                    </button>
                  </div>
                </>
              )}
            </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
