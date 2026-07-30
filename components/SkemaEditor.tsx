import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Brain, Loader2, Eye, Check, Undo2, Redo2, X, Copy, RefreshCw, Sparkles, Maximize2, Minimize2, Download, Code, PanelRight, ArrowLeft, PanelLeftClose, PanelLeft } from 'lucide-react';
import { SkemaProject, SkemaBoard, SkemaLayout, ModelConfig } from '../types';
import { getLayoutDimensions } from '../lib/layoutUtils';
import { sendAgentMessage, ToolResult } from '../services/agentService';
import * as db from '../services/apiDatabaseAdapter';
import { getEnabledTools as getSkemaEnabledTools, getSystemPromptAppend as getSkemaSystemPromptAppend } from '../lib/agentConfig';
import SkemaExportModal from './SkemaExportModal';
import SkemaLibrary from './SkemaLibrary';
import SkemaAgentSidebar from './skema/SkemaAgentSidebar';
import { CodeEditor } from '@/components/ui/code-editor-sheet';
import { MathCurveLoader } from '@/components/ui/math-curve-loader';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { SkemaComponent } from '../types/skemaSpec';

export interface SkemaControls {
  onExport: () => void;
  isGenerating: boolean;
  hasHtml: boolean;
  projectTitle: string;
  layout: SkemaLayout;
  viewMode: 'preview' | 'source';
  onViewModeToggle: () => void;
  onRegenerate: () => void;
  onStopGeneration: () => void;
  onCopy: () => void;
  copied: boolean;
  hasLastPrompt: boolean;
  onToggleLibrary: () => void;
  isLibraryOpen: boolean;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
}

interface SkemaEditorProps {
  project: SkemaProject;
  theme?: 'dark' | 'light';
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  onSave: (project: SkemaProject) => void;
  onBack?: () => void;
  modelConfig?: ModelConfig;
  models?: ModelConfig[];
  onControlsChange?: (controls: SkemaControls | null) => void;
}

