import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PanelLeft, SquarePen, ArrowUp, Paperclip } from 'lucide-react';
import { GenerateContentStreamResult } from "@google/genai";
import { CHATGPT_LOGO } from './constants';
import { Role, Message, GeminiModel } from './types';
import { generateResponseStream } from './services/geminiService';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import ModelSelect from './components/ModelSelect';

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentModel, setCurrentModel] = useState<GeminiModel>(GeminiModel.Flash);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleInputResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    handleInputResize();
  }, [input]);

  const handleNewChat = () => {
    setMessages([]);
    setInput('');
    setIsStreaming(false);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userText = input.trim();
    setInput(''); 
    if (textareaRef.current) textareaRef.current.style.height = 'auto'; 

    const userMessage: Message = {
      id: generateId(),
      role: Role.User,
      content: userText,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);

    const aiMessageId = generateId();
    const aiMessagePlaceholder: Message = {
      id: aiMessageId,
      role: Role.Assistant,
      content: '',
      isThinking: true,
      timestamp: Date.now() + 1,
    };
    setMessages(prev => [...prev, aiMessagePlaceholder]);
    setIsStreaming(true);

    try {
        const history = messages.map(m => ({ role: m.role, content: m.content }));
        history.push({ role: Role.User, content: userText });

        const streamResult: GenerateContentStreamResult = await generateResponseStream(currentModel, userText, history);

        let fullText = '';
        
        for await (const chunk of streamResult.stream) {
             const chunkText = chunk.text(); 
             if (chunkText) {
                fullText += chunkText;
                
                setMessages(prev => prev.map(msg => {
                    if (msg.id === aiMessageId) {
                        return {
                            ...msg,
                            content: fullText,
                            isThinking: false
                        };
                    }
                    return msg;
                }));
             }
        }

    } catch (error) {
        console.error("Generation error:", error);
        setMessages(prev => prev.map(msg => {
            if (msg.id === aiMessageId) {
                return {
                    ...msg,
                    content: "**Error:** Failed to generate response. Please try again.",
                    isThinking: false
                };
            }
            return msg;
        }));
    } finally {
        setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-screen bg-main text-white font-sans overflow-hidden selection:bg-neon-purple selection:text-white">
      {/* Mobile Overlay for Sidebar */}
      <div className={`md:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)} />

      {/* Sidebar now handles its own open/close animation width */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(false)}
        onNewChat={handleNewChat}
      />

      <main className="flex-1 flex flex-col h-full relative min-w-0 bg-main transition-all duration-300">
        {/* Top Bar */}
        <div className="flex items-center p-2 md:p-4 sticky top-0 z-10 bg-main/80 backdrop-blur">
           {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="p-2 mr-2 text-gray-400 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
              >
                <PanelLeft size={24} />
              </button>
           )}
           <div className="flex items-center gap-2 md:hidden">
             <span className="font-semibold text-gray-200">GeminiGPT</span>
           </div>
           <div className="hidden md:flex items-center gap-3">
             <ModelSelect currentModel={currentModel} onSelect={setCurrentModel} />
           </div>
           <div className="ml-auto flex items-center gap-2">
               <button onClick={handleNewChat} className="md:hidden p-2 text-gray-400">
                  <SquarePen size={20} />
               </button>
           </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto relative scroll-smooth custom-scrollbar" id="scroll-container">
           {messages.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-100 transition-opacity duration-500">
                <div className="bg-black border border-neon-blue/30 text-neon-blue p-4 rounded-full mb-6 shadow-[0_0_30px_-5px_rgba(0,243,255,0.3)]">
                   <div className="scale-125">{CHATGPT_LOGO}</div>
                </div>
                <h2 className="text-2xl md:text-3xl font-semibold mb-8 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">How can I help you today?</h2>
                
                {/* Suggestion Chips */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                   {['Create a cyberpunk story', 'Explain quantum entanglement', 'Debug my React hook', 'Neon color palette ideas'].map((suggestion, i) => (
                     <button 
                        key={i}
                        onClick={() => { setInput(suggestion); if(textareaRef.current) textareaRef.current.focus(); }}
                        className="group border border-white/10 rounded-xl p-4 text-left hover:bg-white/5 hover:border-neon-purple/40 hover:shadow-[0_0_15px_-5px_rgba(188,19,254,0.3)] transition-all duration-300"
                     >
                       <span className="text-sm text-gray-400 group-hover:text-gray-200 transition-colors">{suggestion}</span>
                     </button>
                   ))}
                </div>
             </div>
           ) : (
             <div className="pb-40">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
             </div>
           )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-main via-main to-transparent pt-20 pb-6 px-4">
           <div className="max-w-3xl mx-auto w-full">
              <div className="relative flex flex-col bg-input rounded-[26px] border border-white/10 focus-within:border-neon-blue/50 focus-within:shadow-[0_0_20px_-5px_rgba(0,243,255,0.2)] shadow-lg overflow-hidden transition-all duration-300">
                 {/* Textarea Container */}
                 <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message Gemini..."
                    rows={1}
                    className="w-full bg-transparent text-gray-100 placeholder-gray-500 px-4 py-4 md:py-3.5 pr-12 resize-none outline-none max-h-[200px] overflow-y-auto scrollbar-hidden"
                    style={{ minHeight: '52px' }}
                 />
                 
                 {/* Actions Row */}
                 <div className="flex items-center justify-between px-2 pb-2">
                    <div className="flex items-center gap-2">
                       <button className="p-2 text-gray-400 hover:text-neon-blue hover:bg-white/5 rounded-full transition-colors">
                          <Paperclip size={20} strokeWidth={1.5} />
                       </button>
                    </div>
                    <button 
                      onClick={handleSendMessage}
                      disabled={!input.trim() || isStreaming}
                      className={`p-2 rounded-full transition-all duration-200 ${input.trim() ? 'bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'bg-[#333] text-[#1a1a1a] cursor-not-allowed'}`}
                    >
                      <ArrowUp size={20} strokeWidth={2.5} />
                    </button>
                 </div>
              </div>
              <div className="text-center mt-3">
                <p className="text-xs text-gray-600">
                  Gemini can make mistakes. Check important info.
                </p>
              </div>
           </div>
        </div>

      </main>
    </div>
  );
};

export default App;