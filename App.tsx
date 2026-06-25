import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PanelLeft, SquarePen } from 'lucide-react';
import { PromptInputBox } from './components/PromptInputBox';
import { CHATGPT_LOGO, DEFAULT_MODELS } from './constants';
import { Role, Message, ModelConfig, ChatSession, getModelType, Attachment } from './types';
import { generateResponseStream, generateChatTitle } from './services/mimoService';
import * as db from './services/databaseAdapter';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import ModelSelect from './components/ModelSelect';
import Settings from './components/Settings';
import TokenUsageStats from './components/TokenUsageStats';
import PasswordScreen from './components/PasswordScreen';
import Notification, { NotificationType } from './components/Notification';
import TTSPanel from './components/TTSPanel';
import VoiceDesignPanel from './components/VoiceDesignPanel';
import VoiceClonePanel from './components/VoiceClonePanel';
import ASRPanel from './components/ASRPanel';

const generateId = () => Math.random().toString(36).substring(2, 15);

const fileToAttachment = (file: File): Promise<Attachment> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve({
        data: e.target?.result as string,
        mimeType: file.type,
        name: file.name,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const FONT_SIZE_MAP: Record<string, number> = { xs: 14, sm: 15, base: 16, lg: 18, xl: 20 };

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!sessionStorage.getItem('edward:labs_session');
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTokenStatsOpen, setIsTokenStatsOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [fontSize, setFontSize] = useState<string>(() => {
    return localStorage.getItem('edward:labs_fontSize') || 'sm';
  });
  const [neonColor, setNeonColor] = useState<string>(() => {
    return localStorage.getItem('neonColor') || 'red';
  });
  const [maxOutputTokens, setMaxOutputTokens] = useState<number | undefined>(() => {
    const stored = localStorage.getItem('maxOutputTokens');
    if (stored) {
      const val = parseInt(stored, 10);
      return isNaN(val) || val <= 0 ? undefined : val;
    }
    return undefined;
  });
  const [models, setModels] = useState<ModelConfig[]>(DEFAULT_MODELS);
  const [defaultModelId, setDefaultModelId] = useState<string>(() => {
    return localStorage.getItem('edward:labs_defaultModel') || DEFAULT_MODELS[0].id;
  });
  const [currentModelId, setCurrentModelId] = useState<string>(() => {
    return localStorage.getItem('edward:labs_defaultModel') || DEFAULT_MODELS[0].id;
  });
  
  const [conversations, setConversations] = useState<ChatSession[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const modelType = getModelType(currentModelId);
  const selectedModelConfig = models.find(m => m.id === currentModelId) || models[0];

  useEffect(() => {
    const initDb = async () => {
      try {
        await db.getDatabase();
        await loadConversations();
        await loadModels();
      } catch (error) {
        console.error('Database initialization error:', error);
      }
    };
    initDb();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

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

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-size', `${FONT_SIZE_MAP[fontSize] || 15}px`);
    localStorage.setItem('edward:labs_fontSize', fontSize);
  }, [fontSize]);

  useEffect(() => {
    if (maxOutputTokens) {
      localStorage.setItem('maxOutputTokens', maxOutputTokens.toString());
    } else {
      localStorage.removeItem('maxOutputTokens');
    }
  }, [maxOutputTokens]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleNewChat = () => {
    setMessages([]);
    setInput('');
    setIsStreaming(false);
    setCurrentConversationId(null);
  };

  const handleSelectModel = (id: string) => {
    const newModelType = getModelType(id);
    if (newModelType !== 'chat') {
      handleNewChat();
    }
    setCurrentModelId(id);
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
    setModels([...DEFAULT_MODELS, ...customModels]);
  };

  const loadConversation = async (conversationId: number) => {
    const dbMessages = await db.getMessagesByConversation(conversationId);
    const loadedMessages: Message[] = dbMessages.map(msg => {
      let usageMetadata = undefined;
      if (msg.token_count && msg.role === 'assistant') {
        usageMetadata = {
          promptTokens: (msg as any).prompt_tokens || 0,
          candidatesTokens: (msg as any).candidates_tokens || 0,
          totalTokens: msg.token_count
        };
      }
      let annotations = undefined;
      const rawAnnotations = (msg as any).search_annotations;
      if (rawAnnotations && typeof rawAnnotations === 'string') {
        try {
          annotations = JSON.parse(rawAnnotations);
        } catch {}
      } else if (Array.isArray(rawAnnotations)) {
        annotations = rawAnnotations;
      }
      let attachments = undefined;
      const rawAttachments = (msg as any).attachments;
      if (rawAttachments && typeof rawAttachments === 'string') {
        try {
          attachments = JSON.parse(rawAttachments);
        } catch {}
      } else if (Array.isArray(rawAttachments)) {
        attachments = rawAttachments;
      }
      return {
        id: msg.message_id!.toString(),
        role: msg.role === 'assistant' ? Role.Assistant : Role.User,
        content: msg.content,
        timestamp: new Date(msg.timestamp).getTime(),
        messageOrder: msg.message_order,
        dbMessageId: msg.message_id,
        usageMetadata,
        annotations,
        attachments
      };
    });
    setMessages(loadedMessages);
    setCurrentConversationId(conversationId);
  };

  const saveMessageToDb = async (
    conversationId: number, 
    role: 'user' | 'assistant', 
    content: string, 
    tokenCount?: number | null,
    promptTokens?: number | null,
    candidatesTokens?: number | null,
    searchAnnotations?: any[] | null,
    attachmentsJson?: string | null
  ): Promise<number> => {
    const messageOrder = await db.getNextMessageOrder(conversationId);
    return await db.addMessage(conversationId, role, content, messageOrder, tokenCount, null, promptTokens, candidatesTokens, searchAnnotations, attachmentsJson);
  };

  const ensureConversation = async (): Promise<number> => {
    if (currentConversationId) return currentConversationId;
    
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
    
    const newConversationId = await db.createConversation(dbModel!.model_id!, null);
    setCurrentConversationId(newConversationId);
    await loadConversations();
    return newConversationId;
  };

  const handleAddModel = async (newModel: ModelConfig) => {
    try {
      const dbModelId = await db.addModel(
        newModel.id,
        newModel.description,
        newModel.contextWindowSize || null,
        newModel.apiKey || null,
        newModel.provider || null,
        newModel.systemInstruction || null,
        true
      );
      setModels([...models, { ...newModel, dbModelId }]);
      setNotification({ message: `Model "${newModel.name}" added!`, type: 'success' });
    } catch (error) {
      console.error('Error adding model:', error);
      setNotification({ message: `Failed to add model "${newModel.name}".`, type: 'error' });
    }
  };

  const handleDeleteModel = async (id: string) => {
    const model = models.find(m => m.id === id);
    if (model?.dbModelId) await db.deactivateModel(model.dbModelId);
    setModels(models.filter(m => m.id !== id));
    if (currentModelId === id) setCurrentModelId(models[0].id);
  };

  const handleChangeDefaultModel = (id: string) => {
    setDefaultModelId(id);
    setCurrentModelId(id);
    localStorage.setItem('edward:labs_defaultModel', id);
  };

  const handleSendMessage = async (messageText?: string, options?: { files?: File[]; search?: boolean; think?: boolean }) => {
    const userText = (messageText ?? input).trim();
    const hasFiles = options?.files && options.files.length > 0;
    if ((!userText && !hasFiles) || isStreaming) return;

    setInput('');

    const conversationId = await ensureConversation();

    let attachments: Attachment[] | undefined;
    if (hasFiles) {
      attachments = await Promise.all(options!.files!.map(fileToAttachment));
    }

    const userMessage: Message = {
      id: generateId(),
      role: Role.User,
      content: userText,
      timestamp: Date.now(),
      attachments,
    };

    const attachmentsJson = attachments && attachments.length > 0 ? JSON.stringify(attachments) : null;
    const userDbMessageId = await saveMessageToDb(conversationId, 'user', userText, null, null, null, null, attachmentsJson);
    userMessage.dbMessageId = userDbMessageId;
    setMessages(prev => [...prev, userMessage]);

    if (messages.length === 0) {
      try {
        const selectedModelConfig = models.find(m => m.id === currentModelId) || models[0];
        const titleText = userText || (attachments ? `Image: ${attachments[0].name}` : 'New Chat');
        const title = await generateChatTitle(titleText, '', selectedModelConfig.provider);
        await db.updateConversationTitle(conversationId, title);
        await loadConversations();
      } catch (error) {
        const titleText = userText || (attachments ? `Image: ${attachments[0].name}` : 'New Chat');
        const title = titleText.substring(0, 50) + (titleText.length > 50 ? '...' : '');
        await db.updateConversationTitle(conversationId, title);
        await loadConversations();
      }
    }

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

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
        const history = messages.map(m => ({ role: m.role, content: m.content, attachments: m.attachments }));
        history.push({ role: Role.User, content: userText, attachments });

        const selectedModelConfig = models.find(m => m.id === currentModelId) || models[0];

        const streamResult = await generateResponseStream(
          selectedModelConfig.apiModelId || selectedModelConfig.id,
          userText,
          history,
          selectedModelConfig.systemInstruction,
          selectedModelConfig.provider,
          3,
          selectedModelConfig.maxTokens || maxOutputTokens,
          abortController.signal,
          { search: options?.search, think: options?.think },
        );

        let fullText = '';
        let fullThinkingText = '';
        let usageMetadata: any = null;
        let searchAnnotations: any[] = [];
        
        for await (const chunk of streamResult) {
            const chunkText = chunk.text;
            const thinkingText = (chunk as any).thinkingText;
            
            const chunkUsageMetadata = (chunk as any).usageMetadata;
            if (chunkUsageMetadata) {
              usageMetadata = {
                promptTokens: chunkUsageMetadata.promptTokenCount || 0,
                candidatesTokens: chunkUsageMetadata.candidatesTokenCount || 0,
                totalTokens: chunkUsageMetadata.totalTokenCount || 0
              };
            }

            if ((chunk as any).annotations) {
              searchAnnotations.push(...(chunk as any).annotations);
              setMessages(prev => prev.map(msg => {
                  if (msg.id === aiMessageId) {
                      return { ...msg, annotations: [...searchAnnotations] };
                  }
                  return msg;
              }));
            }
            
            if (thinkingText) {
              fullThinkingText += thinkingText;
              setMessages(prev => prev.map(msg => {
                  if (msg.id === aiMessageId) {
                      return { ...msg, thinkingContent: fullThinkingText, isThinking: true };
                  }
                  return msg;
              }));
            }
            
            if (chunkText) {
              fullText += chunkText;
              setMessages(prev => prev.map(msg => {
                  if (msg.id === aiMessageId) {
                      return {
                          ...msg,
                          content: fullText,
                          thinkingContent: fullThinkingText,
                          isThinking: false,
                          usageMetadata: usageMetadata,
                          annotations: searchAnnotations.length > 0 ? searchAnnotations : undefined,
                      };
                  }
                  return msg;
              }));
            }
        }

        if (fullText) {
          await saveMessageToDb(
            conversationId, 'assistant', fullText,
            usageMetadata?.totalTokens || null,
            usageMetadata?.promptTokens || null,
            usageMetadata?.candidatesTokens || null,
            searchAnnotations.length > 0 ? searchAnnotations : null
          );
        }

    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setMessages(prev => prev.map(msg => {
              if (msg.id === aiMessageId) {
                  return { ...msg, isThinking: false };
              }
              return msg;
          }));
        } else {
          console.error("Generation error:", error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          const isQuota = errorMsg.toLowerCase().includes('quota');
          const isWebSearchDisabled = errorMsg.includes('webSearchEnabled is false');
          const isThinkingDisabled = errorMsg.includes('thinking');
          if (isWebSearchDisabled) {
            setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
            setNotification({ message: 'Web Search is not enabled. Activate the Web Search Plugin in your MiMo Console → Plugin Management.', type: 'error' });
          } else if (isThinkingDisabled && options?.think) {
            setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
            setNotification({ message: 'Deep Thinking is not available for this model or account.', type: 'error' });
          } else {
            const displayMsg = isQuota
              ? "**Quota Exhausted:** Your API quota has been reached. Please wait for it to reset or switch to a different model/API key in Settings."
              : `**Error:** ${errorMsg}`;
            setMessages(prev => prev.map(msg => {
                if (msg.id === aiMessageId) {
                    return { ...msg, content: displayMsg, isThinking: false };
                }
                return msg;
            }));
          }
        }
    } finally {
        abortControllerRef.current = null;
        setIsStreaming(false);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleRegenerate = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1 || isStreaming) return;

    let userMessageIndex = messageIndex - 1;
    while (userMessageIndex >= 0 && messages[userMessageIndex].role !== Role.User) {
      userMessageIndex--;
    }
    if (userMessageIndex < 0) return;

    const userText = messages[userMessageIndex].content;
    setMessages(prev => prev.filter(m => m.id !== messageId));

    const aiMessageId = generateId();
    const aiMessagePlaceholder: Message = {
      id: aiMessageId,
      role: Role.Assistant,
      content: '',
      isThinking: true,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, aiMessagePlaceholder]);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const conversationId = await ensureConversation();
      const history = messages.slice(0, messageIndex).map(m => ({ role: m.role, content: m.content }));
      history.push({ role: Role.User, content: userText });

      const selectedModelConfig = models.find(m => m.id === currentModelId) || models[0];

      const streamResult = await generateResponseStream(
        selectedModelConfig.apiModelId || selectedModelConfig.id,
        userText,
        history,
        selectedModelConfig.systemInstruction,
        selectedModelConfig.provider,
        3,
        selectedModelConfig.maxTokens || maxOutputTokens,
        abortController.signal,
      );

      let fullText = '';
      let fullThinkingText = '';
      let usageMetadata: any = null;
      let searchAnnotations: any[] = [];

      for await (const chunk of streamResult) {
        const chunkText = chunk.text;
        const thinkingText = (chunk as any).thinkingText;

        const chunkUsageMetadata = (chunk as any).usageMetadata;
        if (chunkUsageMetadata) {
          usageMetadata = {
            promptTokens: chunkUsageMetadata.promptTokenCount || 0,
            candidatesTokens: chunkUsageMetadata.candidatesTokenCount || 0,
            totalTokens: chunkUsageMetadata.totalTokenCount || 0
          };
        }

        if ((chunk as any).annotations) {
          searchAnnotations.push(...(chunk as any).annotations);
          setMessages(prev => prev.map(msg => {
              if (msg.id === aiMessageId) {
                  return { ...msg, annotations: [...searchAnnotations] };
              }
              return msg;
          }));
        }

        if (thinkingText) {
          fullThinkingText += thinkingText;
          setMessages(prev => prev.map(msg => {
            if (msg.id === aiMessageId) {
              return { ...msg, thinkingContent: fullThinkingText, isThinking: true };
            }
            return msg;
          }));
        }
        
        if (chunkText) {
          fullText += chunkText;
          setMessages(prev => prev.map(msg => {
            if (msg.id === aiMessageId) {
              return { ...msg, content: fullText, thinkingContent: fullThinkingText, isThinking: false, usageMetadata, annotations: searchAnnotations.length > 0 ? searchAnnotations : undefined };
            }
            return msg;
          }));
        }
      }

      if (fullText) {
        await saveMessageToDb(
          conversationId, 'assistant', fullText,
          usageMetadata?.totalTokens || null,
          usageMetadata?.promptTokens || null,
          usageMetadata?.candidatesTokens || null,
          searchAnnotations.length > 0 ? searchAnnotations : null
        );
      }

    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setMessages(prev => prev.map(msg => {
          if (msg.id === aiMessageId) {
            return { ...msg, isThinking: false };
          }
          return msg;
        }));
      } else {
        console.error("Regeneration error:", error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const isQuota = errorMsg.toLowerCase().includes('quota');
        const isWebSearchDisabled = errorMsg.includes('webSearchEnabled is false');
        if (isWebSearchDisabled) {
          setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
          setNotification({ message: 'Web Search is not enabled. Activate the Web Search Plugin in your MiMo Console → Plugin Management.', type: 'error' });
        } else {
          const displayMsg = isQuota
            ? "**Quota Exhausted:** Your API quota has been reached. Please wait for it to reset or switch to a different model/API key in Settings."
            : `**Error:** ${errorMsg}`;
          setMessages(prev => prev.map(msg => {
            if (msg.id === aiMessageId) {
              return { ...msg, content: displayMsg, isThinking: false };
            }
            return msg;
          }));
        }
      }
    } finally {
        abortControllerRef.current = null;
        setIsStreaming(false);
    }
  };

  const handleFeedback = (messageId: string, feedback: 'good' | 'bad') => {
    console.log(`Feedback for message ${messageId}: ${feedback}`);
    setNotification({
      message: `Thank you for your ${feedback === 'good' ? 'positive' : ''} feedback!`,
      type: 'success'
    });
  };

  if (!isAuthenticated) {
    return <PasswordScreen onSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="flex h-screen bg-white dark:bg-main text-gray-900 dark:text-white font-sans overflow-hidden selection:bg-neon-purple selection:text-white transition-colors duration-300" style={{ '--app-font-size': `${FONT_SIZE_MAP[fontSize] || 15}px` } as React.CSSProperties}>
      <div className={`md:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)} />

      <Sidebar 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(false)}
        onNewChat={handleNewChat}
        onOpenSettings={() => setIsSettingsOpen(true)}

        onOpenTokenStats={() => setIsTokenStatsOpen(true)}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={loadConversation}
        onDeleteConversation={async (id) => {
          await db.deleteConversation(id);
          if (currentConversationId === id) handleNewChat();
          await loadConversations();
        }}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />

       <main className="flex-1 flex flex-col h-full relative min-w-0 bg-white dark:bg-main transition-all duration-300">
        <div className="flex items-center p-2 md:p-4 sticky top-0 z-10 bg-white/80 dark:bg-main/80 backdrop-blur-md transition-colors">
           {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 mr-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-white rounded-xl transition-all duration-200">
                <PanelLeft size={22} />
              </button>
           )}
           <div className="flex items-center gap-2 md:hidden">
             <span className="font-semibold text-gray-800 dark:text-gray-200">edward:labs</span>
           </div>
           <div className="hidden md:flex items-center gap-3">
             <ModelSelect currentModel={currentModelId} models={models} onSelect={handleSelectModel} theme={theme} />
           </div>
           <div className="ml-auto flex items-center gap-2">
               <button onClick={handleNewChat} className="md:hidden p-2 text-gray-400 hover:text-gray-200 transition-colors">
                  <SquarePen size={18} />
               </button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto relative scroll-smooth" id="scroll-container">
           {modelType === 'chat' ? (
             <>
               {messages.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center p-8 text-center pb-48">
                    <div className="relative mb-10">
                      <div className="scale-[2]" style={{ color: 'var(--neon-color)', filter: 'drop-shadow(0 0 12px rgba(var(--neon-rgb), 0.4))' }}>{CHATGPT_LOGO}</div>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-semibold mb-8 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-500 dark:from-white dark:via-gray-200 dark:to-gray-400 bg-clip-text text-transparent">How can I help you today?</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl mb-12">
                       {['Create a cyberpunk story', 'Explain quantum entanglement', 'Debug my React hook', 'Neon color palette ideas'].map((suggestion, i) => (
                          <button
                            key={i}
                            onClick={() => setInput(suggestion)}
                             className="group border border-gray-300 dark:border-white/[0.06] rounded-xl p-4 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03] hover:border-gray-400 dark:hover:border-white/[0.1] transition-all duration-300 bg-transparent"
                          >
                             <span className="text-sm text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">{suggestion}</span>
                          </button>
                       ))}
                    </div>
                 </div>
               ) : (
                 <div className="pb-10 mb-52">
                    {messages.map((msg) => (
                      <ChatMessage key={msg.id} message={msg} onRegenerate={handleRegenerate} onFeedback={handleFeedback} />
                    ))}
                    <div ref={messagesEndRef} />
                 </div>
               )}
             </>
           ) : (
             <div className="h-full flex items-center justify-center p-6">
               {modelType === 'tts' ? (
                 <TTSPanel onNotification={(msg, type) => setNotification({ message: msg, type })} theme={theme} modelConfig={selectedModelConfig} />
               ) : modelType === 'tts-voicedesign' ? (
                 <VoiceDesignPanel onNotification={(msg, type) => setNotification({ message: msg, type })} theme={theme} modelConfig={selectedModelConfig} />
               ) : modelType === 'tts-voiceclone' ? (
                 <VoiceClonePanel onNotification={(msg, type) => setNotification({ message: msg, type })} theme={theme} modelConfig={selectedModelConfig} />
               ) : modelType === 'asr' ? (
                 <ASRPanel onNotification={(msg, type) => setNotification({ message: msg, type })} theme={theme} modelConfig={selectedModelConfig} />
               ) : null}
             </div>
           )}
        </div>

        {/* Input Area — chat mode only */}
        {modelType === 'chat' && (
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-white via-white dark:from-main dark:via-main to-transparent pt-20 pb-6 px-4 transition-colors">
             <div className="max-w-4xl mx-auto w-full">
                <PromptInputBox
                  onSend={handleSendMessage}
                  isLoading={isStreaming}
                  onStop={handleStopGeneration}
                  placeholder="Message edward:labs..."
                  theme={theme}
                />
                <div className="text-center mt-3">
                  <p className="text-[11px] text-gray-500/60">
                    MiMo can make mistakes. Check important information.
                  </p>
                </div>
             </div>
          </div>
        )}

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
          defaultModelId={defaultModelId}
          onChangeDefaultModel={handleChangeDefaultModel}
          maxOutputTokens={maxOutputTokens}
          onChangeMaxOutputTokens={setMaxOutputTokens}
          fontSize={fontSize}
          onChangeFontSize={setFontSize}
        />


        <TokenUsageStats isOpen={isTokenStatsOpen} onClose={() => setIsTokenStatsOpen(false)} availableModels={models} />

        {notification && (
          <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
        )}

      </main>
    </div>
  );
};

export default App;
