import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { PanelLeft, PanelRightClose, PanelRightOpen, SquarePen, ArrowLeft, Layers, Download, Code, Eye, RotateCcw, Copy, Check, Package, X } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { PromptInputBox } from './components/PromptInputBox';
import { CHATGPT_LOGO, DEFAULT_MODELS, NEON_PRESETS, INDIVIDUAL_COLORS } from './constants';
import { Role, Message, ModelConfig, ChatSession, getModelType, Attachment, Mode, StitchProject, ConversationType } from './types';
import { generateResponseStream, generateChatTitle } from './services/apiService';
import * as db from './services/apiDatabaseAdapter';
import Sidebar, { type SidebarPanel } from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import ModeSelector from './components/ModeSelector';
import { catppuccinLatte, catppuccinMocha } from './components/chat/MarkdownRenderer';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { Splitter } from '@ark-ui/react/splitter';
import TTSPanel from './components/TTSPanel';
import VoiceDesignPanel from './components/VoiceDesignPanel';
import VoiceClonePanel from './components/VoiceClonePanel';
import ASRPanel from './components/ASRPanel';
import PluginAgentPanel from './components/PluginAgentPanel';
import RAGChatPanel from './components/RAGChatPanel';
import AgentChatPanel from './components/AgentChatPanel';
import StitchPanel from './components/StitchPanel';
import LibraryPanel, { LibraryControls } from './components/LibraryPanel';
import { AgentSidebar } from './components/library/AgentSidebar';
import { StitchControls } from './components/StitchEditor';
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
  default: "'Plus Jakarta Sans', 'Google Sans', 'Open Sans', 'Fredoka', 'Comfortaa', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, Cantarell, 'Noto Sans', sans-serif",
  'plus-jakarta-sans': "'Plus Jakarta Sans', sans-serif",
  'google-sans': "'Google Sans', sans-serif",
  'open-sans': "'Open Sans', sans-serif",
  fredoka: "'Fredoka', sans-serif",
  comfortaa: "'Comfortaa', sans-serif",
};

const CHAT_SUGGESTIONS = ['Create a cyberpunk story', 'Explain quantum entanglement', 'Debug my React hook', 'Neon color palette ideas'];

