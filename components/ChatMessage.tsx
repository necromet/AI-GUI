import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Role, Message } from '../types';
import { CHATGPT_LOGO, USER_AVATAR } from '../constants';
import { Copy, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';
import type { Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === Role.User;
  
  // Print out the real message
  console.log('Message:', message);

  return (
    <div className={`group w-full text-gray-100 ${isUser ? 'bg-transparent' : 'bg-transparent'}`}>
      <div className="text-base gap-4 md:gap-6 md:max-w-3xl lg:max-w-[40rem] xl:max-w-[48rem] p-4 md:py-6 flex lg:px-0 m-auto">
        
        {/* Avatar Column */}
        <div className="flex-shrink-0 flex flex-col relative items-end">
          <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center ${isUser ? '' : 'shadow-[0_0_15px_rgba(0,243,255,0.2)]'}`}>
            {isUser ? (
              <div className="w-full h-full bg-[#2f2f2f] flex items-center justify-center text-gray-300 font-semibold border border-white/10">
                U
              </div>
            ) : (
              <div className="bg-black text-neon-blue border border-neon-blue/30 rounded-full w-full h-full flex items-center justify-center p-[4px]">
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
                <span className="text-neon-blue drop-shadow-[0_0_5px_rgba(0,243,255,0.5)]">Gemini</span>
            )}
          </div>
          
          {message.isThinking ? (
            <div className="flex items-center gap-2 text-neon-blue animate-pulse mt-1">
              <div className="w-2 h-2 bg-neon-blue rounded-full shadow-[0_0_5px_#00f3ff]"></div>
              <div className="w-2 h-2 bg-neon-purple rounded-full shadow-[0_0_5px_#bc13fe] animation-delay-200"></div>
              <div className="w-2 h-2 bg-neon-blue rounded-full shadow-[0_0_5px_#00f3ff] animation-delay-400"></div>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none leading-7 break-words [&>p]:mb-4 [&>ul]:my-4 [&>ul]:space-y-2 [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:pl-0 [&>ol]:my-4 [&>ol]:space-y-2 [&>ol]:list-decimal [&>ol]:ml-10 [&>ol]:pl-0 [&>ul>li]:mb-2 [&>ul>li]:list-item [&>ul>li]:ml-0 [&>ol>li]:mb-2 [&>ol>li]:list-item [&>ol>li]:ml-0 [&>li>ul]:list-disc [&>li>ul]:ml-6 [&>li>ul]:mt-2 [&>li>ul]:pl-0 [&>li>ul>li]:list-item [&>li>ul>li]:ml-0 [&>li>ol]:list-decimal [&>li>ol]:ml-10 [&>li>ol]:mt-2 [&>li>ol]:pl-0 [&>li>ol>li]:list-item [&>li>ol>li]:ml-0 [&>pre]:my-4 [&>blockquote]:my-4 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-4 [&>h1]:mt-6 [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mb-3 [&>h2]:mt-5 [&>h3]:text-lg [&>h3]:font-medium [&>h3]:mb-3 [&>h3]:mt-4">
              <ReactMarkdown
                components={{
                  pre: ({ node, ...props }) => (
                    <div className="code-block-wrapper relative my-4 mt-8">
                      <pre {...props} className="neon-code-block-container" />
                    </div>
                  ),
                  code: ({ node, className, children, ...props }: any) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    const inline = !match;
                    
                    if (!inline && language) {
                      return (
                        <>
                          <div className="absolute -top-7 right-3 text-xs text-neon-blue font-mono uppercase tracking-wider px-3 py-1.5 rounded-t-lg bg-black/80 border-t border-x border-neon-blue/50 shadow-[0_0_8px_rgba(0,243,255,0.3)] z-10">
                            {language}
                          </div>
                          <SyntaxHighlighter
                            language={language}
                            style={atomDark}
                            customStyle={{
                              margin: 0,
                              padding: '1rem',
                              paddingTop: '1.5rem',
                              background: '#363639ff',
                              fontSize: '0.875rem',
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
            <div className="flex items-center gap-2 mt-2 pt-2 text-gray-500 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity duration-200">
               <button className="p-1 hover:text-neon-blue rounded hover:bg-white/5 transition-colors" title="Copy">
                 <Copy size={14} />
               </button>
               <button className="p-1 hover:text-neon-green rounded hover:bg-white/5 transition-colors" title="Good response">
                 <ThumbsUp size={14} />
               </button>
               <button className="p-1 hover:text-red-400 rounded hover:bg-white/5 transition-colors" title="Bad response">
                 <ThumbsDown size={14} />
               </button>
               <button className="p-1 hover:text-neon-purple rounded hover:bg-white/5 transition-colors" title="Regenerate">
                 <RefreshCw size={14} />
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;