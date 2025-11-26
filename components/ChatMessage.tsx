import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Role, Message } from '../types';
import { CHATGPT_LOGO, USER_AVATAR } from '../constants';
import { Copy, ThumbsUp, ThumbsDown, RefreshCw, Check } from 'lucide-react';
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
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === Role.User;
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
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

  return (
    <div className={`group w-full text-gray-100 ${isUser ? 'bg-transparent' : 'bg-transparent'}`}>
      <div className="text-xl gap-4 md:gap-6 md:max-w-4xl lg:max-w-[56rem] xl:max-w-[68rem] p-4 md:py-6 flex lg:px-0 m-auto">
        
        {/* Avatar Column */}
        <div className="flex-shrink-0 flex flex-col relative items-end">
          <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center ${isUser ? '' : 'shadow-[0_0_15px_rgba(0,243,255,0.2)]'}`}>
            {isUser ? (
              <div className="w-full h-full bg-[#2f2f2f] flex items-center justify-center text-gray-300 font-semibold border border-white/10">
                U
              </div>
            ) : (
              <div className="bg-black border border-red-400/30 rounded-full w-full h-full flex items-center justify-center p-1 shadow-[0_0_10px_rgba(248,113,113,0.4)]">
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
                <span className="text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]">Gemini</span>
            )}
          </div>
          
          {message.isThinking ? (
            <div className="flex items-center gap-2 text-red-400 animate-pulse mt-1">
              <div className="w-2 h-2 bg-red-400 rounded-full shadow-[0_0_5px_#ff4444]"></div>
              <div className="w-2 h-2 bg-red-300 rounded-full shadow-[0_0_5px_#ff6666] animation-delay-200"></div>
              <div className="w-2 h-2 bg-red-400 rounded-full shadow-[0_0_5px_#ff4444] animation-delay-400"></div>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none leading-8 break-words text-lg [&>p]:mb-4 [&>ul]:my-4 [&>ul]:space-y-2 [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:pl-0 [&>ol]:my-4 [&>ol]:space-y-2 [&>ol]:list-decimal [&>ol]:ml-10 [&>ol]:pl-0 [&>ul>li]:mb-2 [&>ul>li]:list-item [&>ul>li]:ml-0 [&>ol>li]:mb-2 [&>ol>li]:list-item [&>ol>li]:ml-0 [&>li>ul]:list-disc [&>li>ul]:ml-6 [&>li>ul]:mt-2 [&>li>ul]:pl-0 [&>li>ul>li]:list-item [&>li>ul>li]:ml-0 [&>li>ol]:list-decimal [&>li>ol]:ml-10 [&>li>ol]:mt-2 [&>li>ol]:pl-0 [&>li>ol>li]:list-item [&>li>ol>li]:ml-0 [&>pre]:my-4 [&>blockquote]:my-4 [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:mb-4 [&>h1]:mt-6 [&>h2]:text-2xl [&>h2]:font-semibold [&>h2]:mb-3 [&>h2]:mt-5 [&>h3]:text-xl [&>h3]:font-medium [&>h3]:mb-3 [&>h3]:mt-4">
              <ReactMarkdown
                components={{
                  pre: ({ node, ...props }) => (
                    <div className="code-block-wrapper relative my-4 mt-8 group/code">
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
                          <div className="absolute -top-9 left-0 right-0 flex items-center justify-between px-4 py-2 rounded-t-lg bg-[#1e1e2e]/95 backdrop-blur-sm border-t border-x border-red-400/30 z-10">
                            <span className="text-xs text-red-400/80 font-mono uppercase tracking-wider">
                              {language}
                            </span>
                            <button
                              onClick={() => handleCopyCode(codeString, language)}
                              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-400/50 rounded transition-all"
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
            </div>
          )}

          {/* Message Actions (Assistant only mostly) */}
          {!isUser && !message.isThinking && (
            <div className="flex items-center gap-2 mt-2 pt-2 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
               <button className="p-1.5 hover:text-red-400 rounded hover:bg-white/5 transition-colors" title="Copy">
                 <Copy size={16} />
               </button>
               <button className="p-1.5 hover:text-red-400 rounded hover:bg-white/5 transition-colors" title="Good response">
                 <ThumbsUp size={16} />
               </button>
               <button className="p-1.5 hover:text-red-400 rounded hover:bg-white/5 transition-colors" title="Bad response">
                 <ThumbsDown size={16} />
               </button>
               <button className="p-1.5 hover:text-red-400 rounded hover:bg-white/5 transition-colors" title="Regenerate">
                 <RefreshCw size={16} />
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;