import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Brain, Loader2, Eye, Wrench, Check, Undo2, Redo2, X, Copy, RefreshCw, Square, ArrowUp, ChevronLeft, Plus, Trash2, Package } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { StitchProject, StitchBoard, StitchLayout, StitchProjectType, StitchImageRef, ModelConfig } from '../types';
import type { StitchDesignSpec, StitchSlideSpec } from '../types/stitchSpec';
import { getLayoutDimensions } from '../lib/layoutUtils';
import { renderSlide, renderAllSlides, validateDesignSpec } from '../services/stitchService';
import { sendAgentMessage, ToolResult } from '../services/agentService';
import * as db from '../services/apiDatabaseAdapter';
import StitchPromptBar from './StitchPromptBar';
import StitchImageManager from './StitchImageManager';
import StitchExportModal from './StitchExportModal';
import StitchLibrary from './StitchLibrary';
import { CodeEditor } from '@/components/ui/code-editor-sheet';
import { SquareLoader } from '@/components/ui/loader-2';
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
}

interface StitchEditorProps {
  project: StitchProject;
  theme?: 'dark' | 'light';
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  onBack: () => void;
  onSave: (project: StitchProject) => void;
  modelConfig?: ModelConfig;
  models?: ModelConfig[];
  onControlsChange?: (controls: StitchControls | null) => void;
}

