import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Role, Message } from '../types';
import { CHATGPT_LOGO } from '../constants';
import { Copy, ThumbsUp, ThumbsDown, RefreshCw, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onRegenerate, onFeedback }) => {
  const isUser = message.role === Role.User;
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [feedback, setFeedback] = useState<'good' | 'bad' | null>(null);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

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
      <div className="text-xl gap-4 md:gap-6 md:max-w-4xl lg:max-w-[56rem] xl:max-w-[68rem] p-4 md:py-1 flex lg:px-0 m-auto">
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
            <div className="prose dark:prose-invert max-w-none leading-8 break-words [&>p]:mb-4 [&>ul]:my-4 [&>ul]:space-y-2 [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:pl-0 [&>ol]:my-4 [&>ol]:space-y-2 [&>ol]:list-decimal [&>ol]:ml-10 [&>ol]:pl-0 [&>ul>li]:mb-2 [&>ul>li]:list-item [&>ul>li]:ml-0 [&>ol>li]:mb-2 [&>ol>li]:list-item [&>ol>li]:ml-0 [&>li>ul]:list-disc [&>li>ul]:ml-6 [&>li>ul]:mt-2 [&>li>ul]:pl-0 [&>li>ul>li]:list-item [&>li>ul>li]:ml-0 [&>li>ol]:list-decimal [&>li>ol]:ml-10 [&>li>ol]:mt-2 [&>li>ol]:pl-0 [&>li>ol>li]:list-item [&>li>ol>li]:ml-0 [&>pre]:my-4 [&>blockquote]:my-4 [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:mb-4 [&>h1]:mt-6 [&>h2]:text-2xl [&>h2]:font-semibold [&>h2]:mb-3 [&>h2]:mt-5 [&>h3]:text-xl [&>h3]:font-medium [&>h3]:mb-3 [&>h3]:mt-4">
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
                components={{
                  pre: ({ node, ...props }) => (
                    <div
                      className="relative my-6 mt-10 rounded-lg overflow-hidden transition-all duration-300"
                      style={{
                        border: '1px solid rgba(var(--neon-rgb), 0.4)',
                        boxShadow: '0 0 15px rgba(var(--neon-rgb), 0.15), 0 0 30px rgba(var(--neon-rgb), 0.05)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 0 20px rgba(var(--neon-rgb), 0.25), 0 0 40px rgba(var(--neon-rgb), 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(var(--neon-rgb), 0.15), 0 0 30px rgba(var(--neon-rgb), 0.05)';
                      }}
                    >
                      <pre {...props} className="neon-code-block-container" />
                    </div>
                  ),
                  code: ({ node, className, children, ...props }: any) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    const inline = !match;

                    if (!inline && language) {
                      const codeString = String(children).replace(/\n$/, '');
                      const isCopied = copiedCode === language;

                      return (
                        <>
                          <div className="absolute -top-0 left-0 right-0 h-10 flex items-center justify-between px-4 bg-[#000000]/95 backdrop-blur-sm">
                            <span className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--neon-color)' }}>
                              {language}
                            </span>
                            <button
                              onClick={() => handleCopyCode(codeString, language)}
                              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] rounded-lg transition-all duration-200"
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
                            style={catppuccinMocha}
                            customStyle={{
                              margin: 0,
                              padding: '1rem',
                              paddingTop: '1.5rem',
                              background: '#1e1e2e',
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
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        </>
                      );
                    }

                    return <code className={className} {...props}>{children}</code>;
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>

              {!isUser && !message.isThinking && (
                <>
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
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
