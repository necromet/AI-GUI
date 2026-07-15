import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Brain, Loader2, Eye, Check, Undo2, Redo2, X, Copy, RefreshCw, Plus, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { StitchProject, StitchBoard, StitchLayout, StitchProjectType, ModelConfig } from '../types';
import type { StitchDesignSpec, StitchSlideSpec } from '../types/stitchSpec';
import { getLayoutDimensions } from '../lib/layoutUtils';
import { renderSlide, renderAllSlides, validateDesignSpec } from '../services/stitchService';
import { sendAgentMessage, ToolResult } from '../services/agentService';
import * as db from '../services/apiDatabaseAdapter';
import StitchExportModal from './StitchExportModal';
import StitchLibrary from './StitchLibrary';
import { CodeEditor } from '@/components/ui/code-editor-sheet';
import { MathCurveLoader } from '@/components/ui/math-curve-loader';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChatInput, ChatInputTextArea, ChatInputSubmit } from '@/components/ui/chat-input';
import type { StitchComponent } from '../types/stitchSpec';

export interface StitchControls {
  onExport: () => void;
  isGenerating: boolean;
  hasHtml: boolean;
  projectTitle: string;
  layout: StitchLayout;
  viewMode: 'preview' | 'source';
  onViewModeToggle: () => void;
  onRegenerate: () => void;
  onStopGeneration: () => void;
  onCopy: () => void;
  copied: boolean;
  hasLastPrompt: boolean;
  onToggleLibrary: () => void;
  isLibraryOpen: boolean;
}

interface StitchEditorProps {
  project: StitchProject;
  theme?: 'dark' | 'light';
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  onSave: (project: StitchProject) => void;
  modelConfig?: ModelConfig;
  models?: ModelConfig[];
  onControlsChange?: (controls: StitchControls | null) => void;
}

