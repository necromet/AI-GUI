import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Role, Message } from '../types';
import { CHATGPT_LOGO, USER_AVATAR } from '../constants';
import { Copy, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === Role.User;

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
            <div className="prose prose-invert max-w-none leading-7 break-words">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}

          {/* Message Actions (Assistant only mostly) */}
          {!isUser && !message.isThinking && (
            <div className="flex items-center gap-2 mt-2 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
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