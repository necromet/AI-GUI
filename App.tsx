import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PanelLeft, SquarePen, ArrowUp, Paperclip } from 'lucide-react';
import { GenerateContentStreamResult } from "@google/genai";
import { CHATGPT_LOGO, DEFAULT_MODELS } from './constants';
import { Role, Message, GeminiModel, ModelConfig } from './types';
import { generateResponseStream } from './services/geminiService';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import ModelSelect from './components/ModelSelect';
import Settings from './components/Settings';

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  
  // State for Settings and Models
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [models, setModels] = useState<ModelConfig[]>(DEFAULT_MODELS);
  const [currentModelId, setCurrentModelId] = useState<string>(DEFAULT_MODELS[0].id);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Theme Effect
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

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

  const handleAddModel = (newModel: ModelConfig) => {
    setModels([...models, newModel]);
  };

  const handleDeleteModel = (id: string) => {
    setModels(models.filter(m => m.id !== id));
    if (currentModelId === id) {
      setCurrentModelId(models[0].id);
    }
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

        const selectedModelConfig = models.find(m => m.id === currentModelId) || models[0];

        const streamResult: GenerateContentStreamResult = await generateResponseStream(
          selectedModelConfig.id, 
          userText, 
          history,
          selectedModelConfig.systemInstruction
        );

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
    <div className="flex h-screen bg-main dark:bg-main text-gray-900 dark:text-white font-sans overflow-hidden selection:bg-neon-purple selection:text-white transition-colors duration-300">
      {/* Mobile Overlay for Sidebar */}
      <div className={`md:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)} />

      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(false)}
        onNewChat={handleNewChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 flex flex-col h-full relative min-w-0 bg-white dark:bg-main transition-all duration-300">
        {/* Top Bar */}
        <div className="flex items-center p-2 md:p-4 sticky top-0 z-10 bg-white/80 dark:bg-main/80 backdrop-blur transition-colors">
           {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="p-2 mr-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors"
              >
                <PanelLeft size={24} />
              </button>
           )}
           <div className="flex items-center gap-2 md:hidden">
             <span className="font-semibold text-gray-800 dark:text-gray-200">GeminiGPT</span>
           </div>
           <div className="hidden md:flex items-center gap-3">
             <ModelSelect 
               currentModel={currentModelId} 
               models={models}
               onSelect={setCurrentModelId} 
             />
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
                <div className="bg-white dark:bg-black border border-gray-200 dark:border-neon-blue/30 text-neon-blue p-4 rounded-full mb-6 shadow-lg dark:shadow-[0_0_30px_-5px_rgba(0,243,255,0.3)] transition-all">
                   <div className="scale-125">{CHATGPT_LOGO}</div>
                </div>
                <h2 className="text-2xl md:text-3xl font-semibold mb-8 text-gray-800 dark:bg-gradient-to-r dark:from-white dark:via-gray-200 dark:to-gray-400 dark:bg-clip-text dark:text-transparent transition-colors">How can I help you today?</h2>
                
                {/* Suggestion Chips */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                   {['Create a cyberpunk story', 'Explain quantum entanglement', 'Debug my React hook', 'Neon color palette ideas'].map((suggestion, i) => (
                     <button 
                        key={i}
                        onClick={() => { setInput(suggestion); if(textareaRef.current) textareaRef.current.focus(); }}
                        className="group border border-gray-200 dark:border-white/10 rounded-xl p-4 text-left hover:bg-gray-50 dark:hover:bg-white/5 dark:hover:border-neon-purple/40 hover:shadow-md dark:hover:shadow-[0_0_15px_-5px_rgba(188,19,254,0.3)] transition-all duration-300 bg-white dark:bg-transparent"
                     >
                       <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">{suggestion}</span>
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
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-white via-white dark:from-main dark:via-main to-transparent pt-20 pb-6 px-4 transition-colors">
           <div className="max-w-3xl mx-auto w-full">
              <div className="relative flex flex-col bg-gray-50 dark:bg-input rounded-[26px] border border-gray-200 dark:border-white/10 focus-within:border-gray-300 dark:focus-within:border-neon-blue/50 dark:focus-within:shadow-[0_0_20px_-5px_rgba(0,243,255,0.2)] shadow-lg overflow-hidden transition-all duration-300">
                 {/* Textarea Container */}
                 <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message Gemini..."
                    rows={1}
                    className="w-full bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 px-4 py-4 md:py-3.5 pr-12 resize-none outline-none max-h-[200px] overflow-y-auto scrollbar-hidden"
                    style={{ minHeight: '52px' }}
                 />
                 
                 {/* Actions Row */}
                 <div className="flex items-center justify-between px-2 pb-2">
                    <div className="flex items-center gap-2">
                       <button className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-neon-blue hover:bg-gray-200 dark:hover:bg-white/5 rounded-full transition-colors">
                          <Paperclip size={20} strokeWidth={1.5} />
                       </button>
                    </div>
                    <button 
                      onClick={handleSendMessage}
                      disabled={!input.trim() || isStreaming}
                      className={`p-2 rounded-full transition-all duration-200 ${input.trim() ? 'bg-black dark:bg-white text-white dark:text-black shadow-[0_0_10px_rgba(0,0,0,0.2)] dark:shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'bg-gray-200 dark:bg-[#333] text-gray-400 dark:text-[#1a1a1a] cursor-not-allowed'}`}
                    >
                      <ArrowUp size={20} strokeWidth={2.5} />
                    </button>
                 </div>
              </div>
              <div className="text-center mt-3">
                <p className="text-xs text-gray-500 dark:text-gray-600">
                  Gemini can make mistakes. Check important info.
                </p>
              </div>
           </div>
        </div>

        {/* Settings Modal */}
        <Settings 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          models={models}
          onAddModel={handleAddModel}
          onDeleteModel={handleDeleteModel}
        />

      </main>
    </div>
  );
};

export default App;