const StitchEditor: React.FC<StitchEditorProps> = ({ project, theme = 'dark', onNotification, onBack, onSave, modelConfig, models, onControlsChange }) => {
  const [activeBoardIdx, setActiveBoardIdx] = useState(0);
  const board = project.boards[activeBoardIdx] || project.boards[0] || null;
  const layout = board?.layout || '16:9';
  const isCarousel = project.projectType === 'ig-carousel';
  const isIgContent = project.projectType === 'ig-carousel' || project.projectType === 'ig-story';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedLibraryComponents, setSelectedLibraryComponents] = useState<StitchComponent[]>([]);
  const [toolProgressText, setToolProgressText] = useState('');
  const [expandedToolProgress, setExpandedToolProgress] = useState(false);

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

    const context: Record<string, any> = {
      layout,
      boardDescription: project.title,
      model: activeModel?.apiModelId || activeModel?.id,
      provider: activeModel?.provider,
      projectType: project.projectType,
      images: project.images || [],
    };
    if (generatedHtml) {
      context.currentHtml = generatedHtml;
    }
    if (isIgContent && designSpec) {
      context.currentSpec = designSpec;
    }
    if (selectedLibraryComponents.length > 0) {
      context.componentContext = selectedLibraryComponents.map(c => {
        const snippet = c.specSnippet || c.content;
        return `### ${c.name} (${c.category})\n${c.description}\n\`\`\`${c.contentType}\n${snippet}\n\`\`\``;
      }).join('\n\n');
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

  const handleImagesChange = useCallback((images: StitchImageRef[]) => {
    const updatedProject = { ...project, images, updatedAt: Date.now() };
    onSave(updatedProject);
  }, [project, onSave]);

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

  useEffect(() => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    el.style.height = 'auto';
    requestAnimationFrame(() => {
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    });
  }, [sidebarInput]);

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
    });
  }, [generatedHtml, isGenerating, project.title, onControlsChange, handleExport, viewMode, copied, lastPrompt, layout]);

  React.useEffect(() => {
    return () => { onControlsChange?.(null); };
  }, [onControlsChange]);

  const displayHtml = generatedHtml || '';
  const showSidebar = !!displayHtml || chatMessages.length > 0 || isGenerating;

  return (
    <div className="flex h-full w-full">
      {showSidebar && (
      /* Sidebar — chat interface (shown after first generation) */
      <div
        className="flex flex-col flex-shrink-0 w-[288px] h-full overflow-hidden"
        style={{
          borderRight: '1px solid var(--border-300)',
          backgroundColor: 'var(--bg-200)',
        }}
      >
        {/* Slide navigator for carousels */}
        {isCarousel && project.boards.length > 1 && (
          <div
            className="flex-shrink-0 px-2 py-2 flex items-center gap-1 overflow-x-auto scrollbar-hidden"
            style={{ borderBottom: '1px solid var(--border-300)' }}
          >
            {project.boards.map((b, idx) => (
              <div key={b.id} className="relative flex-shrink-0 group/slide">
                <button
                  onClick={() => setActiveBoardIdx(idx)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all duration-200 whitespace-nowrap"
                  style={{
                    backgroundColor: activeBoardIdx === idx ? 'rgba(var(--neon-rgb), 0.2)' : 'var(--bg-100)',
                    border: activeBoardIdx === idx ? '1px solid rgba(var(--neon-rgb), 0.4)' : '1px solid var(--border-300)',
                    color: activeBoardIdx === idx ? 'var(--neon-color)' : 'var(--text-500)',
                  }}
                >
                  {b.generatedHtml ? '\u2713 ' : ''}{idx + 1}
                </button>
                {project.boards.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveSlide(idx); }}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center opacity-0 group-hover/slide:opacity-100 transition-opacity"
                    style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: '7px' }}
                  >
                    <X size={7} />
                  </button>
                )}
              </div>
            ))}
            {project.boards.length < 10 && (
              <button
                onClick={handleAddSlide}
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200"
                style={{
                  backgroundColor: 'var(--bg-100)',
                  border: '1px dashed var(--border-300)',
                  color: 'var(--text-500)',
                }}
              >
                <Plus size={10} />
              </button>
            )}
          </div>
        )}

        {/* Image manager */}
        <div className="flex-shrink-0 px-3 py-2" style={{ borderBottom: '1px solid var(--border-300)' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <StitchImageManager
              images={project.images || []}
              onChange={handleImagesChange}
              theme={theme}
            />
            <button
              onClick={() => setShowLibrary(!showLibrary)}
              className="flex-shrink-0 p-1.5 rounded-lg transition-all duration-200"
              style={{
                backgroundColor: showLibrary ? 'rgba(var(--neon-rgb), 0.2)' : 'transparent',
                border: showLibrary ? '1px solid rgba(var(--neon-rgb), 0.4)' : '1px solid var(--border-300)',
                color: showLibrary ? 'var(--neon-color)' : 'var(--text-500)',
              }}
              title="Component Library"
            >
              <Package size={14} />
            </button>
          </div>
          {selectedLibraryComponents.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {selectedLibraryComponents.map(c => (
                <span key={c.id} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.15)', color: 'var(--neon-color)', border: '1px solid rgba(var(--neon-rgb), 0.3)' }}>
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Library panel */}
        {showLibrary && (
          <div className="flex-shrink-0 max-h-[300px] overflow-hidden" style={{ borderBottom: '1px solid var(--border-300)' }}>
            <StitchLibrary
              projectType={project.projectType}
              theme={theme}
              onComponentsSelected={setSelectedLibraryComponents}
              onNotification={onNotification}
            />
          </div>
        )}

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5 relative">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className="group/msg animate-message-in">
              {msg.role === 'user' ? (
                <div
                  className="rounded-xl px-3 py-2.5 text-xs leading-relaxed prose prose-invert max-w-none [&>p]:mb-1 [&>p]:last:mb-0 [&>ul]:my-1 [&>ol]:my-1 [&>ul>li]:mb-0.5 [&>ol>li]:mb-0.5 [&>pre]:my-2 [&>pre]:text-[11px] [&>code]:text-[11px] [&>h1]:text-sm [&>h2]:text-sm [&>h3]:text-xs [&>table]:text-[11px]"
                  style={{
                    backgroundColor: 'rgba(var(--neon-rgb), 0.1)',
                    color: 'var(--text-100)',
                    border: '1px solid rgba(var(--neon-rgb), 0.15)',
                  }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <div
                  className="rounded-xl overflow-hidden transition-all"
                  style={{
                    backgroundColor: 'var(--bg-300)',
                    border: '1px solid var(--border-300)',
                  }}
                >
                  {msg.thinking && (
                    <div style={{ borderBottom: '1px solid var(--border-300)' }}>
                      <button
                        onClick={() => {
                          setExpandedThinking(prev => {
                            const next = new Set(prev);
                            if (next.has(idx)) next.delete(idx); else next.add(idx);
                            return next;
                          });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                        style={{ color: 'var(--text-300)' }}
                      >
                        <Brain size={12} style={{ color: 'var(--neon-color)' }} />
                        <span className="text-xs font-semibold flex-1">Reasoning</span>
                        {expandedThinking.has(idx) ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                      </button>
                      {expandedThinking.has(idx) && (
                        <div
                          className="px-3 pb-2 max-h-40 overflow-y-auto text-xs leading-relaxed italic opacity-70"
                          style={{ color: 'var(--text-500)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', borderLeft: '2px solid var(--border-200)', marginLeft: '12px', paddingLeft: '8px' }}
                        >
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]}>{msg.thinking}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}
                  {msg.responseText && msg.responseText.trim() && (
                    <div className="px-3 py-2.5">
                      <div className="text-xs leading-relaxed prose prose-invert max-w-none [&>p]:mb-1 [&>p]:last:mb-0 [&>ul]:my-1 [&>ol]:my-1 [&>ul>li]:mb-0.5 [&>ol>li]:mb-0.5 [&>pre]:my-2 [&>pre]:text-[11px] [&>code]:text-[11px]" style={{ color: 'var(--text-100)' }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]}>{msg.responseText}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                  {/* Action buttons on hover */}
                  <div className="flex items-center gap-0.5 px-2 py-1.5 opacity-0 group-hover/msg:opacity-100 transition-opacity" style={{ borderTop: '1px solid var(--border-300)' }}>
                    <button
                      onClick={() => handleCopyMessage(msg.responseText || msg.content, idx)}
                      className="p-1 rounded transition-colors"
                      style={{ color: copiedMsgIdx === idx ? 'var(--neon-color)' : 'var(--text-500)' }}
                      title="Copy message"
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-200)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      {copiedMsgIdx === idx ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                    <button
                      onClick={() => {
                        if (!isGenerating && lastPrompt) handleGenerate(lastPrompt);
                      }}
                      className="p-1 rounded transition-colors"
                      style={{ color: 'var(--text-500)' }}
                      title="Regenerate"
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-200)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <RefreshCw size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isGenerating && (
            <div className="rounded-xl px-3 py-2.5 animate-message-in" style={{ backgroundColor: 'var(--bg-300)', border: '1px solid var(--border-300)' }}>
              {!activeToolCalls.length && !streamingHtml && (
                <div className="flex items-center gap-2 mb-1">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: 'var(--text-500)',
                        animation: `pulse-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                  <span className="text-xs font-medium" style={{ color: 'var(--text-500)' }}>Thinking...</span>
                </div>
              )}
              {activeToolCalls.length > 0 && (
                <div className="flex items-center gap-2 mb-1.5">
                  <Loader2 size={12} className="animate-spin" style={{ color: 'var(--neon-color)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>
                    {activeToolCalls[activeToolCalls.length - 1].name === 'edit_html'
                      ? 'Applying edits...'
                      : activeToolCalls[activeToolCalls.length - 1].name === 'generate_spec' || activeToolCalls[activeToolCalls.length - 1].name === 'edit_spec'
                        ? 'Composing design...'
                        : 'Generating HTML...'}
                  </span>
                </div>
              )}
              {activeToolCalls.length > 0 && (
                <div className="mt-1 space-y-1">
                  {activeToolCalls.map((tc, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Wrench size={10} style={{ color: 'var(--neon-color)' }} />
                      <span className="text-[10px] font-medium" style={{ color: 'var(--text-500)' }}>
                        {tc.name.replace(/_/g, ' ')}
                      </span>
                      {tc.output ? (
                        <Check size={10} style={{ color: '#4ade80' }} />
                      ) : (
                        <Loader2 size={10} className="animate-spin" style={{ color: 'var(--neon-color)' }} />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {editSummary && (
                <div className="mt-1.5 text-[10px] font-mono leading-relaxed" style={{ color: 'var(--text-500)', whiteSpace: 'pre-wrap' }}>
                  {editSummary}
                </div>
              )}
              {toolProgressText && activeToolCalls.some(tc => !tc.output) && (
                <div className="mt-2" style={{ borderTop: '1px solid var(--border-300)', paddingTop: '6px' }}>
                  <button
                    onClick={() => setExpandedToolProgress(prev => !prev)}
                    className="flex items-center gap-1.5 w-full text-left"
                  >
                    <Eye size={10} style={{ color: 'var(--neon-color)' }} />
                    <span className="text-[10px] font-semibold flex-1" style={{ color: 'var(--text-500)' }}>
                      {activeToolCalls[activeToolCalls.length - 1]?.name?.includes('spec')
                        ? `Composing spec... ${toolProgressText.length.toLocaleString()} chars`
                        : `Generating HTML... ${toolProgressText.length.toLocaleString()} chars`}
                    </span>
                    {expandedToolProgress ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                  </button>
                  {expandedToolProgress && (
                    <div className="mt-1 max-h-32 overflow-y-auto text-[10px] font-mono leading-relaxed"
                      style={{ color: 'var(--text-500)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {toolProgressText.slice(-2000)}
                    </div>
                  )}
                </div>
              )}
              {thinkingText && (
                <div className="mt-2" style={{ borderTop: '1px solid var(--border-300)', paddingTop: '6px' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Brain size={10} style={{ color: 'var(--neon-color)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-500)' }}>Reasoning</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto text-xs leading-relaxed italic opacity-70"
                    style={{ color: 'var(--text-500)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {thinkingText}
                  </div>
                </div>
              )}
              {streamingHtml && (
                <div className="mt-2" style={{ borderTop: '1px solid var(--border-300)', paddingTop: '6px' }}>
                  <div className="flex items-center gap-1.5">
                    <Eye size={10} style={{ color: 'var(--neon-color)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-500)' }}>
                      {streamingHtml.length.toLocaleString()} characters generated
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <div className="flex-shrink-0 relative">
          <div className="px-2.5 py-2" style={{ backgroundColor: 'var(--bg-200)' }}>
            {models && models.filter(m => (m.modelType || 'chat') === 'chat').length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hidden mb-1.5 pb-0.5">
                {models.filter(m => (m.modelType || 'chat') === 'chat').map(model => {
                  const isActive = selectedModelId === model.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => setSelectedModelId(model.id)}
                      className="flex-shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all duration-200 whitespace-nowrap"
                      style={{
                        backgroundColor: isActive ? 'rgba(var(--neon-rgb), 0.2)' : 'var(--bg-200)',
                        border: isActive ? '1px solid rgba(var(--neon-rgb), 0.4)' : '1px solid var(--border-300)',
                        color: isActive ? 'var(--neon-color)' : 'var(--text-500)',
                      }}
                    >
                      {model.name}
                    </button>
                  );
                })}
              </div>
            )}
            <div
              className="flex items-end gap-1.5 rounded-xl px-2.5 py-1.5"
              style={{
                backgroundColor: 'var(--bg-100)',
                border: '1px solid var(--border-300)',
              }}
            >
              <textarea
                ref={textareaRef}
                value={sidebarInput}
                onChange={(e) => setSidebarInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (sidebarInput.trim() && !isGenerating) {
                      handleGenerate(sidebarInput.trim());
                      setSidebarInput('');
                    }
                  }
                }}
                placeholder={
                  chatMessages.length === 0
                    ? (isCarousel ? `Describe slide ${activeBoardIdx + 1}...` : 'Describe your design...')
                    : (isCarousel ? `Modify slide ${activeBoardIdx + 1}...` : 'Modify the design...')
                }
                className="flex-1 bg-transparent text-xs outline-none resize-none min-h-[18px] max-h-[120px] leading-snug"
                style={{ color: 'var(--text-100)' }}
                disabled={isGenerating}
                rows={1}
              />
              {isGenerating ? (
                <button
                  onClick={handleStopGeneration}
                  className="p-1.5 rounded-lg transition-colors flex-shrink-0"
                  style={{ color: '#ef4444' }}
                  title="Stop generation"
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Square size={14} className="fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (sidebarInput.trim() && !isGenerating) {
                      handleGenerate(sidebarInput.trim());
                      setSidebarInput('');
                    }
                  }}
                  disabled={!sidebarInput.trim()}
                  className="p-1.5 rounded-lg transition-all duration-200 disabled:opacity-30 flex-shrink-0"
                  style={{
                    backgroundColor: sidebarInput.trim() ? 'var(--neon-color)' : 'transparent',
                    color: sidebarInput.trim() ? '#000' : 'var(--text-500)',
                  }}
                >
                  <ArrowUp size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Preview area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div ref={containerRef} className="flex-1 overflow-auto flex justify-center p-4" style={{ backgroundColor: 'var(--bg-100)' }}>
          {displayHtml ? (
            viewMode === 'preview' || !generatedHtml ? (
              <div style={{
                width: `${dims.width}px`,
                minHeight: '100%',
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
              }}>
                <iframe
                  style={{ width: `${dims.width}px`, height: `${dims.height}px`, border: '0', backgroundColor: '#fff', boxShadow: '0 4px 30px rgba(0,0,0,0.2)', borderRadius: '12px' }}
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
                <SquareLoader size={56} />
              </div>
              <p className="text-sm mb-1" style={{ color: 'var(--text-300)' }}>{isIgContent ? 'Composing design...' : 'Generating HTML...'}</p>
              <p className="text-xs" style={{ color: 'var(--text-500)' }}>{isIgContent ? 'The AI is building your design spec' : 'The AI is building your design'}</p>
            </div>
          ) : (
            <div className="w-full max-w-2xl mx-auto py-12 px-4">
              <div className="text-center mb-6">
                <div
                  className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: 'rgba(var(--neon-rgb), 0.1)' }}
                >
                  <Eye size={24} style={{ color: 'var(--neon-color)' }} />
                </div>
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-100)' }}>Create your design</p>
                <p className="text-xs" style={{ color: 'var(--text-500)' }}>Select styles below and describe what you want to build</p>
                {isCarousel && (
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--neon-color)' }}>
                    Carousel: {project.boards.length} slides at 4:5 (Slide {activeBoardIdx + 1})
                  </p>
                )}
                {project.projectType === 'ig-story' && (
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--neon-color)' }}>
                    Instagram Story/Reel at 9:16
                  </p>
                )}
              </div>

              {/* Slide navigator for carousels in empty state */}
              {isCarousel && project.boards.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 mb-4">
                  {project.boards.map((b, idx) => (
                    <button
                      key={b.id}
                      onClick={() => setActiveBoardIdx(idx)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all duration-200"
                      style={{
                        backgroundColor: activeBoardIdx === idx ? 'rgba(var(--neon-rgb), 0.2)' : 'var(--bg-200)',
                        border: activeBoardIdx === idx ? '1px solid rgba(var(--neon-rgb), 0.4)' : '1px solid var(--border-300)',
                        color: activeBoardIdx === idx ? 'var(--neon-color)' : 'var(--text-500)',
                      }}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              )}

              {/* Image manager in empty state */}
              <div className="mb-4 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}>
                <StitchImageManager
                  images={project.images || []}
                  onChange={handleImagesChange}
                  theme={theme}
                />
              </div>

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
          )}
        </div>
      </div>

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