const SkemaEditor: React.FC<SkemaEditorProps> = ({ project, theme = 'dark', onNotification, onSave, onBack, modelConfig, models, onControlsChange }) => {
  const [activeBoardIdx, setActiveBoardIdx] = useState(0);
  const board = project.boards[activeBoardIdx] || project.boards[0] || null;
  const layout = board?.layout || '16:9';
  const chatModels = models?.filter(m => (m.modelType || 'chat') === 'chat') || [];
  const [generatedHtml, setGeneratedHtml] = useState<string>(board?.generatedHtml || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const [copied, setCopied] = useState(false);
  const [lastPrompt, setLastPrompt] = useState('');
  const [selectedModelId, setSelectedModelId] = useState<string>(modelConfig?.id || '');
  const [thinkingText, setThinkingText] = useState('');
  const [streamingHtml, setStreamingHtml] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; html?: string; thinking?: string; responseText?: string; timestamp: number }>>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [sidebarInput, setSidebarInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(new Set());

  const [activeToolCalls, setActiveToolCalls] = useState<ToolResult[]>([]);
  const [toolCallStartTimes, setToolCallStartTimes] = useState<Record<string, number>>({});
  const [editSummary, setEditSummary] = useState<string>('');
  const [editedHtml, setEditedHtml] = useState<string>('');
  const [sourceOriginalHtml, setSourceOriginalHtml] = useState<string>('');
  const editorRef = useRef<any>(null);
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedLibraryComponents, setSelectedLibraryComponents] = useState<SkemaComponent[]>([]);
  const [selectedPalette, setSelectedPalette] = useState<{ name: string; colors: string[] } | null>(null);
  const [toolProgressText, setToolProgressText] = useState('');
  const [expandedToolProgress, setExpandedToolProgress] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAgentSidebar, setShowAgentSidebar] = useState(true);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);

  const dims = getLayoutDimensions(layout);
  const activeModel = models?.find(m => m.id === selectedModelId) || modelConfig;

  const prevBoardIdxRef = useRef(activeBoardIdx);
  useEffect(() => {
    if (prevBoardIdxRef.current === activeBoardIdx) return;
    prevBoardIdxRef.current = activeBoardIdx;
    const currentBoard = project.boards[activeBoardIdx];
    setGeneratedHtml(currentBoard?.generatedHtml || '');
    setStreamingHtml('');
    setThinkingText('');
  }, [activeBoardIdx]);

  const stripHtmlFromText = (text: string): string => {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/```(?:html)?\s*\n?[\s\S]*?```/gi, '').trim();
    cleaned = cleaned.replace(/<!DOCTYPE[\s\S]*$/i, '').trim();
    cleaned = cleaned.replace(/<!doctype[\s\S]*$/i, '').trim();
    return cleaned;
  };

  useEffect(() => {
    const restoreConversation = async () => {
      try {
        const skemaConvs = await db.getConversationsByType('skema');
        const match = skemaConvs.find(c => c.title === project.title);
        if (match && match.id) {
          setConversationId(match.id);
        } else if (board?.generatedHtml) {
          let dbModel = await db.getModelByName(modelConfig?.id || 'mimo-v2.5');
          if (!dbModel) {
            const modelId = await db.addModel(modelConfig?.id || 'mimo-v2.5', modelConfig?.description || null, modelConfig?.contextWindowSize || null);
            dbModel = await db.getModelById(modelId);
          }
          const newId = await db.createConversation(dbModel!.id!, project.title, 'skema');
          setConversationId(newId);
        }
      } catch (e) {
        console.error('Failed to restore skema conversation:', e);
      }
    };
    restoreConversation();
  }, [project.title]);

  const ensureSkemaConversation = useCallback(async (): Promise<number> => {
    if (conversationId) return conversationId;
    let dbModel = await db.getModelByName(modelConfig?.id || 'mimo-v2.5');
    if (!dbModel) {
      const modelId = await db.addModel(modelConfig?.id || 'mimo-v2.5', modelConfig?.description || null, modelConfig?.contextWindowSize || null);
      dbModel = await db.getModelById(modelId);
    }
    const newId = await db.createConversation(dbModel!.id!, project.title, 'skema');
    setConversationId(newId);
    return newId;
  }, [conversationId, modelConfig, project.title]);

  const loadChatMessages = useCallback(async () => {
    if (!conversationId) {
      setChatMessages([]);
      return;
    }
    const messages = await db.getMessagesByConversation(conversationId);
    const chat: Array<{ role: 'user' | 'assistant'; content: string; html?: string; thinking?: string; responseText?: string; timestamp: number }> = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'user') {
        chat.push({ role: 'user', content: msg.content, timestamp: msg.timestamp });
      } else if (msg.role === 'assistant') {
        try {
          const envelope = JSON.parse(msg.content);
          if (envelope.type === 'skema_generation') {
            chat.push({ role: 'assistant', content: envelope.prompt || '', html: envelope.html || '', thinking: envelope.thinking || '', responseText: stripHtmlFromText(envelope.responseText || ''), timestamp: msg.timestamp });
          }
        } catch {
          chat.push({ role: 'assistant', content: msg.content, timestamp: msg.timestamp });
        }
      }
    }
    setChatMessages(chat);
  }, [conversationId]);

  useEffect(() => {
    if (conversationId) {
      loadChatMessages();
    }
  }, [conversationId, loadChatMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, thinkingText, streamingHtml, activeToolCalls]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const containerWidth = entries[0].contentRect.width - 32;
      const z = Math.min(1, containerWidth / dims.width);
      setZoom(z);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [dims.width]);

  const updateBoard = useCallback((updates: Partial<SkemaBoard>) => {
    if (!board) return;
    const updatedBoard = { ...board, ...updates, updatedAt: Date.now() };
    const updatedBoards = [...project.boards];
    updatedBoards[activeBoardIdx] = updatedBoard;
    const updatedProject = { ...project, boards: updatedBoards, updatedAt: Date.now() };
    onSave(updatedProject);
  }, [board, project, onSave, activeBoardIdx]);

  const handleGenerate = async (prompt: string) => {
    setIsGenerating(true);
    setLastPrompt(prompt);
    setThinkingText('');
    setStreamingHtml('');
    setActiveToolCalls([]);
    setEditSummary('');
    setEditedHtml('');
    setToolProgressText('');

    const activeModel = models?.find(m => m.id === selectedModelId) || modelConfig;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const history = chatMessages.map(m => ({
      role: m.role,
      content: m.role === 'user' ? m.content : `Applied design changes for: ${m.content}`,
    }));

    const selectedImages = selectedLibraryComponents
      .filter(c => c.category === 'image')
      .map(c => ({
        id: c.id,
        label: c.name,
        url: c.content,
        mimeType: c.contentType === 'image-base64' ? 'image/png' : undefined,
      }));

    const context: Record<string, any> = {
      layout,
      boardDescription: project.title,
      model: activeModel?.apiModelId || activeModel?.id,
      provider: activeModel?.provider,
      projectType: project.projectType,
      images: selectedImages,
    };
    if (generatedHtml) {
      context.currentHtml = generatedHtml;
    }
    const nonImageComponents = selectedLibraryComponents.filter(c => c.category !== 'image');
    if (nonImageComponents.length > 0) {
      context.componentContext = nonImageComponents.map(c => {
        const snippet = c.specSnippet || c.content;
        return `### ${c.name} (${c.category})\n${c.description}\n\`\`\`${c.contentType}\n${snippet}\n\`\`\``;
      }).join('\n\n');
    }
    if (selectedPalette) {
      context.colorPalette = selectedPalette.colors;
      context.colorPaletteName = selectedPalette.name;
    }

    const skemaEnabledTools = getSkemaEnabledTools('skema');
    const defaultTools = ['edit_html', 'generate_html'];
    const tools = defaultTools.filter(t => skemaEnabledTools.includes(t));
    if (tools.length === 0) {
      onNotification?.('All skema tools are disabled. Enable them in Settings → Agents.', 'error');
      setIsGenerating(false);
      return;
    }

    let fullText = '';
    let fullThinking = '';
    let extractedHtml = '';
    const toolCalls: ToolResult[] = [];
    let hasToolCalls = false;

    try {
      const stream = sendAgentMessage(
        [...history, { role: 'user', content: prompt }],
        tools,
        activeModel?.apiModelId || activeModel?.id,
        activeModel?.provider,
        abortController.signal,
        context,
        getSkemaSystemPromptAppend('skema'),
      );

      for await (const chunk of stream) {
        if (chunk.thinkingText) {
          fullThinking += chunk.thinkingText;
          setThinkingText(fullThinking);
        }
        if (chunk.text) {
          fullText += chunk.text;
          if (!extractedHtml && !hasToolCalls) {
            let streamText = fullText.trim();
            const fenceMatch = streamText.match(/```(?:html)?\s*\n?([\s\S]*?)$/);
            if (fenceMatch) {
              streamText = fenceMatch[1].trim();
            }
            const htmlMatch = streamText.match(/(<!DOCTYPE[\s\S]*)/i);
            if (htmlMatch) {
              setStreamingHtml(htmlMatch[1].replace(/\n?```$/i, '').trim());
            }
          }
        }
        if (chunk.toolCall) {
          hasToolCalls = true;
          const pending: ToolResult = { name: chunk.toolCall.name, input: chunk.toolCall.arguments, output: '' };
          toolCalls.push(pending);
          setActiveToolCalls([...toolCalls]);
          setToolCallStartTimes(prev => ({ ...prev, [`${chunk.toolCall!.name}_${toolCalls.length}`]: Date.now() }));
        }
        if (chunk.toolResult) {
          const idx = toolCalls.findIndex(r => r.name === chunk.toolResult!.name && !r.output);
          if (idx >= 0) toolCalls[idx] = chunk.toolResult;
          setActiveToolCalls([...toolCalls]);
          setToolProgressText('');

          if (!chunk.toolResult.error) {
            if (chunk.toolResult.name === 'edit_html') {
              try {
                const parsed = JSON.parse(chunk.toolResult.output);
                if (parsed.html) {
                  extractedHtml = parsed.html;
                  setStreamingHtml(extractedHtml);
                }
                if (parsed.summary) {
                  setEditSummary(parsed.summary);
                }
              } catch {
                extractedHtml = chunk.toolResult.output;
                setStreamingHtml(extractedHtml);
              }
            } else if (chunk.toolResult.name === 'generate_html') {
              extractedHtml = chunk.toolResult.output;
              setStreamingHtml(extractedHtml);
            }
          }
        }
        if (chunk.toolProgress) {
          setToolProgressText(prev => prev + chunk.toolProgress!.chunk);
        }
      }

      let finalHtml = extractedHtml;

      if (!finalHtml && fullText && !hasToolCalls) {
        let cleaned = fullText.trim();
        const fenceMatch = cleaned.match(/```(?:html|json)?\s*\n?([\s\S]*?)```/);
        if (fenceMatch) {
          cleaned = fenceMatch[1].trim();
        }
        const htmlMatch = cleaned.match(/(<!DOCTYPE[\s\S]*)/i);
        if (htmlMatch) {
          finalHtml = htmlMatch[1].replace(/\n?```$/i, '').trim();
        } else if (/<!doctype/i.test(cleaned)) {
          finalHtml = cleaned;
        }
      }

      if (finalHtml) {
        finalHtml = finalHtml.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim();

        if (!finalHtml || !/<!doctype/i.test(finalHtml)) {
          onNotification?.('Failed to generate valid HTML', 'error');
          return;
        }

        setGeneratedHtml(finalHtml);
        setViewMode('preview');
        updateBoard({ generatedHtml: finalHtml });
        onNotification?.('HTML generated successfully', 'success');

        try {
          const convId = await ensureSkemaConversation();
          const order1 = await db.getNextMessageOrder(convId);
          await db.addMessage(convId, 'user', prompt, order1);
          const envelope = JSON.stringify({ type: 'skema_generation', html: finalHtml, thinking: fullThinking, prompt, responseText: stripHtmlFromText(fullText) });
          const order2 = await db.getNextMessageOrder(convId);
          await db.addMessage(convId, 'assistant', envelope, order2);
          setChatMessages(prev => [
            ...prev,
            { role: 'user', content: prompt, timestamp: Date.now() },
            { role: 'assistant', content: prompt, html: finalHtml, thinking: fullThinking, responseText: stripHtmlFromText(fullText), timestamp: Date.now() },
          ]);
        } catch (e) {
          console.error('Failed to save skema generation to conversation:', e);
        }
      } else {
        onNotification?.('No HTML was generated', 'error');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (extractedHtml) {
          const partialHtml = extractedHtml.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim();
          if (partialHtml && /<!doctype/i.test(partialHtml)) {
            setGeneratedHtml(partialHtml);
            updateBoard({ generatedHtml: partialHtml });
            onNotification?.('Generation cancelled — partial HTML saved', 'error');
          } else {
            onNotification?.('Generation cancelled', 'error');
          }
        } else {
          onNotification?.('Generation cancelled', 'error');
        }
      } else {
        onNotification?.(err.message || 'Failed to generate HTML', 'error');
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
      setActiveToolCalls([]);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleRegenerate = () => {
    if (lastPrompt) {
      handleGenerate(lastPrompt);
    }
  };

  const handleCopy = () => {
    if (!generatedHtml) return;
    navigator.clipboard.writeText(generatedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyMessage = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgIdx(idx);
      setTimeout(() => setCopiedMsgIdx(null), 2000);
    } catch {}
  };

  const handlePaletteSelect = useCallback((palette: { name: string; colors: string[] }) => {
    setSelectedPalette(palette);
  }, []);

  const handleLayoutSelect = useCallback((layout: SkemaComponent) => {
    setSelectedLibraryComponents(prev => {
      const exists = prev.some(c => c.id === layout.id);
      if (exists) return prev;
      return [...prev, layout];
    });
  }, []);

  const handleCancelEdits = useCallback(() => {
    setEditedHtml(sourceOriginalHtml);
    if (editorRef.current) {
      editorRef.current.getSession().getUndoManager().reset();
    }
  }, [sourceOriginalHtml]);

  useEffect(() => {
    if (viewMode === 'source' && generatedHtml) {
      if (!sourceOriginalHtml || editedHtml === '') {
        setEditedHtml(generatedHtml);
        setSourceOriginalHtml(generatedHtml);
      }
    }
    if (viewMode === 'preview') {
      if (editedHtml && editedHtml !== sourceOriginalHtml) {
        setGeneratedHtml(editedHtml);
        updateBoard({ generatedHtml: editedHtml });
      }
      setEditedHtml('');
      setSourceOriginalHtml('');
    }
  }, [viewMode, generatedHtml]);

  const handleExport = useCallback(() => {
    setShowExportModal(true);
  }, []);

  const handleAgentHtmlGenerated = useCallback((html: string) => {
    const cleanHtml = html.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim();
    if (!cleanHtml || !/<!doctype/i.test(cleanHtml)) return;
    setGeneratedHtml(cleanHtml);
    setStreamingHtml(cleanHtml);
    setViewMode('preview');
    updateBoard({ generatedHtml: cleanHtml });
    onNotification?.('HTML generated successfully', 'success');
  }, [updateBoard, onNotification]);

  React.useEffect(() => {
    if (!onControlsChange) return;
    onControlsChange({
      onExport: handleExport,
      isGenerating,
      hasHtml: !!generatedHtml,
      projectTitle: project.title,
      layout,
      viewMode,
      onViewModeToggle: () => setViewMode(v => v === 'preview' ? 'source' : 'preview'),
      onRegenerate: handleRegenerate,
      onStopGeneration: handleStopGeneration,
      onCopy: handleCopy,
      copied,
      hasLastPrompt: !!lastPrompt,
      onToggleLibrary: () => setShowLibrary(prev => !prev),
      isLibraryOpen: showLibrary,
      isFullscreen,
      onFullscreenToggle: () => setIsFullscreen(prev => !prev),
    });
  }, [generatedHtml, isGenerating, project.title, onControlsChange, handleExport, viewMode, copied, lastPrompt, layout, showLibrary, isFullscreen]);

  React.useEffect(() => {
    return () => { onControlsChange?.(null); };
  }, [onControlsChange]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isFullscreen]);

  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isFullscreen || !fullscreenContainerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      const padX = 80;
      const padY = 120;
      const scaleX = (width - padX) / dims.width;
      const scaleY = (height - padY) / dims.height;
      setFullscreenZoom(Math.min(1, scaleX, scaleY));
    });
    ro.observe(fullscreenContainerRef.current);
    return () => ro.disconnect();
  }, [isFullscreen, dims.width, dims.height]);

  const displayHtml = generatedHtml || '';

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Toolbar */}
        <aside
          className="flex-shrink-0 h-full flex flex-col items-center py-2 gap-1 z-40 transition-[width] duration-200"
          style={{ width: showLeftSidebar ? 52 : 0, overflow: 'hidden', backgroundColor: 'var(--bg-100)', borderRight: showLeftSidebar ? '1px solid var(--border-300)' : 'none' }}
        >
          {onBack && (
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
              style={{ color: 'var(--text-500)' }}
              title="Back to projects"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="w-6 my-1" style={{ borderTop: '1px solid var(--border-300)' }} />
          {displayHtml && (
            <button
              onClick={() => setViewMode(v => v === 'preview' ? 'source' : 'preview')}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
              style={{ color: viewMode === 'source' ? 'var(--neon-color)' : 'var(--text-500)', backgroundColor: viewMode === 'source' ? 'rgba(var(--neon-rgb), 0.1)' : 'transparent' }}
              title={viewMode === 'preview' ? 'Source' : 'Preview'}
            >
              {viewMode === 'preview' ? <Code size={16} /> : <Eye size={16} />}
            </button>
          )}
          <button
            onClick={handleExport}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
            style={{ color: 'var(--text-500)' }}
            title="Present"
          >
            <Download size={16} />
          </button>
          <button
            onClick={handleCopy}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
            style={{ color: copied ? '#4ae176' : 'var(--text-500)' }}
            title={copied ? 'Copied!' : 'Share'}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <div className="w-6 my-1" style={{ borderTop: '1px solid var(--border-300)' }} />
          <button
            onClick={() => setShowAgentSidebar(prev => !prev)}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
            style={{ color: showAgentSidebar ? 'var(--neon-color)' : 'var(--text-500)', backgroundColor: showAgentSidebar ? 'rgba(var(--neon-rgb), 0.1)' : 'transparent' }}
            title="Toggle AI Agent"
          >
            <PanelRight size={16} />
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setShowLeftSidebar(false)}
            className="w-9 h-9 rounded-lg flex-items justify-center transition-colors hover:opacity-80"
            style={{ color: 'var(--text-500)' }}
            title="Collapse sidebar"
          >
            <PanelLeftClose size={16} />
          </button>
        </aside>

        {/* Collapsed expand button */}
        {!showLeftSidebar && (
          <button
            onClick={() => setShowLeftSidebar(true)}
            className="absolute top-2 left-2 z-40 w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
            style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)', color: 'var(--text-500)' }}
            title="Expand sidebar"
          >
            <PanelLeft size={14} />
          </button>
        )}

        {/* Central Canvas */}
        <main className="flex-1 relative overflow-hidden" style={{ backgroundColor: '#0A0A0A' }}>
          {/* Dot Grid Pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none skema-dot-grid" />

          {/* Canvas Content */}
          <div ref={containerRef} className="relative w-full h-full flex items-center justify-center p-10 z-10">
            {displayHtml ? (
              viewMode === 'preview' || !generatedHtml ? (
                <div style={{
                  width: `${dims.width}px`,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                }}>
                  <iframe
                    style={{ width: `${dims.width}px`, height: `${dims.height}px`, border: '0', backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff', boxShadow: '0 4px 30px rgba(0,0,0,0.4)', borderRadius: '12px' }}
                    sandbox="allow-scripts"
                    srcDoc={displayHtml}
                    title="HTML Preview"
                  />
                </div>
              ) : (
                <div className="w-full h-full relative">
                  <div className="flex items-center justify-between px-4 py-2 rounded-t-xl" style={{ backgroundColor: '#1c1b1b', border: '1px solid #4d4354', borderBottom: 'none' }}>
                    <span className="text-xs font-medium" style={{ color: '#cfc2d6' }}>HTML Source</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => editorRef.current?.undo()} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: '#cfc2d6' }} title="Undo">
                        <Undo2 size={12} />
                      </button>
                      <button onClick={() => editorRef.current?.redo()} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: '#cfc2d6' }} title="Redo">
                        <Redo2 size={12} />
                      </button>
                      {editedHtml !== sourceOriginalHtml && (
                        <button onClick={handleCancelEdits} className="flex items-center gap-1 px-2 py-1 ml-1 rounded-lg text-xs font-medium transition-all" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                          <X size={10} /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="relative w-full rounded-b-xl overflow-hidden" style={{ height: 'calc(100% - 36px)', border: '1px solid #4d4354' }}>
                    <CodeEditor language="html" value={editedHtml || generatedHtml} onChange={(val) => setEditedHtml(val)} onLoad={(editor) => { editorRef.current = editor; }} className="absolute inset-0" />
                  </div>
                </div>
              )
            ) : isGenerating ? (
              streamingHtml ? (
                <div style={{ width: `${dims.width}px`, transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
                  <iframe
                    style={{ width: `${dims.width}px`, height: `${dims.height}px`, border: '0', backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff', boxShadow: '0 4px 30px rgba(0,0,0,0.4)', borderRadius: '12px' }}
                    sandbox="allow-scripts"
                    srcDoc={streamingHtml}
                    title="Streaming Preview"
                  />
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="mx-auto mb-4 flex items-center justify-center">
                    <MathCurveLoader size={56} />
                  </div>
                  <p className="text-sm mb-1" style={{ color: '#cfc2d6' }}>Generating HTML...</p>
                  <p className="text-xs" style={{ color: '#7a7a7a' }}>The AI is building your design</p>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-20">
                <div className="absolute w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, #ddb7ff, transparent 70%)' }} />
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide mb-4"
                  style={{ backgroundColor: 'rgba(221,183,255,0.1)', color: '#ddb7ff', border: '1px solid rgba(221,183,255,0.2)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ddb7ff' }} />
                  {`${project.boards[0]?.layout || '16:9'} · Website`}
                </span>
                <h2 className="text-lg font-semibold mb-1" style={{ color: '#e5e2e1' }}>
                  Create your design
                </h2>
                <p className="text-sm" style={{ color: '#7a7a7a' }}>
                  Describe what you want in the AI Copilot and it will generate it
                </p>
              </div>
            )}
          </div>

          {/* Floating Canvas Toolbar */}
          {displayHtml && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 skema-glass-card rounded-full px-5 py-2.5 flex gap-3 items-center">
              <button
                onClick={() => setIsFullscreen(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
                style={{ color: '#ddb7ff', backgroundColor: 'rgba(221,183,255,0.1)' }}
                title="Fullscreen"
              >
                <Maximize2 size={16} />
              </button>
              <div className="w-px h-5" style={{ backgroundColor: '#4d4354' }} />
              <button
                onClick={handleCopy}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
                style={{ color: copied ? '#4ae176' : '#cfc2d6' }}
                title="Copy HTML"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <button
                onClick={handleExport}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
                style={{ color: '#cfc2d6' }}
                title="Export"
              >
                <Download size={16} />
              </button>
              <div className="w-px h-5" style={{ backgroundColor: '#4d4354' }} />
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
                style={{ color: '#adc6ff', backgroundColor: 'rgba(173,198,255,0.1)' }}
                title="AI Magic"
              >
                <Sparkles size={16} />
              </button>
            </div>
          )}
        </main>

        {/* Right SideNavBar */}
        <SkemaAgentSidebar
          isOpen={showAgentSidebar}
          onToggle={() => setShowAgentSidebar(prev => !prev)}
          project={project}
          activeBoardIdx={activeBoardIdx}
          currentHtml={generatedHtml}
          modelConfig={activeModel}
          onNotification={onNotification}
          onHtmlGenerated={handleAgentHtmlGenerated}
          models={chatModels.map(m => ({ id: m.id, name: m.name }))}
          selectedModelId={selectedModelId}
          onModelChange={setSelectedModelId}
        />

        {/* Library Panel */}
        {showLibrary && (
          <div
            className="flex flex-col flex-shrink-0 w-[320px] h-full overflow-hidden animate-fade-in skema-glass-panel z-40"
            style={{ borderLeft: '1px solid #4d4354' }}
          >
            <SkemaLibrary
              projectType={project.projectType}
              theme={theme}
              onComponentsSelected={setSelectedLibraryComponents}
              onNotification={onNotification}
              onPaletteSelect={handlePaletteSelect}
              onLayoutSelect={handleLayoutSelect}
            />
          </div>
        )}
      </div>

      <SkemaExportModal
        project={project}
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onNotification={onNotification}
      />

      {/* Fullscreen modal */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent fullscreen hideCloseButton className="border-0 p-0 flex flex-col" style={{ backgroundColor: theme === 'dark' ? '#0a0a0a' : '#f5f5f5' }}>
          <div ref={fullscreenContainerRef} className="flex-1 flex items-center justify-center overflow-auto p-4 w-full h-full">
            <iframe
              style={{
                width: `${dims.width}px`,
                height: `${dims.height}px`,
                border: '0',
                backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff',
                boxShadow: '0 4px 30px rgba(0,0,0,0.4)',
                borderRadius: '12px',
                transform: `scale(${fullscreenZoom})`,
                transformOrigin: 'center center',
              }}
              sandbox="allow-scripts"
              srcDoc={streamingHtml || displayHtml}
              title="HTML Preview"
            />
          </div>
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 p-2.5 rounded-xl transition-all duration-200 hover:scale-105 skema-glass-card z-10"
            style={{ color: '#cfc2d6' }}
            title="Exit fullscreen (Esc)"
          >
            <Minimize2 size={16} />
          </button>
          {isGenerating && activeToolCalls.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-2 rounded-xl skema-glass-card z-10">
              {activeToolCalls.map((tc, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                  style={{
                    backgroundColor: tc.output ? 'rgba(74,222,128,0.1)' : 'rgba(221,183,255,0.08)',
                    color: tc.output ? '#4ae176' : '#cfc2d6',
                  }}
                >
                  {tc.output ? <Check size={8} /> : <Loader2 size={8} className="animate-spin" />}
                  {tc.name.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SkemaEditor;
