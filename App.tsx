import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { PanelLeft, SquarePen, ArrowLeft, Layers, Download, Code, Eye, RotateCcw, Copy, Check } from 'lucide-react';
import { PromptInputBox } from './components/PromptInputBox';
import { CHATGPT_LOGO, DEFAULT_MODELS, NEON_PRESETS, INDIVIDUAL_COLORS } from './constants';
import { Role, Message, ModelConfig, ChatSession, getModelType, Attachment, Mode, StitchProject, ConversationType } from './types';
import { generateResponseStream, generateChatTitle } from './services/apiService';
import * as db from './services/databaseAdapter';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import ModelSelect from './components/ModelSelect';
import Settings from './components/Settings';
import TokenUsageStats from './components/TokenUsageStats';
import ModeSelector from './components/ModeSelector';
import Notification, { NotificationType } from './components/Notification';
import TTSPanel from './components/TTSPanel';
import VoiceDesignPanel from './components/VoiceDesignPanel';
import VoiceClonePanel from './components/VoiceClonePanel';
import ASRPanel from './components/ASRPanel';
import PluginAgentPanel from './components/PluginAgentPanel';
import RAGChatPanel from './components/RAGChatPanel';
import AgentChatPanel from './components/AgentChatPanel';
import StitchPanel from './components/StitchPanel';
import { StitchControls } from './components/StitchEditor';
import patternBg from './assets/pattern-bg.png';

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

export const FONT_SIZE_MAP: Record<string, number> = { xs: 16, sm: 17, base: 18, lg: 20, xl: 22 };

export const FONT_FAMILY_MAP: Record<string, string> = {
  default: "'Fredoka', 'Comfortaa', 'Google Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, Cantarell, 'Noto Sans', sans-serif",
  fredoka: "'Fredoka', sans-serif",
  comfortaa: "'Comfortaa', sans-serif",
  'google-sans': "'Google Sans', sans-serif",
};

