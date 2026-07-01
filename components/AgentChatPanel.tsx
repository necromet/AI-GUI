import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Puzzle, Globe, Code, Wrench, Loader2, ChevronDown, ChevronRight, Check, X } from 'lucide-react';
import { Role, Message, ModelConfig, ConversationType } from '../types';
import { PromptInputBox } from './PromptInputBox';
import ChatMessage from './ChatMessage';
import * as db from '../services/databaseAdapter';
import { sendAgentMessage, ToolResult, getAvailableTools, ToolDefinition } from '../services/agentService';

const generateId = () => Math.random().toString(36).substring(2, 15);

interface AgentChatPanelProps {
  theme: 'dark' | 'light';
  modelConfig: ModelConfig;
  models: ModelConfig[];
  onNotification: (msg: string, type: 'success' | 'error') => void;
  conversationId: number | null;
  onConversationChange: (id: number | null) => void;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  web_browse: <Globe size={12} />,
  execute_code: <Code size={12} />,
  search_web: <Globe size={12} />,
};

const AgentChatPanel: React.FC<AgentChatPanelProps> = ({
  theme,
  modelConfig,
  models,
  onNotification,
  conversationId,
  onConversationChange,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [enabledTools, setEnabledTools] = useState<string[]>(['web_browse', 'execute_code', 'search_web']);
  const [availableTools, setAvailableTools] = useState<ToolDefinition[]>([]);
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);
  const [showToolResults, setShowToolResults] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom, toolResults]);

  useEffect(() => {
    getAvailableTools().then(setAvailableTools).catch(() => {});
  }, []);

  useEffect(() => {
    if (conversationId) {
      loadConversationMessages(conversationId);
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  const loadConversationMessages = async (convId: number) => {
    const dbMessages = await db.getMessagesByConversation(convId);
    const loaded: Message[] = dbMessages.map(msg => ({
      id: msg.message_id!.toString(),
      role: msg.role === 'assistant' ? Role.Assistant : Role.User,
      content: msg.content,
      timestamp: new Date(msg.timestamp).getTime(),
      messageOrder: msg.message_order,
      dbMessageId: msg.message_id,
    }));
    setMessages(loaded);
  };

  const ensureConversation = async (): Promise<number> => {
    if (conversationId) return conversationId;
    let dbModel = await db.getModelByName(modelConfig.id);
    if (!dbModel) {
      const modelId = await db.addModel(modelConfig.id, modelConfig.description || null, modelConfig.contextWindowSize || null);
      dbModel = await db.getModelById(modelId);
    }
    const newId = await db.createConversation(dbModel!.model_id!, null, 'plugin-agent');
    onConversationChange(newId);
    return newId;
  };

  const saveMessageToDb = async (convId: number, role: 'user' | 'assistant', content: string) => {
    const order = await db.getNextMessageOrder(convId);
    return await db.addMessage(convId, role, content, order);
  };

  const toggleTool = (toolName: string) => {
    setEnabledTools(prev =>
      prev.includes(toolName) ? prev.filter(t => t !== toolName) : [...prev, toolName]
    );
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const convId = await ensureConversation();

    const userMessage: Message = {
      id: generateId(),
      role: Role.User,
      content: text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);
    await saveMessageToDb(convId, 'user', text);

    if (messages.length === 0) {
      const title = text.substring(0, 50) + (text.length > 50 ? '...' : '');
      await db.updateConversationTitle(convId, title);
    }

    const aiMessageId = generateId();
    setMessages(prev => [...prev, {
      id: aiMessageId,
      role: Role.Assistant,
      content: '',
      isThinking: true,
      timestamp: Date.now() + 1,
    }]);
    setIsStreaming(true);
    setToolResults([]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const history = messages.map(m => ({ role: m.role === Role.Assistant ? 'assistant' : 'user', content: m.content }));

      let fullText = '';
      let fullThinking = '';

      for await (const chunk of sendAgentMessage(history, enabledTools, modelConfig.apiModelId || modelConfig.id, modelConfig.provider, abortController.signal)) {
        if (chunk.toolCall) {
          setToolResults(prev => [...prev, { name: chunk.toolCall!.name, input: chunk.toolCall!.arguments, output: '' }]);
        }
        if (chunk.toolResult) {
          setToolResults(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(r => r.name === chunk.toolResult!.name && !r.output);
            if (idx >= 0) updated[idx] = chunk.toolResult!;
            return updated;
          });
        }
        if (chunk.thinkingText) {
          fullThinking += chunk.thinkingText;
          setMessages(prev => prev.map(msg =>
            msg.id === aiMessageId ? { ...msg, thinkingContent: fullThinking, isThinking: true } : msg
          ));
        }
        if (chunk.text) {
          fullText += chunk.text;
          setMessages(prev => prev.map(msg =>
            msg.id === aiMessageId ? { ...msg, content: fullText, thinkingContent: fullThinking, isThinking: false } : msg
          ));
        }
      }

      if (fullText) {
        await saveMessageToDb(convId, 'assistant', fullText);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => prev.filter(m => m.id !== aiMessageId));
      } else {
        setMessages(prev => prev.map(msg =>
          msg.id === aiMessageId ? { ...msg, content: `**Error:** ${err.message}`, isThinking: false } : msg
        ));
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleFeedback = (messageId: string, feedback: 'good' | 'bad') => {};

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ background: 'rgba(var(--neon-rgb), 0.1)' }}>
            <Puzzle size={20} style={{ color: 'var(--neon-color)' }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>Plug-in Agent</h2>
            <p className="text-[10px]" style={{ color: 'var(--text-500)' }}>
              {enabledTools.length} tool{enabledTools.length !== 1 ? 's' : ''} enabled
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {availableTools.map(tool => (
            <button
              key={tool.name}
              onClick={() => toggleTool(tool.name)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all"
              style={{
                backgroundColor: enabledTools.includes(tool.name) ? 'rgba(var(--neon-rgb), 0.15)' : 'var(--bg-200)',
                color: enabledTools.includes(tool.name) ? 'var(--neon-color)' : 'var(--text-500)',
                border: `1px solid ${enabledTools.includes(tool.name) ? 'rgba(var(--neon-rgb), 0.3)' : 'var(--border-300)'}`,
              }}
              title={tool.description}
            >
              {TOOL_ICONS[tool.name] || <Wrench size={12} />}
              {tool.name.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Tool results panel */}
      {toolResults.length > 0 && (
        <div className="mx-4 mb-3">
          <button
            onClick={() => setShowToolResults(!showToolResults)}
            className="flex items-center gap-1.5 text-[11px] font-semibold mb-1.5"
            style={{ color: 'var(--text-500)' }}
          >
            {showToolResults ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Tool Calls ({toolResults.length})
          </button>
          {showToolResults && (
            <div className="space-y-1.5">
              {toolResults.map((result, idx) => (
                <div
                  key={idx}
                  className="rounded-lg p-2.5 text-[11px]"
                  style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {TOOL_ICONS[result.name] || <Wrench size={10} />}
                    <span className="font-semibold" style={{ color: 'var(--text-100)' }}>{result.name}</span>
                    {result.output ? (
                      <Check size={10} style={{ color: '#4ade80' }} />
                    ) : result.error ? (
                      <X size={10} style={{ color: '#f87171' }} />
                    ) : (
                      <Loader2 size={10} className="animate-spin" style={{ color: 'var(--neon-color)' }} />
                    )}
                  </div>
                  {result.output && (
                    <pre className="max-h-24 overflow-y-auto font-mono leading-relaxed" style={{ color: 'var(--text-500)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {result.output.substring(0, 500)}{result.output.length > 500 ? '...' : ''}
                    </pre>
                  )}
                  {result.error && (
                    <p style={{ color: '#f87171' }}>{result.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-52">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Puzzle size={40} style={{ color: 'var(--text-500)' }} className="mb-4" />
            <p className="text-sm mb-1" style={{ color: 'var(--text-300)' }}>Plug-in Agent</p>
            <p className="text-xs max-w-sm" style={{ color: 'var(--text-500)' }}>
              Chat with an AI agent that can browse the web, execute code, and search for information.
            </p>
          </div>
        ) : (
          <div className="pb-4">
            {messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} onRegenerate={() => {}} onFeedback={handleFeedback} isStreaming={isStreaming && msg.id === messages[messages.length - 1]?.id} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="absolute bottom-0 left-0 w-full pt-20 pb-6 px-4"
        style={{ background: `linear-gradient(to top, var(--bg-100) 50%, transparent)` }}
      >
        <div className="max-w-3xl mx-auto w-full">
          <PromptInputBox
            onSend={(text) => handleSendMessage(text)}
            isLoading={isStreaming}
            onStop={() => abortControllerRef.current?.abort()}
            placeholder="Ask the agent anything..."
            theme={theme}
          />
        </div>
      </div>
    </div>
  );
};

export default AgentChatPanel;