interface ChatMessageListProps {
  messages: Message[];
  isStreaming: boolean;
  onRegenerate: (messageId: string) => void;
  onFeedback: (messageId: string, feedback: 'good' | 'bad') => void;
  onReattach: (data: string, name: string, mimeType: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

const ChatMessageList = React.memo(function ChatMessageList({
  messages, isStreaming, onRegenerate, onFeedback, onReattach, messagesEndRef,
}: ChatMessageListProps) {
  const lastId = messages[messages.length - 1]?.id;
  return (
    <div className="pb-10 mb-52">
      {messages.map((msg) => (
        <ChatMessage
          key={msg.id}
          message={msg}
          onRegenerate={onRegenerate}
          onFeedback={onFeedback}
          onReattach={onReattach}
          isStreaming={isStreaming && msg.id === lastId}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
});

const RequireAuth: React.FC<{ isAuth: boolean; children: React.ReactNode }> = ({ isAuth, children }) => {
  if (!isAuth) return <Navigate to="/" replace />;
  return <>{children}</>;
};

type StreamChunk = { text: string; thinkingText?: string; usageMetadata?: any; annotations?: any[] };

async function processStreamResponse(
  streamResult: AsyncIterable<StreamChunk>,
  aiMessageId: string,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  signal: AbortSignal,
) {
  let fullText = '';
  let fullThinkingText = '';
  let usageMetadata: any = null;
  let searchAnnotations: any[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;

  const flush = () => {
    if (!dirty) return;
    dirty = false;
    setMessages(prev => prev.map(msg =>
      msg.id === aiMessageId ? {
        ...msg,
        content: fullText,
        thinkingContent: fullThinkingText,
        isThinking: fullText.length === 0,
        isSearching: searchAnnotations.length > 0 && fullText.length === 0,
        usageMetadata,
        annotations: searchAnnotations.length > 0 ? searchAnnotations : undefined,
      } : msg
    ));
  };

  for await (const chunk of streamResult) {
    const chunkUsageMetadata = (chunk as any).usageMetadata;
    if (chunkUsageMetadata) {
      usageMetadata = {
        promptTokens: chunkUsageMetadata.promptTokenCount || chunkUsageMetadata.prompt_tokens || 0,
        candidatesTokens: chunkUsageMetadata.candidatesTokenCount || chunkUsageMetadata.completion_tokens || 0,
        totalTokens: chunkUsageMetadata.totalTokenCount || chunkUsageMetadata.total_tokens || 0,
      };
    }
    if ((chunk as any).annotations) {
      searchAnnotations.push(...(chunk as any).annotations);
    }
    if ((chunk as any).thinkingText) {
      fullThinkingText += (chunk as any).thinkingText;
    }
    if (chunk.text) {
      fullText += chunk.text;
    }
    dirty = true;
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
      }, 32);
    }
  }
  if (flushTimer) clearTimeout(flushTimer);
  flush();
  return { fullText, usageMetadata, searchAnnotations };
}

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isSelector = location.pathname === '/';
  const isChatMode = location.pathname.startsWith('/chat');
  const isExperimentsMode = location.pathname.startsWith('/experiments');
  const isLibraryMode = location.pathname.startsWith('/library');
  const currentMode: Mode = isSelector ? 'selector' : isChatMode ? 'chat' : isExperimentsMode ? 'experiments' : 'library';
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
  const [isLibraryAuthenticated, setIsLibraryAuthenticated] = useState(() => {
    return !!sessionStorage.getItem('edward:labs_library_session');
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [htmlFullscreenCode, setHtmlFullscreenCode] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>('none');
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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [stitchActiveProject, setStitchActiveProject] = useState<StitchProject | null>(null);
  const [stitchControls, setStitchControls] = useState<StitchControls | null>(null);
  const [libraryControls, setLibraryControls] = useState<LibraryControls | null>(null);
  const [agentDockOpen, setAgentDockOpen] = useState(() => {
    try { return localStorage.getItem('edward:labs_agentDockOpen') !== 'false'; } catch { return true; }
  });
  const toggleAgentDock = useCallback(() => {
    setAgentDockOpen(prev => {
      const next = !prev;
      try { localStorage.setItem('edward:labs_agentDockOpen', String(next)); } catch {}
      return next;
    });
  }, []);
  const handleNotification = useCallback((msg: string, type: 'success' | 'error') => {
    type === 'success' ? toast.success(msg) : toast.error(msg);
  }, []);
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
      toast.error('Backend server is not reachable. Chat, TTS, and ASR will not work.');
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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (scrollTimerRef.current) return;
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null;
      scrollToBottom();
    }, 100);
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
    };
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.code) {
        setIsSidebarOpen(false);
        setHtmlFullscreenCode(detail.code);
      }
    };
    window.addEventListener('html-fullscreen', handler);
    return () => window.removeEventListener('html-fullscreen', handler);
  }, []);

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
      id: conv.id!.toString(),
      title: conv.title || 'New Chat',
      messages: [],
      updatedAt: new Date(conv.updated_at).getTime(),
      dbConversationId: conv.id,
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
        dbModelId: m.id,
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
        id: msg.id!.toString(),
        role: msg.role === 'assistant' ? Role.Assistant : Role.User,
        content: msg.content,
        timestamp: new Date(msg.timestamp).getTime(),
        messageOrder: msg.message_order,
        dbMessageId: msg.id,
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
    
    const newConversationId = await db.createConversation(dbModel!.id!, null, type);
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
      toast.success(`Model "${newModel.name}" added!`);
    } catch (error) {
      console.error('Error adding model:', error);
      toast.error(`Failed to add model "${newModel.name}".`);
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
        const titleText = userText || (attachments ? `Image: ${attachments[0].name}` : 'New Chat');
        const title = await generateChatTitle(titleText, '', selectedModelConfig.apiModelId || selectedModelConfig.id, selectedModelConfig.provider);
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

        const streamResult = await generateResponseStream(
          selectedModelConfig.apiModelId || selectedModelConfig.id,
          userText, history, selectedModelConfig.systemInstruction,
          selectedModelConfig.provider, selectedModelConfig.maxTokens || maxOutputTokens,
          abortController.signal,
          { search: options?.search, think: options?.think },
        );

        const { fullText, usageMetadata, searchAnnotations } = await processStreamResponse(
          streamResult, aiMessageId, setMessages, abortController.signal,
        );

        if (fullText) {
          await saveMessageToDb(
            conversationId, 'assistant', fullText,
            usageMetadata?.totalTokens || null,
            usageMetadata?.promptTokens || null,
            usageMetadata?.candidatesTokens || null,
            searchAnnotations.length > 0 ? searchAnnotations : null,
          );
        }
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setMessages(prev => {
            const msg = prev.find(m => m.id === aiMessageId);
            if (msg && !msg.content && !msg.thinkingContent) return prev.filter(m => m.id !== aiMessageId);
            return prev.map(m => m.id === aiMessageId ? { ...m, isThinking: false, isSearching: false } : m);
          });
        } else {
          console.error("Generation error:", error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          handleStreamError(errorMsg, aiMessageId, setMessages, options?.think);
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

  const handleStreamError = useCallback((errorMsg: string, aiMessageId: string, setMsgs: React.Dispatch<React.SetStateAction<Message[]>>, think?: boolean) => {
    if (errorMsg.includes('webSearchEnabled is false')) {
      setMsgs(prev => prev.filter(msg => msg.id !== aiMessageId));
      toast.error('Web Search is not enabled. Activate the Web Search Plugin in your MiMo Console → Plugin Management.');
    } else if (errorMsg.includes('thinking') && think) {
      setMsgs(prev => prev.filter(msg => msg.id !== aiMessageId));
      toast.error('Deep Thinking is not available for this model or account.');
    } else if (errorMsg.includes('No endpoints found that support image input')) {
      setMsgs(prev => prev.filter(msg => msg.id !== aiMessageId));
      toast.error('This model does not support image input. Try a different model or remove the image.');
    } else if (errorMsg.toLowerCase().includes('quota')) {
      setMsgs(prev => prev.filter(msg => msg.id !== aiMessageId));
      toast.error('Quota Exhausted: Your API quota has been reached. Please wait for it to reset or switch to a different model/API key in Settings.');
    } else {
      setMsgs(prev => prev.map(msg =>
        msg.id === aiMessageId ? { ...msg, content: `**Error:** ${errorMsg}`, isThinking: false } : msg
      ));
    }
  }, []);

  const regenerateRef = useRef<((messageId: string) => Promise<void>) | null>(null);
  regenerateRef.current = async (messageId: string) => {
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

      const streamResult = await generateResponseStream(
        selectedModelConfig.apiModelId || selectedModelConfig.id,
        userText, history, selectedModelConfig.systemInstruction,
        selectedModelConfig.provider, selectedModelConfig.maxTokens || maxOutputTokens,
        abortController.signal,
      );

      const { fullText, usageMetadata, searchAnnotations } = await processStreamResponse(
        streamResult, aiMessageId, setMessages, abortController.signal,
      );

      if (fullText) {
        await saveMessageToDb(
          conversationId, 'assistant', fullText,
          usageMetadata?.totalTokens || null,
          usageMetadata?.promptTokens || null,
          usageMetadata?.candidatesTokens || null,
          searchAnnotations.length > 0 ? searchAnnotations : null,
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setMessages(prev => {
          const msg = prev.find(m => m.id === aiMessageId);
          if (msg && !msg.content && !msg.thinkingContent) return prev.filter(m => m.id !== aiMessageId);
          return prev.map(m => m.id === aiMessageId ? { ...m, isThinking: false, isSearching: false } : m);
        });
      } else {
        console.error("Regeneration error:", error);
        handleStreamError(error instanceof Error ? error.message : 'Unknown error', aiMessageId, setMessages);
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };
  const handleRegenerate = useCallback((messageId: string) => regenerateRef.current?.(messageId), []);

  const handleFeedback = useCallback((messageId: string, feedback: 'good' | 'bad') => {
    console.log(`Feedback for message ${messageId}: ${feedback}`);
    toast.success(`Thank you for your ${feedback === 'good' ? 'positive' : ''} feedback!`);
  }, []);

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
    toast.success('Image attached to input');
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

  const chatRouteElement = React.useMemo(() => {
    if (modelType !== 'chat') {
      return (
        <div className="h-full flex items-center justify-center p-6">
          {modelType === 'tts' && <TTSPanel onNotification={handleNotification} theme={theme} modelConfig={selectedModelConfig} />}
          {modelType === 'tts-voicedesign' && <VoiceDesignPanel onNotification={handleNotification} theme={theme} modelConfig={selectedModelConfig} />}
          {modelType === 'tts-voiceclone' && <VoiceClonePanel onNotification={handleNotification} theme={theme} modelConfig={selectedModelConfig} />}
          {modelType === 'asr' && <ASRPanel onNotification={handleNotification} theme={theme} modelConfig={selectedModelConfig} />}
        </div>
      );
    }
    return null;
  }, [modelType, theme, selectedModelConfig, handleNotification]);

  const RAGRouteContent = () => (
    <div className="h-full relative">
      <RAGChatPanel theme={theme} modelConfig={selectedModelConfig} models={models}
        onNotification={handleNotification} conversationId={experimentConversationId}
        onConversationChange={setExperimentConversationId} />
    </div>
  );

  const AgentRouteContent = () => (
    <div className="h-full relative">
      <AgentChatPanel theme={theme} modelConfig={selectedModelConfig} models={models}
        onNotification={handleNotification} conversationId={experimentConversationId}
        onConversationChange={setExperimentConversationId} />
    </div>
  );

  if (isSelector) {
    return (
      <ModeSelector
        isChatAuthenticated={isChatAuthenticated}
        isExperimentsAuthenticated={isExperimentsAuthenticated}
        isLibraryAuthenticated={isLibraryAuthenticated}
        onSelectChat={() => navigate('/chat')}
        onSelectExperiments={() => navigate('/experiments')}
        onSelectLibrary={() => navigate('/library')}
        onUnlockChat={() => {
          setIsChatAuthenticated(true);
          sessionStorage.setItem('edward:labs_chat_session', 'true');
        }}
        onUnlockExperiments={() => {
          setIsExperimentsAuthenticated(true);
          sessionStorage.setItem('edward:labs_experiments_session', 'true');
        }}
        onUnlockLibrary={() => {
          setIsLibraryAuthenticated(true);
          sessionStorage.setItem('edward:labs_library_session', 'true');
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
        sidebarPanel={sidebarPanel}
        onSidebarPanelChange={setSidebarPanel}
        settingsProps={{
          neonColor,
          onChangeNeonColor: (color) => { setNeonColor(color); setNeonPreset(''); },
          neonPreset,
          onChangeNeonPreset: setNeonPreset,
          models,
          onAddModel: handleAddModel,
          onDeleteModel: handleDeleteModel,
          defaultModelId,
          onChangeDefaultModel: handleChangeDefaultModel,
          maxOutputTokens,
          onChangeMaxOutputTokens: setMaxOutputTokens,
          fontSize,
          onChangeFontSize: setFontSize,
          fontFamily,
          onChangeFontFamily: setFontFamily,
        }}
        availableModels={models}
        libraryControls={libraryControls}
      />

      <main className="flex-1 flex flex-col h-full relative min-w-0 transition-all duration-300" style={{ backgroundColor: 'var(--bg-100)' }}>
        {/* Floating sidebar toggle for library mode when sidebar is closed */}
        {isLibraryMode && !libraryControls && !isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="fixed top-3 left-3 z-50 p-2 rounded-lg transition-all duration-200 cursor-pointer hover:bg-[var(--bg-100)] hover:text-[var(--text-100)] hover:border-[var(--text-500)]"
            style={{ color: 'var(--text-500)', backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}
            title="Open sidebar"
          >
            <PanelLeft size={18} />
          </button>
        )}

        {/* Top bar */}
        {(!isLibraryMode || libraryControls) && (
        <div className="flex items-center px-2 py-1.5 md:px-3 md:py-1.5 sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-100)' }}>
          {!isSidebarOpen && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(true)}
              className="mr-2 text-[var(--text-500)] hover:text-[var(--text-100)]"
            >
              <PanelLeft size={20} />
            </Button>
          )}
          {location.pathname.startsWith('/experiments/stitch') && stitchControls ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setStitchActiveProject(null); navigate('/experiments/stitch'); }}
                  className="text-[var(--text-500)] hover:text-[var(--text-100)] flex-shrink-0"
                >
                  <ArrowLeft size={18} />
                </Button>
                <div className="flex items-center gap-2 min-w-0">
                  <Layers size={16} className="flex-shrink-0" style={{ color: 'var(--neon-color)' }} />
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-100)' }}>{stitchControls.projectTitle}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] flex-shrink-0"
                    style={{
                      backgroundColor: 'rgba(var(--neon-rgb), 0.1)',
                      color: 'var(--neon-color)',
                      borderColor: 'rgba(var(--neon-rgb), 0.2)',
                    }}
                  >
                    {stitchControls.layout || '16:9'}
                  </Badge>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                {stitchControls.hasHtml && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={stitchControls.onViewModeToggle}
                    className="h-7 gap-1.5 text-xs"
                    style={{ color: 'var(--text-300)' }}
                  >
                    {stitchControls.viewMode === 'preview' ? <Code size={12} /> : <Eye size={12} />}
                    {stitchControls.viewMode === 'preview' ? 'Source' : 'Preview'}
                  </Button>
                )}
                {!stitchControls.isGenerating && stitchControls.hasLastPrompt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={stitchControls.onRegenerate}
                    className="h-7 gap-1.5 text-xs"
                    style={{ color: 'var(--text-300)' }}
                  >
                    <RotateCcw size={12} />
                    Regenerate
                  </Button>
                )}
                {stitchControls.isGenerating && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={stitchControls.onStopGeneration}
                    className="h-7 gap-1.5 text-xs"
                  >
                    Stop
                  </Button>
                )}
                <Separator orientation="vertical" className="h-5 mx-0.5" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={stitchControls.onToggleLibrary}
                  className="h-7 gap-1.5 text-xs"
                  style={{
                    color: stitchControls.isLibraryOpen ? 'var(--neon-color)' : 'var(--text-300)',
                    backgroundColor: stitchControls.isLibraryOpen ? 'rgba(var(--neon-rgb), 0.1)' : undefined,
                  }}
                >
                  <Package size={12} />
                  Library
                </Button>
                {stitchControls.hasHtml && !stitchControls.isGenerating && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={stitchControls.onExport}
                      className="h-7 gap-1.5 text-xs"
                      style={{ color: 'var(--text-300)' }}
                    >
                      <Download size={12} />
                      Export
                    </Button>
                    <Button
                      size="sm"
                      onClick={stitchControls.onCopy}
                      className="h-7 gap-1.5 text-xs"
                      style={{
                        backgroundColor: 'rgba(var(--neon-rgb), 0.15)',
                        color: 'var(--neon-color)',
                        borderColor: 'rgba(var(--neon-rgb), 0.3)',
                      }}
                    >
                      {stitchControls.copied ? <Check size={12} /> : <Copy size={12} />}
                      {stitchControls.copied ? 'Copied' : 'Copy'}
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : libraryControls ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={libraryControls.onBack}
                  className="text-[var(--text-500)] hover:text-[var(--text-100)] flex-shrink-0"
                >
                  <ArrowLeft size={18} />
                </Button>
                <div className="p-2 rounded-xl flex-shrink-0" style={{ background: 'rgba(var(--neon-rgb), 0.1)' }}>
                  <Package size={20} style={{ color: 'var(--neon-color)' }} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-100)' }}>{libraryControls.componentName}</span>
                    {libraryControls.componentTags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0.5 flex-shrink-0" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  {libraryControls.componentDescription && (
                    <span className="text-xs truncate" style={{ color: 'var(--text-500)' }}>{libraryControls.componentDescription}</span>
                  )}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleAgentDock}
                  className="text-[var(--text-500)] hover:text-[var(--text-100)]"
                  title={agentDockOpen ? 'Hide Agent' : 'Show Agent'}
                >
                  {agentDockOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                </Button>
                {libraryControls.isDirty && (
                  <Button size="sm" onClick={libraryControls.onSave} disabled={libraryControls.isSaving} style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}>
                    {libraryControls.isSaving ? 'Saving...' : 'Save'}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              {htmlFullscreenCode ? (
                <>
                  <span className="text-sm font-mono truncate flex-1" style={{ color: 'var(--text-100)', fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace' }}>HTML Preview</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => setHtmlFullscreenCode(null)} title="Close preview">
                    <X size={14} />
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 md:hidden">
                    <span className="font-semibold text-sm" style={{ color: 'var(--text-300)' }}>edward:labs</span>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleNewChat}
                      className="md:hidden text-[var(--text-500)]"
                    >
                      <SquarePen size={18} />
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        )}

        {htmlFullscreenCode ? (
          <Splitter.Root
            panels={[{ id: 'chat' }, { id: 'preview' }]}
            defaultSize={[40, 60]}
            className="flex flex-1 h-full min-h-0"
          >

            <Splitter.Panel id="chat" className="flex flex-col h-full min-h-0">
              <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ background: theme === 'dark' ? '#1a1a1a' : '#dce0e8' }}>
                <span className="text-sm font-mono" style={{ color: 'var(--text-500)', fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace' }}>html</span>
              </div>
              <div className="flex-1 overflow-auto">
                <SyntaxHighlighter
                  language="html"
                  style={theme === 'dark' ? catppuccinMocha : catppuccinLatte}
                  wrapLongLines={true}
                  customStyle={{
                    margin: 0,
                    padding: '1rem',
                    background: theme === 'dark' ? '#1e1e2e' : '#eff1f5',
                    fontSize: '12px',
                    borderRadius: 0,
                    fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
                    minHeight: '100%',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                  codeTagProps={{
                    style: { fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
                  }}
                >
                  {htmlFullscreenCode}
                </SyntaxHighlighter>
              </div>
              </div>
            </Splitter.Panel>
            <Splitter.ResizeTrigger id="chat:preview" className="rounded-full transition-colors duration-200 outline-none bg-[var(--border-300)] min-w-1.5 my-4" />
            <Splitter.Panel id="preview" className="flex flex-col h-full">
              <div className="flex-1">
                <iframe srcDoc={htmlFullscreenCode} sandbox="allow-scripts" className="w-full h-full border-0" title="HTML Preview Fullscreen" />
              </div>
            </Splitter.Panel>
          </Splitter.Root>
        ) : (
          <>
            {/* Content area */}
            <div className="flex-1 overflow-y-auto relative scroll-smooth" id="scroll-container">
              <Routes>
                <Route path="/chat" element={
                  <RequireAuth isAuth={isChatAuthenticated}>
                    {chatRouteElement || (messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-8 text-center pb-48">
                        <div className="relative mb-8">
                          <div className="scale-150" style={{ color: 'var(--text-300)' }}>{CHATGPT_LOGO}</div>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-semibold mb-8" style={{ color: 'var(--text-100)' }}>
                          How can I help you today?
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl mb-12">
                          {CHAT_SUGGESTIONS.map((suggestion, i) => (
                            <Card key={i} onClick={() => setInput(suggestion)}
                              className="group cursor-pointer p-4 text-left transition-all duration-200 hover:bg-[var(--bg-300)] hover:border-[rgba(var(--neon-rgb),0.12)] bg-[var(--bg-200)] border-[var(--border-300)]">
                              <span className="text-base" style={{ color: 'var(--text-500)' }}>{suggestion}</span>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <ChatMessageList
                        messages={messages}
                        isStreaming={isStreaming}
                        onRegenerate={handleRegenerate}
                        onFeedback={handleFeedback}
                        onReattach={handleReattach}
                        messagesEndRef={messagesEndRef}
                      />
                    ))}
                  </RequireAuth>
                } />
                <Route path="/chat/:conversationId" element={
                  <RequireAuth isAuth={isChatAuthenticated}>
                    {chatRouteElement || (messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-8 text-center pb-48">
                        <div className="relative mb-8">
                          <div className="scale-150" style={{ color: 'var(--text-300)' }}>{CHATGPT_LOGO}</div>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-semibold mb-8" style={{ color: 'var(--text-100)' }}>
                          How can I help you today?
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl mb-12">
                          {CHAT_SUGGESTIONS.map((suggestion, i) => (
                            <Card key={i} onClick={() => setInput(suggestion)}
                              className="group cursor-pointer p-4 text-left transition-all duration-200 hover:bg-[var(--bg-300)] hover:border-[rgba(var(--neon-rgb),0.12)] bg-[var(--bg-200)] border-[var(--border-300)]">
                              <span className="text-base" style={{ color: 'var(--text-500)' }}>{suggestion}</span>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <ChatMessageList
                        messages={messages}
                        isStreaming={isStreaming}
                        onRegenerate={handleRegenerate}
                        onFeedback={handleFeedback}
                        onReattach={handleReattach}
                        messagesEndRef={messagesEndRef}
                      />
                    ))}
                  </RequireAuth>
                } />
                <Route path="/experiments" element={<Navigate to="/experiments/rag" replace />} />
                <Route path="/experiments/rag" element={
                  <RequireAuth isAuth={isExperimentsAuthenticated}>
                    <RAGRouteContent />
                  </RequireAuth>
                } />
                <Route path="/experiments/rag/:conversationId" element={
                  <RequireAuth isAuth={isExperimentsAuthenticated}>
                    <RAGRouteContent />
                  </RequireAuth>
                } />
                <Route path="/experiments/plugin-agent" element={
                  <RequireAuth isAuth={isExperimentsAuthenticated}>
                    <AgentRouteContent />
                  </RequireAuth>
                } />
                <Route path="/experiments/plugin-agent/:conversationId" element={
                  <RequireAuth isAuth={isExperimentsAuthenticated}>
                    <AgentRouteContent />
                  </RequireAuth>
                } />
                <Route path="/experiments/stitch" element={
                  <RequireAuth isAuth={isExperimentsAuthenticated}>
                    <div className={`h-full overflow-auto ${stitchActiveProject ? 'p-0' : 'p-6'}`}>
                      <StitchPanel
                        key={stitchResetKey}
                        theme={theme}
                        onNotification={(msg, type) => type === 'success' ? toast.success(msg) : toast.error(msg)}
                        modelConfig={selectedModelConfig}
                        models={models}
                        onProjectChange={(project) => {
                          setStitchActiveProject(project);
                          if (project) {
                            navigate(`/experiments/stitch/${project.id}`, { replace: true });
                            setIsSidebarOpen(false);
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
                        onNotification={(msg, type) => type === 'success' ? toast.success(msg) : toast.error(msg)}
                        modelConfig={selectedModelConfig}
                        models={models}
                        initialProjectId={stitchProjectId}
                        onProjectChange={(project) => {
                          setStitchActiveProject(project);
                          if (project) {
                            navigate(`/experiments/stitch/${project.id}`, { replace: true });
                            setIsSidebarOpen(false);
                          } else {
                            navigate('/experiments/stitch', { replace: true });
                            setStitchControls(null);
                          }
                        }}
                        onControlsChange={setStitchControls}
                      />
                    </div>
                  </RequireAuth>
                } />
                <Route path="/library" element={
<RequireAuth isAuth={isLibraryAuthenticated}>
                      <div className="h-full">
                        <LibraryPanel
                          theme={theme}
                          modelConfig={selectedModelConfig}
                          onNotification={handleNotification}
                          onControlsChange={setLibraryControls}
                        />
                      </div>
                    </RequireAuth>
                  } />
                  <Route path="/library/:componentId" element={
                  <RequireAuth isAuth={isLibraryAuthenticated}>
                    <div className="h-full">
                      <LibraryPanel
                        theme={theme}
                        modelConfig={selectedModelConfig}
                        onNotification={handleNotification}
                        onControlsChange={setLibraryControls}
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
                    currentModel={currentModelId}
                    models={models}
                    onSelectModel={handleSelectModel}
                  />
                  <div className="text-center mt-3">
                    <p className="text-xs" style={{ color: 'rgba(122,122,122,0.6)' }}>
                      MiMo can make mistakes. Check important information.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <Toaster />
      </main>

      {libraryControls && (
        <AgentSidebar
          isOpen={agentDockOpen}
          onToggle={toggleAgentDock}
          selectedComponent={{
            id: libraryControls.componentId,
            name: libraryControls.componentName,
            description: libraryControls.componentDescription,
            tags: libraryControls.componentTags,
            category: libraryControls.componentCategory,
            files: libraryControls.files,
          } as any}
          modelConfig={selectedModelConfig}
          onNotification={handleNotification}
          onComponentUpdated={(comp) => {
            setLibraryControls(prev => prev ? {
              ...prev,
              componentName: comp.name,
              componentDescription: comp.description,
              componentTags: comp.tags,
            } : prev);
          }}
          onComponentsReload={() => {
            window.dispatchEvent(new CustomEvent('library-reload'));
          }}
          models={models.filter(m => m.modelType === 'chat').map(m => ({ id: m.id, name: m.name }))}
          selectedModelId={currentModelId}
          onModelChange={handleSelectModel}
        />
      )}
    </div>
  );
};

export default App;