const RequireAuth: React.FC<{ isAuth: boolean; children: React.ReactNode }> = ({ isAuth, children }) => {
  if (!isAuth) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isSelector = location.pathname === '/';
  const isChatMode = location.pathname.startsWith('/chat');
  const isExperimentsMode = location.pathname.startsWith('/experiments');
  const currentMode: Mode = isSelector ? 'selector' : isChatMode ? 'chat' : 'experiments';
  const activeView: 'chat' | 'rag' | 'plugin-agent' | 'stitch' = (() => {
    if (isChatMode) return 'chat';
    if (location.pathname.includes('/plugin-agent')) return 'plugin-agent';
    if (location.pathname.includes('/stitch')) return 'stitch';
    return 'rag';
  })();

  const stitchProjectId = (() => {
    const match = location.pathname.match(/^\/experiments\/stitch\/([^/]+)$/);
    return match ? match[1] : undefined;
  })();

  const [isChatAuthenticated, setIsChatAuthenticated] = useState(() => {
    return !!sessionStorage.getItem('edward:labs_chat_session');
  });
  const [isExperimentsAuthenticated, setIsExperimentsAuthenticated] = useState(() => {
    return !!sessionStorage.getItem('edward:labs_experiments_session');
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTokenStatsOpen, setIsTokenStatsOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [fontSize, setFontSize] = useState<string>(() => {
    return localStorage.getItem('edward:labs_fontSize') || 'base';
  });
  const [fontFamily, setFontFamily] = useState<string>(() => {
    return localStorage.getItem('edward:labs_fontFamily') || 'default';
  });
  const [neonColor, setNeonColor] = useState<string>(() => {
    return localStorage.getItem('neonColor') || 'red';
  });
  const [neonPreset, setNeonPreset] = useState<string>(() => {
    return localStorage.getItem('neonPreset') || 'cyber';
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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [stitchActiveProject, setStitchActiveProject] = useState<StitchProject | null>(null);
  const [stitchControls, setStitchControls] = useState<StitchControls | null>(null);
  const [stitchResetKey, setStitchResetKey] = useState(0);
  const [experimentConversationId, setExperimentConversationId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const modelType = getModelType(currentModelId);
  const selectedModelConfig = models.find(m => m.id === currentModelId) || models[0];

  const filteredConversations = isChatMode
    ? conversations.filter(c => !c.type || c.type === 'chat')
    : isExperimentsMode
      ? conversations.filter(c => c.type === activeView)
      : conversations;

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

    fetch('/api/health').then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }).catch(() => {
      setNotification({ message: 'Backend server is not reachable. Chat, TTS, and ASR will not work.', type: 'error' });
    });
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
    const isDark = theme === 'dark';
    const mode = isDark ? 'dark' : 'light';

    if (neonPreset) {
      const preset = NEON_PRESETS.find(p => p.id === neonPreset) || NEON_PRESETS[0];
      root.style.setProperty('--neon-rgb', preset.primary[mode].rgb);
      root.style.setProperty('--neon-color', preset.primary[mode].tailwind);
      root.style.setProperty('--neon-secondary-rgb', preset.secondary[mode].rgb);
      root.style.setProperty('--neon-secondary', preset.secondary[mode].tailwind);
      root.style.setProperty('--neon-accent-rgb', preset.accent[mode].rgb);
      root.style.setProperty('--neon-accent', preset.accent[mode].tailwind);
    } else {
      const color = INDIVIDUAL_COLORS[neonColor] || INDIVIDUAL_COLORS.red;
      const variant = color[mode];
      root.style.setProperty('--neon-rgb', variant.rgb);
      root.style.setProperty('--neon-color', variant.tailwind);
      root.style.setProperty('--neon-secondary-rgb', variant.rgb);
      root.style.setProperty('--neon-secondary', variant.tailwind);
      root.style.setProperty('--neon-accent-rgb', variant.rgb);
      root.style.setProperty('--neon-accent', variant.tailwind);
    }

    localStorage.setItem('neonPreset', neonPreset);
    localStorage.setItem('neonColor', neonColor);
  }, [neonColor, neonPreset, theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-size', `${FONT_SIZE_MAP[fontSize] || 15}px`);
    localStorage.setItem('edward:labs_fontSize', fontSize);
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-family', FONT_FAMILY_MAP[fontFamily] || FONT_FAMILY_MAP.default);
    localStorage.setItem('edward:labs_fontFamily', fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    if (maxOutputTokens) {
      localStorage.setItem('maxOutputTokens', maxOutputTokens.toString());
    } else {
      localStorage.removeItem('maxOutputTokens');
    }
  }, [maxOutputTokens]);

  useEffect(() => {
    if (location.pathname.startsWith('/experiments/stitch')) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

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
    if (isExperimentsMode) {
      setExperimentConversationId(null);
      navigate(`/experiments/${activeView}`);
    } else {
      navigate('/chat');
    }
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
      modelId: conv.model_id,
      type: (conv.type || 'chat') as ConversationType,
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

  const ensureConversation = async (type: ConversationType = 'chat'): Promise<number> => {
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
    
    const newConversationId = await db.createConversation(dbModel!.model_id!, null, type);
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

    if (messages.length === 0 && isChatMode) {
      navigate(`/chat/${conversationId}`);
    }

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
          setMessages(prev => {
            const msg = prev.find(m => m.id === aiMessageId);
            if (msg && !msg.content && !msg.thinkingContent) {
              return prev.filter(m => m.id !== aiMessageId);
            }
            return prev.map(m => {
                if (m.id === aiMessageId) {
                    return { ...m, isThinking: false };
                }
                return m;
            });
          });
        } else {
          console.error("Generation error:", error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          const isQuota = errorMsg.toLowerCase().includes('quota');
          const isNoImageEndpoint = errorMsg.includes('No endpoints found that support image input');
          const isWebSearchDisabled = errorMsg.includes('webSearchEnabled is false');
          const isThinkingDisabled = errorMsg.includes('thinking');
          if (isWebSearchDisabled) {
            setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
            setNotification({ message: 'Web Search is not enabled. Activate the Web Search Plugin in your MiMo Console → Plugin Management.', type: 'error' });
          } else if (isThinkingDisabled && options?.think) {
            setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
            setNotification({ message: 'Deep Thinking is not available for this model or account.', type: 'error' });
          } else if (isNoImageEndpoint) {
            setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
            setNotification({ message: 'This model does not support image input. Try a different model or remove the image.', type: 'error' });
          } else if (isQuota) {
            setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
            setNotification({ message: 'Quota Exhausted: Your API quota has been reached. Please wait for it to reset or switch to a different model/API key in Settings.', type: 'error' });
          } else {
            const displayMsg = `**Error:** ${errorMsg}`;
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
        setMessages(prev => {
          const msg = prev.find(m => m.id === aiMessageId);
          if (msg && !msg.content && !msg.thinkingContent) {
            return prev.filter(m => m.id !== aiMessageId);
          }
          return prev.map(m => {
            if (m.id === aiMessageId) {
              return { ...m, isThinking: false };
            }
            return m;
          });
        });
      } else {
        console.error("Regeneration error:", error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const isQuota = errorMsg.toLowerCase().includes('quota');
        const isNoImageEndpoint = errorMsg.includes('No endpoints found that support image input');
        const isWebSearchDisabled = errorMsg.includes('webSearchEnabled is false');
        if (isWebSearchDisabled) {
          setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
          setNotification({ message: 'Web Search is not enabled. Activate the Web Search Plugin in your MiMo Console → Plugin Management.', type: 'error' });
        } else if (isNoImageEndpoint) {
          setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
          setNotification({ message: 'This model does not support image input. Try a different model or remove the image.', type: 'error' });
        } else if (isQuota) {
          setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
          setNotification({ message: 'Quota Exhausted: Your API quota has been reached. Please wait for it to reset or switch to a different model/API key in Settings.', type: 'error' });
        } else {
          const displayMsg = `**Error:** ${errorMsg}`;
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

  const handleReattach = useCallback((data: string, name: string, mimeType: string) => {
    const base64ToBlob = (base64: string, mime: string) => {
      const byteString = atob(base64.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      return new Blob([ab], { type: mime });
    };
    const blob = base64ToBlob(data, mimeType);
    const ext = mimeType.split('/')[1] || 'png';
    const fileName = name || `image-${Date.now()}.${ext}`;
    const file = new File([blob], fileName, { type: mimeType });
    setPendingFiles(prev => [...prev, file]);
    setNotification({ message: `Image attached to input`, type: 'success' });
  }, []);

  useEffect(() => {
    const match = location.pathname.match(/^\/chat\/(\d+)$/);
    if (match) {
      const convId = parseInt(match[1], 10);
      if (convId !== currentConversationId) {
        loadConversation(convId);
      }
    } else if (location.pathname === '/chat') {
      if (currentConversationId !== null) {
        setMessages([]);
        setInput('');
        setIsStreaming(false);
        setCurrentConversationId(null);
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    const ragMatch = location.pathname.match(/^\/experiments\/rag\/(\d+)$/);
    if (ragMatch) {
      const convId = parseInt(ragMatch[1], 10);
      if (convId !== experimentConversationId) {
        setExperimentConversationId(convId);
      }
      return;
    }

    const agentMatch = location.pathname.match(/^\/experiments\/plugin-agent\/(\d+)$/);
    if (agentMatch) {
      const convId = parseInt(agentMatch[1], 10);
      if (convId !== experimentConversationId) {
        setExperimentConversationId(convId);
      }
      return;
    }

    if (
      location.pathname === '/experiments/rag' ||
      location.pathname === '/experiments/plugin-agent'
    ) {
      if (experimentConversationId !== null) {
        setExperimentConversationId(null);
      }
    }
  }, [location.pathname]);

  if (isSelector) {
    return (
      <ModeSelector
        isChatAuthenticated={isChatAuthenticated}
        isExperimentsAuthenticated={isExperimentsAuthenticated}
        onSelectChat={() => navigate('/chat')}
        onSelectExperiments={() => navigate('/experiments')}
        onUnlockChat={() => {
          setIsChatAuthenticated(true);
          sessionStorage.setItem('edward:labs_chat_session', 'true');
        }}
        onUnlockExperiments={() => {
          setIsExperimentsAuthenticated(true);
          sessionStorage.setItem('edward:labs_experiments_session', 'true');
        }}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-100)', color: 'var(--text-100)' }}>
      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(false)}
        onNewChat={handleNewChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTokenStats={() => setIsTokenStatsOpen(true)}
        conversations={filteredConversations}
        currentConversationId={currentConversationId}
        onSelectConversation={async (id) => {
          const conv = conversations.find(c => c.dbConversationId === id);
          if (conv?.type && conv.type !== 'chat') {
            setExperimentConversationId(id);
            navigate(`/experiments/${conv.type}/${id}`);
          } else {
            await loadConversation(id);
            navigate(`/chat/${id}`);
          }
        }}
        onDeleteConversation={async (id) => {
          await db.deleteConversation(id);
          if (currentConversationId === id) handleNewChat();
          await loadConversations();
        }}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        currentModelName={selectedModelConfig.name}
      />

      <main className="flex-1 flex flex-col h-full relative min-w-0 transition-all duration-300" style={{ backgroundColor: 'var(--bg-100)' }}>
        {/* Top bar */}
        <div className="flex items-center p-2 md:p-4 sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-100)' }}>
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 mr-2 rounded-lg transition-all duration-200"
              style={{ color: 'var(--text-500)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-300)'; e.currentTarget.style.color = 'var(--text-100)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-500)'; }}
            >
              <PanelLeft size={20} />
            </button>
          )}
          {location.pathname.startsWith('/experiments/stitch') && stitchControls ? (
            <>
              <button
                onClick={() => { setStitchActiveProject(null); navigate('/experiments/stitch'); }}
                className="p-2 rounded-lg transition-all duration-150"
                style={{ color: 'var(--text-500)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-300)'; e.currentTarget.style.color = 'var(--text-100)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-500)'; }}
              >
                <ArrowLeft size={18} />
              </button>
              <div className="flex items-center gap-2">
                <Layers size={16} style={{ color: 'var(--neon-color)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>{stitchControls.projectTitle}</span>
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: 'rgba(var(--neon-rgb), 0.1)',
                    color: 'var(--neon-color)',
                    border: '1px solid rgba(var(--neon-rgb), 0.2)',
                  }}
                >
                  {stitchControls.layout || '16:9'}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {stitchControls.hasHtml && (
                  <button
                    onClick={stitchControls.onViewModeToggle}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      backgroundColor: 'var(--bg-200)',
                      color: 'var(--text-300)',
                      border: '1px solid var(--border-300)',
                    }}
                  >
                    {stitchControls.viewMode === 'preview' ? <Code size={12} /> : <Eye size={12} />}
                    {stitchControls.viewMode === 'preview' ? 'Source' : 'Preview'}
                  </button>
                )}
                {!stitchControls.isGenerating && stitchControls.hasLastPrompt && (
                  <button
                    onClick={stitchControls.onRegenerate}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      backgroundColor: 'var(--bg-200)',
                      color: 'var(--text-300)',
                      border: '1px solid var(--border-300)',
                    }}
                  >
                    <RotateCcw size={12} />
                    Regenerate
                  </button>
                )}
                {stitchControls.isGenerating && (
                  <button
                    onClick={stitchControls.onStopGeneration}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      backgroundColor: 'rgba(239,68,68,0.15)',
                      color: '#f87171',
                      border: '1px solid rgba(239,68,68,0.3)',
                    }}
                  >
                    Stop
                  </button>
                )}
                {stitchControls.hasHtml && !stitchControls.isGenerating && (
                  <>
                    <button
                      onClick={stitchControls.onExport}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        backgroundColor: 'var(--bg-200)',
                        color: 'var(--text-300)',
                        border: '1px solid var(--border-300)',
                      }}
                    >
                      <Download size={12} />
                      HTML
                    </button>
                    <button
                      onClick={stitchControls.onCopy}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        backgroundColor: 'rgba(var(--neon-rgb), 0.15)',
                        color: 'var(--neon-color)',
                        border: '1px solid rgba(var(--neon-rgb), 0.3)',
                      }}
                    >
                      {stitchControls.copied ? <Check size={12} /> : <Copy size={12} />}
                      {stitchControls.copied ? 'Copied' : 'Copy'}
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="hidden md:flex items-center gap-3">
                <ModelSelect currentModel={currentModelId} models={models} onSelect={handleSelectModel} theme={theme} />
              </div>
              <div className="flex items-center gap-2 md:hidden">
                <span className="font-semibold text-sm" style={{ color: 'var(--text-300)' }}>edward:labs</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleNewChat}
                  className="md:hidden p-2 rounded-lg transition-colors"
                  style={{ color: 'var(--text-500)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-300)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <SquarePen size={18} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto relative scroll-smooth" id="scroll-container">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${patternBg})`,
              backgroundSize: '400px',
              backgroundRepeat: 'repeat',
              opacity: 0.3,
              filter: 'grayscale(1)',
            }}
          />
          <Routes>
            <Route path="/chat" element={
              <RequireAuth isAuth={isChatAuthenticated}>
                {modelType === 'chat' ? (
                  messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center pb-48">
                      <div className="relative mb-8">
                        <div className="scale-150" style={{ color: 'var(--text-300)' }}>{CHATGPT_LOGO}</div>
                      </div>
                      <h2
                        className="text-2xl md:text-3xl font-semibold mb-8"
                        style={{ color: 'var(--text-100)' }}
                      >
                        How can I help you today?
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl mb-12">
                        {['Create a cyberpunk story', 'Explain quantum entanglement', 'Debug my React hook', 'Neon color palette ideas'].map((suggestion, i) => (
                          <button
                            key={i}
                            onClick={() => setInput(suggestion)}
                            className="group rounded-xl p-4 text-left transition-all duration-200"
                            style={{
                              backgroundColor: 'var(--bg-200)',
                              border: '1px solid var(--border-300)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--bg-300)';
                              e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.12)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--bg-200)';
                              e.currentTarget.style.borderColor = 'var(--border-300)';
                            }}
                          >
                            <span className="text-base" style={{ color: 'var(--text-500)' }}>{suggestion}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="pb-10 mb-52">
                      {messages.map((msg) => (
                        <ChatMessage key={msg.id} message={msg} onRegenerate={handleRegenerate} onFeedback={handleFeedback} onReattach={handleReattach} isStreaming={isStreaming && msg.id === messages[messages.length - 1]?.id} />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )
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
              </RequireAuth>
            } />
            <Route path="/chat/:conversationId" element={
              <RequireAuth isAuth={isChatAuthenticated}>
                {modelType === 'chat' ? (
                  messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center pb-48">
                      <div className="relative mb-8">
                        <div className="scale-150" style={{ color: 'var(--text-300)' }}>{CHATGPT_LOGO}</div>
                      </div>
                      <h2
                        className="text-2xl md:text-3xl font-semibold mb-8"
                        style={{ color: 'var(--text-100)' }}
                      >
                        How can I help you today?
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl mb-12">
                        {['Create a cyberpunk story', 'Explain quantum entanglement', 'Debug my React hook', 'Neon color palette ideas'].map((suggestion, i) => (
                          <button
                            key={i}
                            onClick={() => setInput(suggestion)}
                            className="group rounded-xl p-4 text-left transition-all duration-200"
                            style={{
                              backgroundColor: 'var(--bg-200)',
                              border: '1px solid var(--border-300)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--bg-300)';
                              e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.12)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--bg-200)';
                              e.currentTarget.style.borderColor = 'var(--border-300)';
                            }}
                          >
                            <span className="text-base" style={{ color: 'var(--text-500)' }}>{suggestion}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="pb-10 mb-52">
                      {messages.map((msg) => (
                        <ChatMessage key={msg.id} message={msg} onRegenerate={handleRegenerate} onFeedback={handleFeedback} onReattach={handleReattach} isStreaming={isStreaming && msg.id === messages[messages.length - 1]?.id} />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )
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
              </RequireAuth>
            } />
            <Route path="/experiments" element={<Navigate to="/experiments/rag" replace />} />
            <Route path="/experiments/rag" element={
              <RequireAuth isAuth={isExperimentsAuthenticated}>
                <div className="h-full relative">
                  <RAGChatPanel
                    theme={theme}
                    modelConfig={selectedModelConfig}
                    models={models}
                    onNotification={(msg, type) => setNotification({ message: msg, type })}
                    conversationId={experimentConversationId}
                    onConversationChange={setExperimentConversationId}
                  />
                </div>
              </RequireAuth>
            } />
            <Route path="/experiments/rag/:conversationId" element={
              <RequireAuth isAuth={isExperimentsAuthenticated}>
                <div className="h-full relative">
                  <RAGChatPanel
                    theme={theme}
                    modelConfig={selectedModelConfig}
                    models={models}
                    onNotification={(msg, type) => setNotification({ message: msg, type })}
                    conversationId={experimentConversationId}
                    onConversationChange={setExperimentConversationId}
                  />
                </div>
              </RequireAuth>
            } />
            <Route path="/experiments/plugin-agent" element={
              <RequireAuth isAuth={isExperimentsAuthenticated}>
                <div className="h-full relative">
                  <AgentChatPanel
                    theme={theme}
                    modelConfig={selectedModelConfig}
                    models={models}
                    onNotification={(msg, type) => setNotification({ message: msg, type })}
                    conversationId={experimentConversationId}
                    onConversationChange={setExperimentConversationId}
                  />
                </div>
              </RequireAuth>
            } />
            <Route path="/experiments/plugin-agent/:conversationId" element={
              <RequireAuth isAuth={isExperimentsAuthenticated}>
                <div className="h-full relative">
                  <AgentChatPanel
                    theme={theme}
                    modelConfig={selectedModelConfig}
                    models={models}
                    onNotification={(msg, type) => setNotification({ message: msg, type })}
                    conversationId={experimentConversationId}
                    onConversationChange={setExperimentConversationId}
                  />
                </div>
              </RequireAuth>
            } />
            <Route path="/experiments/stitch" element={
              <RequireAuth isAuth={isExperimentsAuthenticated}>
                <div className={`h-full overflow-auto ${stitchActiveProject ? 'p-0' : 'p-6'}`}>
                  <StitchPanel
                    key={stitchResetKey}
                    theme={theme}
                    onNotification={(msg, type) => setNotification({ message: msg, type })}
                    modelConfig={selectedModelConfig}
                    models={models}
                    onProjectChange={(project) => {
                      setStitchActiveProject(project);
                      if (project) {
                        navigate(`/experiments/stitch/${project.id}`, { replace: true });
                      } else {
                        navigate('/experiments/stitch', { replace: true });
                      }
                    }}
                    onControlsChange={setStitchControls}
                  />
                </div>
              </RequireAuth>
            } />
            <Route path="/experiments/stitch/:projectId" element={
              <RequireAuth isAuth={isExperimentsAuthenticated}>
                <div className="h-full overflow-auto p-0">
                  <StitchPanel
                    key={stitchResetKey}
                    theme={theme}
                    onNotification={(msg, type) => setNotification({ message: msg, type })}
                    modelConfig={selectedModelConfig}
                    models={models}
                    initialProjectId={stitchProjectId}
                    onProjectChange={(project) => {
                      setStitchActiveProject(project);
                      if (project) {
                        navigate(`/experiments/stitch/${project.id}`, { replace: true });
                      } else {
                        navigate('/experiments/stitch', { replace: true });
                      }
                    }}
                    onControlsChange={setStitchControls}
                  />
                </div>
              </RequireAuth>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        {/* Input Area — chat mode only */}
        {modelType === 'chat' && isChatMode && (
          <div
            className="absolute bottom-0 left-0 w-full pt-20 pb-6 px-4"
            style={{
              background: `linear-gradient(to top, var(--bg-100) 50%, transparent)`,
            }}
          >
            <div className="max-w-3xl mx-auto w-full">
              <PromptInputBox
                onSend={handleSendMessage}
                isLoading={isStreaming}
                onStop={handleStopGeneration}
                placeholder="Message edward:labs..."
                theme={theme}
                externalFiles={pendingFiles}
                onExternalFilesConsumed={() => setPendingFiles([])}
              />
              <div className="text-center mt-3">
                <p className="text-xs" style={{ color: 'rgba(122,122,122,0.6)' }}>
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
          onChangeNeonColor={(color) => { setNeonColor(color); setNeonPreset(''); }}
          neonPreset={neonPreset}
          onChangeNeonPreset={(preset) => { setNeonPreset(preset); }}
          models={models}
          onAddModel={handleAddModel}
          onDeleteModel={handleDeleteModel}
          defaultModelId={defaultModelId}
          onChangeDefaultModel={handleChangeDefaultModel}
          maxOutputTokens={maxOutputTokens}
          onChangeMaxOutputTokens={setMaxOutputTokens}
          fontSize={fontSize}
          onChangeFontSize={setFontSize}
          fontFamily={fontFamily}
          onChangeFontFamily={setFontFamily}
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
