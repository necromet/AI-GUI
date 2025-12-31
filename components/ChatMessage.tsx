import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Role, Message } from '../types';
import { CHATGPT_LOGO, USER_AVATAR } from '../constants';
import { Copy, ThumbsUp, ThumbsDown, RefreshCw, Check, ExternalLink } from 'lucide-react';
import type { Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Catppuccin Mocha theme for syntax highlighting
const catppuccinMocha = {
  'code[class*="language-"]': {
    color: '#cdd6f4',
    background: '#1e1e2e',
    textShadow: 'none',
    fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
    fontSize: '1.05rem',
    lineHeight: '1.5',
  },
  'pre[class*="language-"]': {
    color: '#cdd6f4',
    background: '#1e1e2e',
    textShadow: 'none',
    fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
    fontSize: '1.05rem',
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
  'namespace': { opacity: '0.7' },
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
  
  // Print out the real message
  console.log('Message:', message);

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
    if (onFeedback) {
      onFeedback(message.id, type);
    }
  };

  const handleRegenerate = () => {
    if (onRegenerate) {
      onRegenerate(message.id);
    }
  };

  return (
    <div className={`group w-full text-gray-100 ${isUser ? 'bg-transparent' : 'bg-transparent'}`}>
      <div className="text-xl gap-4 md:gap-6 md:max-w-4xl lg:max-w-[56rem] xl:max-w-[68rem] p-4 md:py-1 flex lg:px-0 m-auto">
        {/* Avatar Column */}
        <div className="flex-shrink-0 flex flex-col relative items-end">
          <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center ${isUser ? '' : 'shadow-[0_0_15px_rgba(0,243,255,0.2)]'}`}>
            {isUser ? (
              <div className="bg-black border rounded-full w-full h-full flex items-center justify-center p-1" style={{ borderColor: 'rgba(var(--neon-rgb), 0.3)', boxShadow: '0 0 10px rgba(var(--neon-rgb), 0.4)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" style={{ filter: 'drop-shadow(0 0 3px var(--neon-color))' }}>
                  <path d="m223-120-89-481q-37 7-65.5-17T40-680q0-33 23.5-56.5T120-760q33 0 56.5 23.5T200-680q0 14-4 26t-12 22q22 13 44.5 21.5T276-602q44 0 81.5-22t58.5-60l25-46q-19-11-30-29t-11-41q0-33 23.5-56.5T480-880q33 0 56.5 23.5T560-800q0 23-11 41t-30 29l25 46q21 38 58.5 60t81.5 22q25 0 47.5-8t44.5-21q-8-10-12-22.5t-4-26.5q0-33 23.5-56.5T840-760q33 0 56.5 23.5T920-680q0 38-28.5 62T826-601l-89 481H223Zm67-80h380l60-326q-11 2-23 3.5t-23 1.5q-63 0-117-30t-87-84q-33 54-87 84t-117 30q-11 0-23-1.5t-23-3.5l60 326Zm190 0Z" fill="var(--neon-color)" />
                </svg>
              </div>
            ) : (
              <div className="bg-black border rounded-full w-full h-full flex items-center justify-center p-1" style={{ borderColor: 'rgba(var(--neon-rgb), 0.3)', boxShadow: '0 0 10px rgba(var(--neon-rgb), 0.4)' }}>
                 {CHATGPT_LOGO}
              </div>
            )}
          </div>
        </div>

        {/* Content Column */}
        <div className="relative flex-1 overflow-hidden">
          <div className="font-semibold select-none mb-1 text-sm opacity-90 flex items-center gap-2">
            {isUser ? (
                <span className="text-white">You</span>
            ) : (
                <span style={{ color: 'var(--neon-color)', filter: 'drop-shadow(0 0 5px rgba(var(--neon-rgb), 0.5))' }}>Ember</span>
            )}
          </div>

          {/* Display images if present */}
          {message.images && message.images.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {message.images.map((image) => (
                <div key={image.id} className="relative group/img">
                  <img 
                    src={`data:${image.mimeType};base64,${image.data}`}
                    alt="Attached image"
                    className="max-w-xs max-h-60 rounded-lg border border-gray-600 dark:border-white/20 hover:border-gray-400 dark:hover:border-white/40 transition-all cursor-pointer"
                    onClick={(e) => {
                      // Open image in new tab on click
                      const win = window.open();
                      if (win) {
                        win.document.write(`<img src="data:${image.mimeType};base64,${image.data}" style="max-width:100%; height:auto;" />`);
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Show loading animation while generating image, then show 'Image has been generated!' when done */}
          {message.isGeneratingImage ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--neon-color)' }}>
                <div className="flex items-center gap-1.5 animate-pulse">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--neon-color)', boxShadow: '0 0 5px var(--neon-color)' }}></div>
                  <div className="w-2 h-2 rounded-full animation-delay-200" style={{ backgroundColor: 'var(--neon-color)', opacity: 0.7, boxShadow: '0 0 5px var(--neon-color)' }}></div>
                  <div className="w-2 h-2 rounded-full animation-delay-400" style={{ backgroundColor: 'var(--neon-color)', boxShadow: '0 0 5px var(--neon-color)' }}></div>
                </div>
                <span className="font-medium">Generating image{message.imageGenerationProgress !== undefined && `... ${message.imageGenerationProgress}%`}</span>
              </div>
              <div className="w-full max-w-md bg-gray-700/30 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-300" 
                  style={{ 
                    width: `${message.imageGenerationProgress || 0}%`,
                    backgroundColor: 'var(--neon-color)',
                    boxShadow: '0 0 10px var(--neon-color)'
                  }}
                />
              </div>
            </div>
          ) : (message.images && message.images.length > 0 && !message.isGeneratingImage) ? (
            <div className="font-semibold mb-4" style={{ color: 'var(--neon-color)' }}>Image has been generated!</div>
          ) : message.isThinking ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--neon-color)' }}>
                <div className="flex items-center gap-1.5 animate-pulse">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--neon-color)', boxShadow: '0 0 5px var(--neon-color)' }}></div>
                  <div className="w-2 h-2 rounded-full animation-delay-200" style={{ backgroundColor: 'var(--neon-color)', opacity: 0.7, boxShadow: '0 0 5px var(--neon-color)' }}></div>
                  <div className="w-2 h-2 rounded-full animation-delay-400" style={{ backgroundColor: 'var(--neon-color)', boxShadow: '0 0 5px var(--neon-color)' }}></div>
                </div>
                <span className="font-medium">Thinking...</span>
              </div>
              {message.thinkingContent && (
                <div className="prose prose-invert max-w-none leading-7 text-base italic opacity-80 pl-4 border-l-2 mt-3" style={{ borderColor: 'rgba(var(--neon-rgb), 0.3)' }}>
                  <ReactMarkdown>
                    {message.thinkingContent}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          ) : (
            <div className="prose prose-invert max-w-none leading-8 break-words text-lg [&>p]:mb-4 [&>ul]:my-4 [&>ul]:space-y-2 [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:pl-0 [&>ol]:my-4 [&>ol]:space-y-2 [&>ol]:list-decimal [&>ol]:ml-10 [&>ol]:pl-0 [&>ul>li]:mb-2 [&>ul>li]:list-item [&>ul>li]:ml-0 [&>ol>li]:mb-2 [&>ol>li]:list-item [&>ol>li]:ml-0 [&>li>ul]:list-disc [&>li>ul]:ml-6 [&>li>ul]:mt-2 [&>li>ul]:pl-0 [&>li>ul>li]:list-item [&>li>ul>li]:ml-0 [&>li>ol]:list-decimal [&>li>ol]:ml-10 [&>li>ol]:mt-2 [&>li>ol]:pl-0 [&>li>ol>li]:list-item [&>li>ol>li]:ml-0 [&>pre]:my-4 [&>blockquote]:my-4 [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:mb-4 [&>h1]:mt-6 [&>h2]:text-2xl [&>h2]:font-semibold [&>h2]:mb-3 [&>h2]:mt-5 [&>h3]:text-xl [&>h3]:font-medium [&>h3]:mb-3 [&>h3]:mt-4">
              <ReactMarkdown
                components={{
                  pre: ({ node, ...props }) => (
                    <div 
                      className="relative my-6 mt-10 rounded-lg overflow-hidden" 
                      style={{ 
                        border: '1px solid var(--neon-color)',
                        boxShadow: '0 0 10px rgba(var(--neon-rgb), 0.3), 0 0 20px rgba(var(--neon-rgb), 0.15)',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(var(--neon-rgb), 0.4), 0 0 30px rgba(var(--neon-rgb), 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(var(--neon-rgb), 0.3), 0 0 20px rgba(var(--neon-rgb), 0.15)';
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
                          <div className="absolute -top-0 left-0 right-0 h-10 flex items-center justify-between px-4 bg-[#000000]/95 backdrop-blur-sm" style={{ borderColor: 'rgba(var(--neon-rgb), 1)' }}>
                            <span className="text-xs font-mono uppercase tracking-wider" style={{ color: 'rgba(var(--neon-rgb), 1)' }}>
                              {language}
                            </span>
                            <button
                              onClick={() => handleCopyCode(codeString, language)}
                              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-all"
                              style={{ borderColor: isCopied ? 'rgba(var(--neon-rgb), 0.5)' : undefined }}
                              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.5)'}
                              onMouseLeave={(e) => !isCopied && (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)')}
                              title="Copy code"
                            >
                              {isCopied ? (
                                <>
                                  <Check size={13} />
                                  <span>Copied</span>
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
                              fontSize: '1.05rem',
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
              
              {/* Display grounding sources if present */}
              {!isUser && message.groundingMetadata && (
                <div className="mt-4 pt-4 border-t border-gray-700/50">
                  <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                    <ExternalLink size={12} />
                    <span>Sources from Google Search:</span>
                  </div>
                  <div className="space-y-2">
                    {message.groundingMetadata.searchResults?.map((result: any, idx: number) => (
                      <a
                        key={idx}
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all group/link"
                        style={{ borderColor: 'rgba(var(--neon-rgb), 0.2)' }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.5)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.2)'}
                      >
                        <div className="flex items-start gap-2">
                          <ExternalLink size={14} className="mt-0.5 text-gray-400 group-hover/link:text-gray-300" />
                          <div className="flex-1 min-w-0">
                            {result.title && (
                              <div className="text-sm font-medium text-gray-200 group-hover/link:text-white truncate">
                                {result.title}
                              </div>
                            )}
                            {result.snippet && (
                              <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                                {result.snippet}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mt-1 truncate">
                              {result.url}
                            </div>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                  {message.groundingMetadata.webSearchQueries && message.groundingMetadata.webSearchQueries.length > 0 && (
                    <div className="mt-3 text-xs text-gray-500">
                      Search queries: {message.groundingMetadata.webSearchQueries.join(', ')}
                    </div>
                  )}
                </div>
              )}
              
              {!isUser && !message.isThinking && !message.isGeneratingImage && (
                <div className="flex items-center gap-2 mt-2 pb-2 mb-2 text-gray-500 opacity-0 group-hover:opacity-100 hover:!opacity-100 transition-opacity duration-200">
                  <button 
                    onClick={handleCopyMessage}
                    className="p-1.5 rounded hover:bg-white/5 transition-colors" 
                    title={copiedMessage ? "Copied!" : "Copy message"} 
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--neon-color)'} 
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    {copiedMessage ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                  <button 
                    onClick={() => handleFeedback('good')}
                    className="p-1.5 rounded hover:bg-white/5 transition-colors" 
                    title="Good response" 
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--neon-color)'} 
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                    style={{ color: feedback === 'good' ? 'var(--neon-color)' : '' }}
                  >
                    <ThumbsUp size={16} />
                  </button>
                  <button 
                    onClick={() => handleFeedback('bad')}
                    className="p-1.5 rounded hover:bg-white/5 transition-colors" 
                    title="Bad response" 
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--neon-color)'} 
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                    style={{ color: feedback === 'bad' ? 'var(--neon-color)' : '' }}
                  >
                    <ThumbsDown size={16} />
                  </button>
                  <button 
                    onClick={handleRegenerate}
                    className="p-1.5 rounded hover:bg-white/5 transition-colors" 
                    title="Regenerate response" 
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--neon-color)'} 
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;