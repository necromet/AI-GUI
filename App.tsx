import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PanelLeft, SquarePen, ArrowUp, Paperclip } from 'lucide-react';
import { CHATGPT_LOGO, DEFAULT_MODELS } from './constants';
import { Role, Message, GeminiModel, ModelConfig, ChatSession } from './types';
import { generateResponseStream } from './services/geminiService';
import * as db from './services/databaseAdapter';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import ModelSelect from './components/ModelSelect';
import Settings from './components/Settings';
import DatabaseViewer from './components/DatabaseViewer';
import Notification, { NotificationType } from './components/Notification';

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  
  // State for Settings and Models
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDatabaseViewerOpen, setIsDatabaseViewerOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [neonColor, setNeonColor] = useState<string>(() => {
    return localStorage.getItem('neonColor') || 'red';
  });
  const [models, setModels] = useState<ModelConfig[]>(DEFAULT_MODELS);
  const [currentModelId, setCurrentModelId] = useState<string>(DEFAULT_MODELS[0].id);
  
  // Database-backed conversation state
  const [conversations, setConversations] = useState<ChatSession[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);

  // Notification state
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize database and load conversations and models
  useEffect(() => {
    const initDb = async () => {
      try {
        await db.getDatabase(); // Initialize database
        await loadConversations();
        await loadModels();
      } catch (error) {
        console.error('Database initialization error:', error);
      }
    };
    initDb();
  }, []);

  // Theme Effect
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Neon Color Effect
  useEffect(() => {
    const root = document.documentElement;
    const colorMap: Record<string, { rgb: string; tailwind: string }> = {
      red: { rgb: '248, 113, 113', tailwind: 'rgb(248, 113, 113)' },
      orange: { rgb: '251, 146, 60', tailwind: 'rgb(251, 146, 60)' },
      yellow: { rgb: '250, 204, 21', tailwind: 'rgb(250, 204, 21)' },
      lime: { rgb: '163, 230, 53', tailwind: 'rgb(163, 230, 53)' },
      green: { rgb: '74, 222, 128', tailwind: 'rgb(74, 222, 128)' },
      cyan: { rgb: '34, 211, 238', tailwind: 'rgb(34, 211, 238)' },
      blue: { rgb: '96, 165, 250', tailwind: 'rgb(96, 165, 250)' },
      indigo: { rgb: '129, 140, 248', tailwind: 'rgb(129, 140, 248)' },
      purple: { rgb: '192, 132, 252', tailwind: 'rgb(192, 132, 252)' },
      pink: { rgb: '244, 114, 182', tailwind: 'rgb(244, 114, 182)' },
      rose: { rgb: '251, 113, 133', tailwind: 'rgb(251, 113, 133)' },
      teal: { rgb: '45, 212, 191', tailwind: 'rgb(45, 212, 191)' },
    };
    const color = colorMap[neonColor] || colorMap.red;
    root.style.setProperty('--neon-rgb', color.rgb);
    root.style.setProperty('--neon-color', color.tailwind);
    localStorage.setItem('neonColor', neonColor);
  }, [neonColor]);

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
    setCurrentConversationId(null);
  };

  const loadConversations = async () => {
    const dbConversations = await db.getConversations();
    const sessions: ChatSession[] = dbConversations.map(conv => ({
      id: conv.conversation_id!.toString(),
      title: conv.title || 'New Chat',
      messages: [],
      updatedAt: new Date(conv.updated_at).getTime(),
      dbConversationId: conv.conversation_id,
      modelId: conv.model_id
    }));
    setConversations(sessions);
  };

  const loadModels = async () => {
    const dbModels = await db.getModels();
    const customModels: ModelConfig[] = dbModels
      .filter(m => m.is_custom)
      .map(m => ({
        id: m.name,
        name: m.name,
        description: m.description || 'Custom configured model',
        isReasoning: false,
        systemInstruction: m.system_instruction || undefined,
        isCustom: true,
        dbModelId: m.model_id,
        contextWindowSize: m.context_window_size || undefined,
        apiKey: m.api_key || undefined,
        provider: m.provider || undefined
      }));
    
    // Merge default models with custom models from database
    setModels([...DEFAULT_MODELS, ...customModels]);
  };

  const loadConversation = async (conversationId: number) => {
    const dbMessages = await db.getMessagesByConversation(conversationId);
    const loadedMessages: Message[] = dbMessages.map(msg => ({
      id: msg.message_id!.toString(),
      role: msg.role === 'assistant' ? Role.Assistant : Role.User,
      content: msg.content,
      timestamp: new Date(msg.timestamp).getTime(),
      messageOrder: msg.message_order,
      dbMessageId: msg.message_id
    }));
    setMessages(loadedMessages);
    setCurrentConversationId(conversationId);
  };

  const saveMessageToDb = async (conversationId: number, role: 'user' | 'assistant', content: string): Promise<number> => {
    const messageOrder = await db.getNextMessageOrder(conversationId);
    return await db.addMessage(conversationId, role, content, messageOrder);
  };

  const ensureConversation = async (): Promise<number> => {
    if (currentConversationId) {
      return currentConversationId;
    }
    
    // Get or create model in database
    let dbModel = await db.getModelByName(currentModelId);
    if (!dbModel) {
      const selectedModel = models.find(m => m.id === currentModelId);
      const modelId = await db.addModel(
        currentModelId,
        selectedModel?.description || null,
        selectedModel?.contextWindowSize || null
      );
      dbModel = await db.getModelById(modelId);
    }
    
    // Create new conversation
    const newConversationId = await db.createConversation(dbModel!.model_id!, null);
    setCurrentConversationId(newConversationId);
    await loadConversations();
    return newConversationId;
  };

  const handleAddModel = async (newModel: ModelConfig) => {
    try {
      // Save custom model to database
      const dbModelId = await db.addModel(
        newModel.id,
        newModel.description,
        newModel.contextWindowSize || null,
        newModel.apiKey || null,
        newModel.provider || null,
        newModel.systemInstruction || null,
        true // isCustom
      );
      
      // Add dbModelId to the model config
      const modelWithDbId = { ...newModel, dbModelId };
      setModels([...models, modelWithDbId]);
      
      // Show success notification
      setNotification({
        message: `Model "${newModel.name}" added successfully!`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error adding model:', error);
      // Show error notification
      setNotification({
        message: `Failed to add model "${newModel.name}". Please try again.`,
        type: 'error'
      });
    }
  };

  const handleDeleteModel = async (id: string) => {
    const model = models.find(m => m.id === id);
    
    // Deactivate in database if it has a dbModelId
    if (model?.dbModelId) {
      await db.deactivateModel(model.dbModelId);
    }
    
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

    // Ensure we have a conversation in the database
    const conversationId = await ensureConversation();

    const userMessage: Message = {
      id: generateId(),
      role: Role.User,
      content: userText,
      timestamp: Date.now(),
    };

    // Save user message to database
    const userDbMessageId = await saveMessageToDb(conversationId, 'user', userText);
    userMessage.dbMessageId = userDbMessageId;

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

        const streamResult = await generateResponseStream(
          selectedModelConfig.id, 
          userText, 
          history,
          selectedModelConfig.systemInstruction
        );

        let fullText = '';
        let aiDbMessageId: number | null = null;
        
        for await (const chunk of streamResult) {
             const chunkText = chunk.text; 
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

        // Save AI response to database
        if (fullText) {
          aiDbMessageId = await saveMessageToDb(conversationId, 'assistant', fullText);
          
          // Update conversation title if it's the first exchange
          if (messages.length === 0) {
            const title = userText.substring(0, 50) + (userText.length > 50 ? '...' : '');
            await db.updateConversationTitle(conversationId, title);
            await loadConversations();
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
        onOpenDatabase={() => setIsDatabaseViewerOpen(true)}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={loadConversation}
        onDeleteConversation={async (id) => {
          await db.deleteConversation(id);
          if (currentConversationId === id) {
            handleNewChat();
          }
          await loadConversations();
        }}
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
             <span className="font-semibold text-gray-800 dark:text-gray-200">Work Ship</span>
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
             <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-100 transition-opacity duration-500 pb-48">
                <div className="bg-white dark:bg-black border border-gray-200 p-6 rounded-full mb-6 shadow-lg transition-all w-20 h-20 flex items-center justify-center" style={{ borderColor: theme === 'dark' ? `rgba(var(--neon-rgb), 0.3)` : undefined, boxShadow: theme === 'dark' ? `0 0 30px -5px rgba(var(--neon-rgb), 0.6)` : undefined }}>
                   <div className="scale-[2]">{CHATGPT_LOGO}</div>
                </div>
                <h2 className="text-2xl md:text-3xl font-semibold mb-8 text-gray-800 dark:bg-gradient-to-r dark:from-white dark:via-gray-200 dark:to-gray-400 dark:bg-clip-text dark:text-transparent transition-colors">How can I help you today?</h2>
                
                {/* Suggestion Chips */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mb-12">
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
           <div className="max-w-4xl mx-auto w-full">
              <div className="relative flex flex-col bg-gray-50 dark:bg-input rounded-[26px] border border-gray-200 dark:border-white/10 focus-within:border-gray-300 shadow-lg overflow-hidden transition-all duration-300" style={{ borderColor: theme === 'dark' && input ? `rgba(var(--neon-rgb), 0.5)` : undefined, boxShadow: theme === 'dark' && input ? `0 0 20px -5px rgba(var(--neon-rgb), 0.2)` : undefined }}>
                 {/* Textarea Container */}
                 <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message Ember..."
                    rows={1}
                    className="w-full bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 px-4 py-3.5 pr-12 resize-none outline-none max-h-[50px] overflow-y-auto scrollbar-hidden"
                 />
                 
                 {/* Actions Row */}
                 <div className="flex items-center justify-between px-2 pb-2">
                    <div className="flex items-center gap-2">
                       <button className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-200 dark:hover:bg-white/5 rounded-full transition-colors" style={{ color: theme === 'dark' ? undefined : undefined }} onMouseEnter={(e) => theme === 'dark' && (e.currentTarget.style.color = 'var(--neon-color)')} onMouseLeave={(e) => theme === 'dark' && (e.currentTarget.style.color = '')}>
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
                  Ember can make mistakes. Check important info.
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
          neonColor={neonColor}
          onChangeNeonColor={setNeonColor}
          models={models}
          onAddModel={handleAddModel}
          onDeleteModel={handleDeleteModel}
        />

        {/* Database Viewer Modal */}
        {isDatabaseViewerOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full h-full">
              <button
                onClick={() => setIsDatabaseViewerOpen(false)}
                className="absolute top-4 right-4 z-50 px-4 py-2 bg-input hover:bg-hover neon-border rounded-lg text-white transition-colors"
              >
                Close
              </button>
              <DatabaseViewer />
            </div>
          </div>
        )}

        {/* Notification Toast */}
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}

      </main>
    </div>
  );
};

export default App;