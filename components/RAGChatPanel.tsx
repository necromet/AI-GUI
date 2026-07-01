import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Database, Upload, Trash2, FileText, Loader2 } from 'lucide-react';
import { Role, Message, ModelConfig, ConversationType } from '../types';
import { PromptInputBox } from './PromptInputBox';
import ChatMessage from './ChatMessage';
import * as db from '../services/databaseAdapter';
import { uploadDocument, listDocuments, deleteDocument, queryRAG, RAGDocument, RAGSource } from '../services/ragService';

const generateId = () => Math.random().toString(36).substring(2, 15);

interface RAGChatPanelProps {
  theme: 'dark' | 'light';
  modelConfig: ModelConfig;
  models: ModelConfig[];
  onNotification: (msg: string, type: 'success' | 'error') => void;
  conversationId: number | null;
  onConversationChange: (id: number | null) => void;
}

const RAGChatPanel: React.FC<RAGChatPanelProps> = ({
  theme,
  modelConfig,
  models,
  onNotification,
  conversationId,
  onConversationChange,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (conversationId) {
      loadConversationMessages(conversationId);
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  const loadDocuments = async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  const loadConversationMessages = async (convId: number) => {
    const dbMessages = await db.getMessagesByConversation(convId);
    const loaded: Message[] = dbMessages.map(msg => ({
      id: msg.message_id!.toString(),
      role: msg.role === 'assistant' ? Role.Assistant : Role.User,
      content: msg.content,
      timestamp: new Date(msg.timestamp).getTime(),
      messageOrder: msg.message_order,
      dbMessageId: msg.message_id,
      annotations: (() => {
        const raw = (msg as any).search_annotations;
        if (raw && typeof raw === 'string') { try { return JSON.parse(raw); } catch {} }
        return Array.isArray(raw) ? raw : undefined;
      })(),
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
    const newId = await db.createConversation(dbModel!.model_id!, null, 'rag');
    onConversationChange(newId);
    await db.getConversations(); // refresh
    return newId;
  };

  const saveMessageToDb = async (convId: number, role: 'user' | 'assistant', content: string, annotations?: any[]) => {
    const order = await db.getNextMessageOrder(convId);
    return await db.addMessage(convId, role, content, order, null, null, null, null, annotations);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    let successCount = 0;
    for (const file of Array.from(files)) {
      try {
        await uploadDocument(file);
        successCount++;
      } catch (err: any) {
        onNotification(`Failed to upload ${file.name}: ${err.message}`, 'error');
      }
    }
    if (successCount > 0) {
      onNotification(`Uploaded ${successCount} document(s)`, 'success');
      await loadDocuments();
    }
    setIsUploading(false);
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      await deleteDocument(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
      onNotification('Document deleted', 'success');
    } catch (err: any) {
      onNotification(`Delete failed: ${err.message}`, 'error');
    }
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

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const history = messages.map(m => ({ role: m.role === Role.Assistant ? 'assistant' : 'user', content: m.content }));

      let fullText = '';
      let fullThinking = '';
      let sources: RAGSource[] | undefined;

      for await (const chunk of queryRAG(text, history, modelConfig.apiModelId || modelConfig.id, modelConfig.provider, abortController.signal)) {
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
        if (chunk.sources) {
          sources = chunk.sources;
        }
      }

      if (fullText) {
        const annotations = sources?.map(s => ({
          type: 'url_citation' as const,
          url: '',
          title: `Source ${s.index}`,
          summary: s.text,
        }));
        await saveMessageToDb(convId, 'assistant', fullText, annotations?.length ? annotations : undefined);
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
            <Database size={20} style={{ color: 'var(--neon-color)' }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>RAG</h2>
            <p className="text-[10px]" style={{ color: 'var(--text-500)' }}>
              {documents.length} document{documents.length !== 1 ? 's' : ''} indexed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDocs(!showDocs)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: showDocs ? 'rgba(var(--neon-rgb), 0.15)' : 'var(--bg-200)',
              color: showDocs ? 'var(--neon-color)' : 'var(--text-300)',
              border: `1px solid ${showDocs ? 'rgba(var(--neon-rgb), 0.3)' : 'var(--border-300)'}`,
            }}
          >
            <FileText size={12} />
            Documents
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
            style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
          >
            {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.txt,.md,.html,.htm,.json,.csv,.log"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      </div>

      {/* Document list panel */}
      {showDocs && (
        <div
          className="mx-4 mb-3 rounded-xl p-3 max-h-48 overflow-y-auto"
          style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}
        >
          {documents.length === 0 ? (
            <p className="text-xs text-center" style={{ color: 'var(--text-500)' }}>No documents uploaded yet</p>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-2 group">
                  <FileText size={12} style={{ color: 'var(--text-500)' }} />
                  <span className="flex-1 text-xs truncate" style={{ color: 'var(--text-300)' }}>{doc.name}</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-500)' }}>{doc.chunkCount} chunks</span>
                  <button
                    onClick={() => handleDeleteDoc(doc.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                    style={{ color: '#f87171' }}
                  >
                    <Trash2 size={10} />
                  </button>
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
            <Database size={40} style={{ color: 'var(--text-500)' }} className="mb-4" />
            <p className="text-sm mb-1" style={{ color: 'var(--text-300)' }}>RAG Chat</p>
            <p className="text-xs max-w-sm" style={{ color: 'var(--text-500)' }}>
              Upload documents and ask questions. The AI will retrieve relevant context before answering.
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
            placeholder="Ask about your documents..."
            theme={theme}
          />
        </div>
      </div>
    </div>
  );
};

export default RAGChatPanel;