const StitchEditor: React.FC<StitchEditorProps> = ({ project, theme = 'dark', onNotification, onSave, modelConfig, models, onControlsChange }) => {
  const [activeBoardIdx, setActiveBoardIdx] = useState(0);
  const board = project.boards[activeBoardIdx] || project.boards[0] || null;
  const layout = board?.layout || '16:9';
  const isCarousel = project.projectType === 'ig-carousel';
  const isIgContent = project.projectType === 'ig-carousel' || project.projectType === 'ig-story';
  const isIgStory = project.projectType === 'ig-story';
  const chatModels = models?.filter(m => (m.modelType || 'chat') === 'chat') || [];
  const [generatedHtml, setGeneratedHtml] = useState<string>(board?.generatedHtml || '');
  const [designSpec, setDesignSpec] = useState<StitchDesignSpec | null>(() => {
    if (isIgContent && project.fullDesignSpec) {
      return project.fullDesignSpec;
    }
    if (isIgContent && board?.designSpec) {
      return { version: 1, theme: project.theme || { fonts: { heading: 'Inter', body: 'Inter' }, colors: {}, borderRadius: '12px', spacing: '5%' }, slides: [board.designSpec] };
    }
    return null;
  });
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
  const [activeStyleChips, setActiveStyleChips] = useState<string[]>([]);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolResult[]>([]);
  const [editSummary, setEditSummary] = useState<string>('');
  const [editedHtml, setEditedHtml] = useState<string>('');
  const [sourceOriginalHtml, setSourceOriginalHtml] = useState<string>('');
  const editorRef = useRef<any>(null);
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedLibraryComponents, setSelectedLibraryComponents] = useState<StitchComponent[]>([]);
  const [selectedPalette, setSelectedPalette] = useState<{ name: string; colors: string[] } | null>(null);
  const [toolProgressText, setToolProgressText] = useState('');
  const [expandedToolProgress, setExpandedToolProgress] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const dims = getLayoutDimensions(layout);

  const prevBoardIdxRef = useRef(activeBoardIdx);
  useEffect(() => {
    if (prevBoardIdxRef.current === activeBoardIdx) return;
    prevBoardIdxRef.current = activeBoardIdx;
    const currentBoard = project.boards[activeBoardIdx];
    setGeneratedHtml(currentBoard?.generatedHtml || '');
    setStreamingHtml('');
    setThinkingText('');
    if (isIgContent && project.fullDesignSpec) {
      setDesignSpec(project.fullDesignSpec);
    }
  }, [activeBoardIdx, isIgContent, project.fullDesignSpec]);

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
        const stitchConvs = await db.getConversationsByType('stitch');
        const match = stitchConvs.find(c => c.title === project.title);
        if (match && match.id) {
          setConversationId(match.id);
        } else if (board?.generatedHtml) {
          let dbModel = await db.getModelByName(modelConfig?.id || 'mimo-v2.5');
          if (!dbModel) {
            const modelId = await db.addModel(modelConfig?.id || 'mimo-v2.5', modelConfig?.description || null, modelConfig?.contextWindowSize || null);
            dbModel = await db.getModelById(modelId);
          }
          const newId = await db.createConversation(dbModel!.id!, project.title, 'stitch');
          setConversationId(newId);
        }
      } catch (e) {
        console.error('Failed to restore stitch conversation:', e);
      }
    };
    restoreConversation();
  }, [project.title]);

  const ensureStitchConversation = useCallback(async (): Promise<number> => {
    if (conversationId) return conversationId;
    let dbModel = await db.getModelByName(modelConfig?.id || 'mimo-v2.5');
    if (!dbModel) {
      const modelId = await db.addModel(modelConfig?.id || 'mimo-v2.5', modelConfig?.description || null, modelConfig?.contextWindowSize || null);
      dbModel = await db.getModelById(modelId);
    }
    const newId = await db.createConversation(dbModel!.id!, project.title, 'stitch');
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
          if (envelope.type === 'stitch_generation') {
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

  const updateBoard = useCallback((updates: Partial<StitchBoard>) => {
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
    if (isIgContent && designSpec) {
      context.currentSpec = designSpec;
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
    if (isCarousel && activeBoardIdx > 0) {
      const firstSlideHtml = project.boards[0]?.generatedHtml;
      if (firstSlideHtml) {
        context.referenceSlideHtml = firstSlideHtml;
      }
      if (designSpec && designSpec.slides.length > 0) {
        context.referenceSpec = { ...designSpec, slides: [designSpec.slides[0]] };
      }
    }
    if (isIgContent) {
      context.slideCount = project.boards.length;
    } else if (isCarousel && activeBoardIdx > 0) {
      context.slideNumber = activeBoardIdx + 1;
      context.totalSlides = project.boards.length;
    }

    const tools = isIgContent ? ['generate_spec', 'edit_spec'] : ['edit_html', 'generate_html'];

    let fullText = '';
    let fullThinking = '';
    let extractedHtml = '';
    let extractedSpec: StitchDesignSpec | null = null;
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
      );

      for await (const chunk of stream) {
        if (chunk.thinkingText) {
          fullThinking += chunk.thinkingText;
          setThinkingText(fullThinking);
        }
        if (chunk.text) {
          fullText += chunk.text;
          if (!extractedHtml && !hasToolCalls && !isIgContent) {
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
            } else if (chunk.toolResult.name === 'generate_spec' || chunk.toolResult.name === 'edit_spec') {
              try {
                const spec = JSON.parse(chunk.toolResult.output) as StitchDesignSpec;
                const validation = validateDesignSpec(spec);
                if (validation.valid) {
                  extractedSpec = spec;
                  setDesignSpec(spec);
                  const renderedHtml = renderSlide(spec.slides[0], spec.theme, layout);
                  extractedHtml = renderedHtml;
                  setStreamingHtml(renderedHtml);
                } else {
                  setEditSummary(`Spec validation warnings: ${validation.errors.join(', ')}`);
                  try {
                    extractedSpec = spec;
                    setDesignSpec(spec);
                    const renderedHtml = renderSlide(spec.slides[0], spec.theme, layout);
                    extractedHtml = renderedHtml;
                    setStreamingHtml(renderedHtml);
                  } catch {}
                }
              } catch {
                setEditSummary('Failed to parse spec JSON');
              }
            }
          }
        }
        if (chunk.toolProgress) {
          setToolProgressText(prev => prev + chunk.toolProgress!.chunk);
        }
      }

      let finalHtml = extractedHtml;
      let finalSpec = extractedSpec;

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
        } else if (isIgContent && !finalSpec) {
          try {
            const spec = JSON.parse(cleaned) as StitchDesignSpec;
            if (spec.version === 1 && spec.theme && spec.slides) {
              finalSpec = spec;
            }
          } catch {}
        }
      }

      if (finalSpec && isIgContent) {
        const validation = validateDesignSpec(finalSpec);
        if (!validation.valid) {
          onNotification?.(`Spec validation: ${validation.errors.join(', ')}`, 'error');
          return;
        }

        setDesignSpec(finalSpec);

        if (isCarousel && finalSpec.slides.length > 1) {
          const allHtml = renderAllSlides(finalSpec, layout);
          const updatedBoards = [...project.boards];
          for (let i = 0; i < Math.min(allHtml.length, updatedBoards.length); i++) {
            updatedBoards[i] = {
              ...updatedBoards[i],
              generatedHtml: allHtml[i],
              designSpec: finalSpec.slides[i],
              updatedAt: Date.now(),
            };
          }
          const updatedProject = { ...project, boards: updatedBoards, theme: finalSpec.theme, fullDesignSpec: finalSpec, updatedAt: Date.now() };
          onSave(updatedProject);
          setGeneratedHtml(allHtml[activeBoardIdx] || allHtml[0]);
        } else {
          const slideSpec = finalSpec.slides[activeBoardIdx] || finalSpec.slides[0];
          const renderedHtml = renderSlide(slideSpec, finalSpec.theme, layout);
          finalHtml = renderedHtml;
          setGeneratedHtml(renderedHtml);
          const updatedBoards = [...project.boards];
          updatedBoards[activeBoardIdx] = {
            ...updatedBoards[activeBoardIdx],
            generatedHtml: renderedHtml,
            designSpec: slideSpec,
            updatedAt: Date.now(),
          };
          const updatedProject = { ...project, boards: updatedBoards, theme: finalSpec.theme, fullDesignSpec: finalSpec, updatedAt: Date.now() };
          onSave(updatedProject);
        }

        setViewMode('preview');
        onNotification?.('Design spec generated successfully', 'success');

        try {
          const convId = await ensureStitchConversation();
          const order1 = await db.getNextMessageOrder(convId);
          await db.addMessage(convId, 'user', prompt, order1);
          const envelope = JSON.stringify({ type: 'stitch_generation', spec: finalSpec, thinking: fullThinking, prompt, responseText: stripHtmlFromText(fullText) });
          const order2 = await db.getNextMessageOrder(convId);
          await db.addMessage(convId, 'assistant', envelope, order2);
          setChatMessages(prev => [
            ...prev,
            { role: 'user', content: prompt, timestamp: Date.now() },
            { role: 'assistant', content: prompt, html: finalHtml, thinking: fullThinking, responseText: stripHtmlFromText(fullText), timestamp: Date.now() },
          ]);
        } catch (e) {
          console.error('Failed to save stitch generation to conversation:', e);
        }
      } else if (finalHtml) {
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
          const convId = await ensureStitchConversation();
          const order1 = await db.getNextMessageOrder(convId);
          await db.addMessage(convId, 'user', prompt, order1);
          const envelope = JSON.stringify({ type: 'stitch_generation', html: finalHtml, thinking: fullThinking, prompt, responseText: stripHtmlFromText(fullText) });
          const order2 = await db.getNextMessageOrder(convId);
          await db.addMessage(convId, 'assistant', envelope, order2);
          setChatMessages(prev => [
            ...prev,
            { role: 'user', content: prompt, timestamp: Date.now() },
            { role: 'assistant', content: prompt, html: finalHtml, thinking: fullThinking, responseText: stripHtmlFromText(fullText), timestamp: Date.now() },
          ]);
        } catch (e) {
          console.error('Failed to save stitch generation to conversation:', e);
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

  const handleLayoutSelect = useCallback((layout: StitchComponent) => {
    setSelectedLibraryComponents(prev => {
      const exists = prev.some(c => c.id === layout.id);
      if (exists) return prev;
      return [...prev, layout];
    });
  }, []);

  const handleAddSlide = useCallback(() => {
    if (!isCarousel || project.boards.length >= 10) return;
    const newBoard: StitchBoard = {
      id: Math.random().toString(36).substring(2, 15),
      projectId: project.id,
      title: `Slide ${project.boards.length + 1}`,
      layout: '4:5' as StitchLayout,
      bgColor: '#ffffff',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updatedBoards = [...project.boards, newBoard];
    const updatedProject = { ...project, boards: updatedBoards, updatedAt: Date.now() };
    onSave(updatedProject);
    setActiveBoardIdx(updatedBoards.length - 1);
  }, [isCarousel, project, onSave]);

  const handleRemoveSlide = useCallback((idx: number) => {
    if (!isCarousel || project.boards.length <= 1) return;
    const updatedBoards = project.boards.filter((_, i) => i !== idx);
    const updatedProject = { ...project, boards: updatedBoards, updatedAt: Date.now() };
    onSave(updatedProject);
    if (activeBoardIdx >= updatedBoards.length) {
      setActiveBoardIdx(updatedBoards.length - 1);
    } else if (activeBoardIdx > idx) {
      setActiveBoardIdx(activeBoardIdx - 1);
    }
  }, [isCarousel, project, onSave, activeBoardIdx]);

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
    });
  }, [generatedHtml, isGenerating, project.title, onControlsChange, handleExport, viewMode, copied, lastPrompt, layout, showLibrary]);

  React.useEffect(() => {
    return () => { onControlsChange?.(null); };
  }, [onControlsChange]);

  const displayHtml = generatedHtml || '';
  const showSidebar = !!displayHtml || chatMessages.length > 0 || isGenerating;

  return (
    <div className="flex h-full w-full">
      {showSidebar && (
      <div
        className="flex flex-col flex-shrink-0 w-[340px] h-full overflow-hidden"
        style={{
          borderRight: '1px solid var(--border-300)',
          backgroundColor: 'var(--bg-100)',
        }}
      >
        {/* Slide selector — carousel only */}
        {isCarousel && project.boards.length > 1 && (
          <div className="flex-shrink-0 px-3 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hidden" style={{ borderBottom: '1px solid var(--border-300)' }}>
            {project.boards.map((b, idx) => {
              const isActive = activeBoardIdx === idx;
              const hasContent = !!b.generatedHtml;
              const dims = getLayoutDimensions(b.layout);
              return (
                <div key={b.id} className="relative flex-shrink-0 group/slide">
                  <button
                    onClick={() => setActiveBoardIdx(idx)}
                    className="relative w-12 h-14 rounded-xl overflow-hidden transition-all duration-300 ease-out"
                    style={{
                      background: isActive
                        ? `linear-gradient(135deg, rgba(var(--neon-rgb), 0.25), rgba(var(--neon-secondary-rgb), 0.15))`
                        : 'var(--bg-200)',
                      border: isActive ? 'none' : hasContent ? '1px solid var(--border-300)' : '1px dashed var(--border-300)',
                      boxShadow: isActive ? '0 0 16px rgba(var(--neon-rgb), 0.2), inset 0 0 0 1.5px rgba(var(--neon-rgb), 0.5)' : 'none',
                      transform: isActive ? 'scale(1.08)' : 'scale(1)',
                    }}
                  >
                    {hasContent ? (
                      <div className="absolute inset-0 overflow-hidden">
                        <iframe
                          srcDoc={b.generatedHtml}
                          sandbox=""
                          style={{
                            width: `${dims.width}px`,
                            height: `${dims.height}px`,
                            border: '0',
                            pointerEvents: 'none',
                            transform: `translate(-50%, -50%) scale(${Math.max(48 / dims.width, 56 / dims.height) * 1.5})`,
                            transformOrigin: 'center center',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                          }}
                          title={`Slide ${idx + 1}`}
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-5 h-4 rounded-sm" style={{ border: `1px dashed ${isActive ? 'rgba(var(--neon-rgb), 0.3)' : 'var(--border-300)'}` }} />
                      </div>
                    )}
                    {!hasContent && (
                      <span className="absolute inset-0 flex items-center justify-center z-10 text-xs font-bold" style={{
                        color: isActive ? 'var(--neon-color)' : 'var(--text-300)',
                      }}>
                        {idx + 1}
                      </span>
                    )}
                  </button>
                  {project.boards.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveSlide(idx); }}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover/slide:opacity-100 transition-all duration-200 z-20"
                      style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
                    >
                      <X size={8} />
                    </button>
                  )}
                </div>
              );
            })}
            {project.boards.length < 10 && (
              <button
                onClick={handleAddSlide}
                className="flex-shrink-0 w-12 h-14 rounded-xl flex flex-col items-center justify-center transition-all duration-200 hover:border-[var(--neon-color)]"
                style={{ border: '1px dashed var(--border-300)', color: 'var(--text-500)' }}
              >
                <Plus size={14} style={{ color: 'var(--neon-color)', opacity: 0.6 }} />
                <span className="text-[9px] mt-0.5 font-medium" style={{ color: 'var(--text-500)' }}>Add</span>
              </button>
            )}
          </div>
        )}

        {/* Chat messages */}
        <ScrollArea className="flex-1">
          <div className="px-3 py-3 space-y-2">
            {/* Context chips */}
            {(selectedLibraryComponents.length > 0 || selectedPalette) && (
              <div className="flex items-center gap-1 flex-wrap">
                {selectedPalette && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium cursor-pointer"
                    style={{
                      backgroundColor: 'rgba(var(--neon-rgb), 0.1)',
                      color: 'var(--neon-color)',
                      border: '1px solid rgba(var(--neon-rgb), 0.2)',
                    }}
                    onClick={() => setSelectedPalette(null)}
                  >
                    <span className="flex gap-px">
                      {selectedPalette.colors.slice(0, 3).map((c, i) => (
                        <span key={i} className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                    {selectedPalette.name}
                    <X size={7} />
                  </span>
                )}
                {selectedLibraryComponents.map(c => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium"
                    style={{
                      backgroundColor: 'rgba(var(--neon-rgb), 0.1)',
                      color: 'var(--neon-color)',
                      border: '1px solid rgba(var(--neon-rgb), 0.2)',
                    }}
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            )}

            {/* Empty state */}
            {chatMessages.length === 0 && !isGenerating && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div
                  className="w-12 h-12 rounded-2xl mb-4 flex items-center justify-center"
                  style={{ background: 'rgba(var(--neon-rgb), 0.1)' }}
                >
                  <Sparkles size={20} style={{ color: 'var(--neon-color)' }} />
                </div>
                <p className="text-base font-semibold mb-1.5" style={{ color: 'var(--text-100)' }}>
                  {isCarousel ? `Design slide ${activeBoardIdx + 1}` : 'Start a design'}
                </p>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-500)' }}>
                  Describe what you want to build and the AI will generate it
                </p>
                <div className="flex flex-col gap-1.5 w-full">
                  {(isCarousel
                    ? ['Bold product showcase with gradient background', 'Clean tips list with numbered steps', 'Eye-catching before and after comparison']
                    : isIgStory
                      ? ['Story with poll sticker and bold text', 'Countdown announcement with gradient', 'Minimal quote on dark background']
                      : ['Modern SaaS landing page with hero section', 'Pricing table with 3 tiers', 'Portfolio grid with hover effects']
                  ).map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => { setSidebarInput(suggestion); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200"
                      style={{
                        backgroundColor: 'var(--bg-100)',
                        color: 'var(--text-300)',
                        border: '1px solid var(--border-300)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.3)';
                        e.currentTarget.style.backgroundColor = 'rgba(var(--neon-rgb), 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-300)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-100)';
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat messages */}
            {chatMessages.map((msg, idx) => (
              <div key={idx} className="animate-message-in">
                {msg.role === 'user' ? (
                  <div className="flex justify-end">
                    <div
                      className="max-w-[85%] rounded-2xl rounded-br-md px-3 py-2 text-sm leading-relaxed prose prose-invert max-w-none [&>p]:mb-0.5 [&>p]:last:mb-0 [&>ul]:my-0.5 [&>ol]:my-0.5 [&>ul>li]:mb-0.5 [&>ol>li]:mb-0.5 [&>pre]:my-1 [&>pre]:text-xs [&>code]:text-xs"
                      style={{
                        backgroundColor: 'rgba(var(--neon-rgb), 0.12)',
                        color: 'var(--text-100)',
                      }}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="group/msg">
                    <div className="flex items-start gap-2">
                      <div
                        className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center mt-0.5"
                        style={{ background: 'rgba(var(--neon-rgb), 0.12)' }}
                      >
                        <Sparkles size={10} style={{ color: 'var(--neon-color)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {msg.thinking && (
                          <div className="mb-1.5">
                            <button
                              onClick={() => {
                                setExpandedThinking(prev => {
                                  const next = new Set(prev);
                                  if (next.has(idx)) next.delete(idx); else next.add(idx);
                                  return next;
                                });
                              }}
                              className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                              style={{ color: 'var(--text-500)' }}
                            >
                              <Brain size={10} style={{ color: 'var(--neon-color)', opacity: 0.7 }} />
                              <span>Reasoning</span>
                              {expandedThinking.has(idx) ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                            </button>
                            <div
                              className="overflow-hidden transition-all duration-300"
                              style={{
                                maxHeight: expandedThinking.has(idx) ? '200px' : '0',
                                opacity: expandedThinking.has(idx) ? 1 : 0,
                              }}
                            >
                              <div
                                className="mt-1 pl-2.5 text-sm leading-relaxed italic"
                                style={{
                                  color: 'var(--text-500)',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  borderLeft: '2px solid rgba(var(--neon-rgb), 0.2)',
                                }}
                              >
                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]}>{msg.thinking}</ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        )}
                        {msg.responseText && msg.responseText.trim() && (
                          <div className="text-sm leading-relaxed prose prose-invert max-w-none [&>p]:mb-0.5 [&>p]:last:mb-0 [&>ul]:my-0.5 [&>ol]:my-0.5 [&>ul>li]:mb-0.5 [&>ol>li]:mb-0.5 [&>pre]:my-1 [&>pre]:text-xs [&>code]:text-xs" style={{ color: 'var(--text-100)' }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]}>{msg.responseText}</ReactMarkdown>
                          </div>
                        )}
                        <div className="flex items-center gap-0.5 mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => handleCopyMessage(msg.responseText || msg.content, idx)}
                            className="p-1 rounded transition-colors"
                            style={{ color: copiedMsgIdx === idx ? 'var(--neon-color)' : 'var(--text-500)' }}
                          >
                            {copiedMsgIdx === idx ? <Check size={10} /> : <Copy size={10} />}
                          </button>
                          <button
                            onClick={() => { if (!isGenerating && lastPrompt) handleGenerate(lastPrompt); }}
                            className="p-1 rounded transition-colors"
                            style={{ color: 'var(--text-500)' }}
                          >
                            <RefreshCw size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isGenerating && (
              <div className="animate-message-in">
                <div className="flex items-start gap-2">
                  <div
                    className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center"
                    style={{ background: 'rgba(var(--neon-rgb), 0.12)' }}
                  >
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--neon-color)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {!activeToolCalls.length && !streamingHtml && !thinkingText && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-500)' }}>Thinking</span>
                        <span className="flex gap-0.5">
                          {[0, 1, 2].map(i => (
                            <span
                              key={i}
                              className="w-1 h-1 rounded-full inline-block"
                              style={{
                                backgroundColor: 'var(--text-500)',
                                animation: `pulse-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                              }}
                            />
                          ))}
                        </span>
                      </div>
                    )}
                    {activeToolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {activeToolCalls.map((tc, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
                            style={{
                              backgroundColor: tc.output ? 'rgba(74, 222, 128, 0.1)' : 'rgba(var(--neon-rgb), 0.08)',
                              color: tc.output ? '#4ade80' : 'var(--text-300)',
                              border: `1px solid ${tc.output ? 'rgba(74, 222, 128, 0.2)' : 'var(--border-300)'}`,
                            }}
                          >
                            {tc.output ? <Check size={8} /> : <Loader2 size={8} className="animate-spin" />}
                            {tc.name.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                    {editSummary && (
                      <p className="text-xs font-mono mb-1" style={{ color: 'var(--text-500)', whiteSpace: 'pre-wrap' }}>
                        {editSummary}
                      </p>
                    )}
                    {thinkingText && !activeToolCalls.some(tc => !tc.output) && (
                      <div className="mb-1">
                        <div className="flex items-center gap-1 mb-0.5">
                          <Brain size={10} style={{ color: 'var(--neon-color)', opacity: 0.7 }} />
                          <span className="text-xs font-medium" style={{ color: 'var(--text-500)' }}>Reasoning</span>
                        </div>
                        <div
                          className="max-h-16 overflow-y-auto text-xs leading-relaxed italic pl-2"
                          style={{
                            color: 'var(--text-500)',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            borderLeft: '2px solid rgba(var(--neon-rgb), 0.15)',
                          }}
                        >
                          {thinkingText}
                        </div>
                      </div>
                    )}
                    {streamingHtml && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Eye size={9} style={{ color: 'var(--neon-color)', opacity: 0.7 }} />
                        <span className="text-xs" style={{ color: 'var(--text-500)' }}>
                          {streamingHtml.length.toLocaleString()} chars
                        </span>
                        <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-300)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              backgroundColor: 'var(--neon-color)',
                              width: `${Math.min(100, (streamingHtml.length / 5000) * 100)}%`,
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Bottom toolbar + Input */}
        <div className="flex-shrink-0" style={{ borderTop: '1px solid var(--border-300)' }}>
          {/* Toolbar */}
          <div className="px-3 pt-1.5 pb-0.5 flex items-center gap-0.5">
            <div className="flex-1" />
            {chatModels.length > 1 && (
              <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                <SelectTrigger
                  className="h-7 w-auto min-w-0 border-0 text-xs font-medium px-1.5 gap-0.5"
                  style={{ backgroundColor: 'transparent', color: 'var(--text-500)' }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chatModels.map(model => (
                    <SelectItem key={model.id} value={model.id} className="text-xs">
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-1">
            <ChatInput
              value={sidebarInput}
              onChange={(e) => setSidebarInput(e.target.value)}
              onSubmit={() => {
                if (sidebarInput.trim() && !isGenerating) {
                  handleGenerate(sidebarInput.trim());
                  setSidebarInput('');
                }
              }}
              loading={isGenerating}
              onStop={handleStopGeneration}
              rows={1}
            >
              <ChatInputTextArea
                placeholder={
                  chatMessages.length === 0
                    ? (isCarousel ? `Describe slide ${activeBoardIdx + 1}...` : 'Describe your design...')
                    : 'Describe changes...'
                }
                disabled={isGenerating}
              />
              <ChatInputSubmit />
            </ChatInput>
          </div>
        </div>
      </div>
      )}

      {/* Preview area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div ref={containerRef} className="flex-1 overflow-auto flex justify-center items-center p-4" style={{ backgroundColor: 'var(--bg-100)' }}>
          {displayHtml ? (
            viewMode === 'preview' || !generatedHtml ? (
              <div style={{
                width: `${dims.width}px`,
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
              }}>
                <iframe
                  style={{ width: `${dims.width}px`, height: `${dims.height}px`, border: '0', backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff', boxShadow: '0 4px 30px rgba(0,0,0,0.2)', borderRadius: '12px' }}
                  sandbox="allow-scripts"
                  srcDoc={displayHtml}
                  title="HTML Preview"
                />
              </div>
            ) : (
              <div className="w-full h-full relative">
                <div className="flex items-center justify-between px-4 py-2 rounded-t-xl" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)', borderBottom: 'none' }}>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-500)' }}>HTML Source</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => editorRef.current?.undo()}
                      className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-300)]"
                      style={{ color: 'var(--text-500)' }}
                      title="Undo (Ctrl+Z)"
                    >
                      <Undo2 size={12} />
                    </button>
                    <button
                      onClick={() => editorRef.current?.redo()}
                      className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-300)]"
                      style={{ color: 'var(--text-500)' }}
                      title="Redo (Ctrl+Shift+Z)"
                    >
                      <Redo2 size={12} />
                    </button>
                    {editedHtml !== sourceOriginalHtml && (
                      <button
                        onClick={handleCancelEdits}
                        className="flex items-center gap-1 px-2 py-1 ml-1 rounded-lg text-xs font-medium transition-all"
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                        }}
                      >
                        <X size={10} />
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
                <div
                  className="relative w-full rounded-b-xl overflow-hidden"
                  style={{
                    height: 'calc(100% - 36px)',
                    border: '1px solid var(--border-300)',
                  }}
                >
                  <CodeEditor
                    language="html"
                    value={editedHtml || generatedHtml}
                    onChange={(val) => setEditedHtml(val)}
                    onLoad={(editor) => { editorRef.current = editor; }}
                    className="absolute inset-0"
                  />
                </div>
              </div>
            )
          ) : isGenerating ? (
            <div className="text-center py-20">
              <div className="mx-auto mb-4 flex items-center justify-center">
                <MathCurveLoader size={56} />
              </div>
              <p className="text-sm mb-1" style={{ color: 'var(--text-300)' }}>{isIgContent ? 'Composing design...' : 'Generating HTML...'}</p>
              <p className="text-xs" style={{ color: 'var(--text-500)' }}>{isIgContent ? 'The AI is building your design spec' : 'The AI is building your design'}</p>
            </div>
          ) : (
            <div className="w-full max-w-2xl mx-auto py-8 px-4">
              {/* Ambient glow */}
              <div className="relative flex flex-col items-center text-center mb-8">
                <div
                  className="absolute -top-16 w-48 h-48 rounded-full opacity-15 blur-3xl pointer-events-none"
                  style={{ background: `radial-gradient(circle, var(--neon-color), transparent 70%)` }}
                />

                {/* Project type badge */}
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide mb-5 animate-fade-in"
                  style={{
                    backgroundColor: 'rgba(var(--neon-rgb), 0.1)',
                    color: 'var(--neon-color)',
                    border: '1px solid rgba(var(--neon-rgb), 0.2)',
                    animationDelay: '0ms',
                    opacity: 0,
                    animationFillMode: 'forwards',
                  }}
                >
                  {isCarousel ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--neon-color)' }} />
                      {project.boards[0]?.layout || '4:5'} · Carousel · {project.boards.length} slides
                    </>
                  ) : isIgStory ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--neon-color)' }} />
                      9:16 · Story / Reel
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--neon-color)' }} />
                      {project.boards[0]?.layout || '16:9'} · Website
                    </>
                  )}
                </span>

                {/* Headline */}
                <h2
                  className="text-xl font-bold mb-2 animate-fade-in"
                  style={{ color: 'var(--text-100)', animationDelay: '60ms', opacity: 0, animationFillMode: 'forwards' }}
                >
                  {isCarousel ? `Design slide ${activeBoardIdx + 1}` : 'Create your design'}
                </h2>
                <p
                  className="text-sm leading-relaxed animate-fade-in"
                  style={{ color: 'var(--text-500)', animationDelay: '120ms', opacity: 0, animationFillMode: 'forwards' }}
                >
                  Describe what you want to build and the AI will generate it
                </p>
              </div>

              {/* Slide stepper — carousel only */}
              {isCarousel && project.boards.length > 1 && (
                <div className="flex items-center justify-center gap-0 mb-6 animate-fade-in" style={{ animationDelay: '180ms', opacity: 0, animationFillMode: 'forwards' }}>
                  {project.boards.map((b, idx) => {
                    const isActive = activeBoardIdx === idx;
                    const hasContent = !!b.generatedHtml;
                    return (
                      <React.Fragment key={b.id}>
                        <button
                          onClick={() => setActiveBoardIdx(idx)}
                          className="relative flex items-center justify-center transition-all duration-300 ease-out"
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: isActive
                              ? `linear-gradient(135deg, rgba(var(--neon-rgb), 0.3), rgba(var(--neon-secondary-rgb), 0.2))`
                              : 'var(--bg-200)',
                            border: 'none',
                            boxShadow: isActive ? '0 0 12px rgba(var(--neon-rgb), 0.2), inset 0 0 0 1.5px rgba(var(--neon-rgb), 0.5)' : 'inset 0 0 0 1px var(--border-300)',
                            transform: isActive ? 'scale(1.1)' : 'scale(1)',
                          }}
                        >
                          <span className="text-xs font-bold" style={{ color: isActive ? 'var(--neon-color)' : 'var(--text-500)' }}>
                            {idx + 1}
                          </span>
                        </button>
                        {idx < project.boards.length - 1 && (
                          <div className="w-4 h-px flex-shrink-0" style={{ backgroundColor: 'var(--border-300)' }} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}

              {/* Prompt bar */}
              <div className="animate-fade-in" style={{ animationDelay: '240ms', opacity: 0, animationFillMode: 'forwards' }}>
                <StitchPromptBar
                  onGenerate={(prompt) => { handleGenerate(prompt); }}
                  isGenerating={isGenerating}
                  theme={theme}
                  models={models}
                  selectedModelId={selectedModelId}
                  onModelChange={setSelectedModelId}
                  initialActiveChips={activeStyleChips}
                  onActiveChipsChange={setActiveStyleChips}
                  projectType={project.projectType}
                />
              </div>

              {/* Quick-start suggestions */}
              <div className="mt-6 animate-fade-in" style={{ animationDelay: '360ms', opacity: 0, animationFillMode: 'forwards' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5 text-center" style={{ color: 'var(--text-500)' }}>
                  Quick start
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(isCarousel
                    ? ['Bold product showcase with gradient background', 'Clean tips list with numbered steps', 'Eye-catching before and after comparison']
                    : isIgStory
                      ? ['Story with poll sticker and bold text', 'Countdown announcement with gradient', 'Minimal quote on dark background']
                      : ['Modern SaaS landing page with hero section', 'Pricing table with 3 tiers', 'Portfolio grid with hover effects']
                  ).map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => { setSidebarInput(suggestion); }}
                      className="group/suggestion text-left px-3.5 py-3 rounded-xl text-xs leading-relaxed transition-all duration-300"
                      style={{
                        backgroundColor: 'var(--bg-200)',
                        color: 'var(--text-300)',
                        border: '1px solid var(--border-300)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.3)';
                        e.currentTarget.style.backgroundColor = 'rgba(var(--neon-rgb), 0.04)';
                        e.currentTarget.style.boxShadow = '0 0 20px rgba(var(--neon-rgb), 0.06)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-300)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-200)';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar — Library */}
      {showLibrary && (
        <div
          className="flex flex-col flex-shrink-0 w-[320px] h-full overflow-hidden animate-fade-in"
          style={{
            borderLeft: '1px solid var(--border-300)',
            backgroundColor: 'var(--bg-100)',
          }}
        >
          <StitchLibrary
            projectType={project.projectType}
            theme={theme}
            onComponentsSelected={setSelectedLibraryComponents}
            onNotification={onNotification}
            onPaletteSelect={handlePaletteSelect}
            onLayoutSelect={handleLayoutSelect}
          />
        </div>
      )}

      <StitchExportModal
        project={project}
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onNotification={onNotification}
      />
    </div>
  );
};

export default StitchEditor;
