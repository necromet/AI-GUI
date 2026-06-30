import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Download, Copy, Check, Code, Eye, RotateCcw, ChevronDown, ChevronRight, Brain, Loader2, ArrowLeft } from 'lucide-react';
import { StitchProject, StitchBoard, StitchLayout, ModelConfig } from '../types';
import { createNewBoard, getLayoutDimensions, generateHTML, generateHTMLStream } from '../services/stitchService';
import StitchPromptBar from './StitchPromptBar';

export interface StitchControls {
  onExport: () => void;
  isGenerating: boolean;
  hasHtml: boolean;
  projectTitle: string;
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

const LAYOUT_LABELS: Record<string, string> = {
  '16:9': '16:9 Landscape',
  '1:1': '1:1 Square',
  '9:16': '9:16 Portrait',
};

const StitchEditor: React.FC<StitchEditorProps> = ({ project, theme = 'dark', onNotification, onBack, onSave, modelConfig, models, onControlsChange }) => {
  const board = project.boards[0] || null;
  const layout = board?.layout || '16:9';
  const [generatedHtml, setGeneratedHtml] = useState<string>(board?.generatedHtml || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const [copied, setCopied] = useState(false);
  const [lastPrompt, setLastPrompt] = useState('');
  const [selectedModelId, setSelectedModelId] = useState<string>(modelConfig?.id || '');
  const [thinkingText, setThinkingText] = useState('');
  const [streamingHtml, setStreamingHtml] = useState('');
  const [thinkingExpanded, setThinkingExpanded] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedPreviewHtml, setDebouncedPreviewHtml] = useState('');

  const hasGenerated = !!generatedHtml || (!!streamingHtml && isGenerating);
  const isStreamingActive = isGenerating && !!streamingHtml;

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (streamingHtml && isGenerating) {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewTimerRef.current = setTimeout(() => {
        setDebouncedPreviewHtml(streamingHtml);
      }, 1500);
    }
  }, [streamingHtml, isGenerating]);

  const updateBoard = useCallback((updates: Partial<StitchBoard>) => {
    if (!board) return;
    const updatedBoard = { ...board, ...updates, updatedAt: Date.now() };
    const updatedProject = { ...project, boards: [updatedBoard], updatedAt: Date.now() };
    onSave(updatedProject);
  }, [board, project, onSave]);

  const handleGenerate = async (prompt: string) => {
    setIsGenerating(true);
    setLastPrompt(prompt);
    setThinkingText('');
    setStreamingHtml('');
    setDebouncedPreviewHtml('');
    setThinkingExpanded(true);

    const activeModel = models?.find(m => m.id === selectedModelId) || modelConfig;
    const isReasoning = activeModel?.isReasoning || false;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const stream = generateHTMLStream(
        project.title,
        layout,
        prompt,
        activeModel?.apiModelId || activeModel?.id,
        activeModel?.provider,
        isReasoning,
        abortController.signal,
      );

      let fullHtml = '';
      let fullThinking = '';

      for await (const chunk of stream) {
        if (chunk.thinkingText) {
          fullThinking += chunk.thinkingText;
          setThinkingText(fullThinking);
        }
        if (chunk.htmlChunk) {
          fullHtml += chunk.htmlChunk;
          setStreamingHtml(fullHtml);
        }
      }

      let finalHtml = fullHtml.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim();

      if (!finalHtml || !finalHtml.includes('<!DOCTYPE')) {
        onNotification?.('Failed to generate valid HTML', 'error');
        return;
      }

      setGeneratedHtml(finalHtml);
      setDebouncedPreviewHtml(finalHtml);
      setViewMode('preview');
      updateBoard({ generatedHtml: finalHtml });
      onNotification?.('HTML generated successfully', 'success');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        onNotification?.('Generation cancelled', 'error');
      } else {
        onNotification?.(err.message || 'Failed to generate HTML', 'error');
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
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

  const handleDownload = () => {
    if (!generatedHtml) return;
    const blob = new Blob([generatedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, '-').toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!generatedHtml) return;
    navigator.clipboard.writeText(generatedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBackToFullConfig = () => {
    setGeneratedHtml('');
    setStreamingHtml('');
    setDebouncedPreviewHtml('');
    setThinkingText('');
    updateBoard({ generatedHtml: undefined });
  };

  const handleExport = useCallback(() => {
    handleDownload();
  }, [generatedHtml, project.title]);

  React.useEffect(() => {
    if (!onControlsChange) return;
    onControlsChange({
      onExport: handleExport,
      isGenerating,
      hasHtml: !!generatedHtml,
      projectTitle: project.title,
    });
  }, [generatedHtml, isGenerating, project.title, onControlsChange, handleExport]);

  React.useEffect(() => {
    return () => { onControlsChange?.(null); };
  }, [onControlsChange]);

  const dims = getLayoutDimensions(layout);
  const aspectRatio = dims.width / dims.height;
  const showThinking = (isGenerating || thinkingText) && (thinkingText || streamingHtml);
  const displayHtml = generatedHtml || (isGenerating ? debouncedPreviewHtml : '');

  // Full-screen layout (before first generation)
  if (!hasGenerated && !generatedHtml) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6">
          {/* Project title + layout badge */}
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-100)' }}>{project.title}</h2>
            <span
              className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-medium"
              style={{
                backgroundColor: 'rgba(var(--neon-rgb), 0.1)',
                color: 'var(--neon-color)',
                border: '1px solid rgba(var(--neon-rgb), 0.2)',
              }}
            >
              {LAYOUT_LABELS[layout] || layout}
            </span>
          </div>

          {/* Prompt bar (chip categories stacked vertically) */}
          <div
            className="rounded-2xl p-5"
            style={{
              backgroundColor: 'var(--bg-200)',
              border: '1px solid var(--border-300)',
            }}
          >
            <StitchPromptBar
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              theme={theme}
              models={models}
              selectedModelId={selectedModelId}
              onModelChange={setSelectedModelId}
            />
          </div>

          {/* Back button */}
          <div className="text-center">
            <button
              onClick={onBack}
              className="text-xs transition-colors"
              style={{ color: 'var(--text-500)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-300)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-500)'; }}
            >
              Back to projects
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Sidebar + preview layout (after first generation)
  return (
    <div className="flex h-full w-full">
      {/* Sidebar */}
      <div
        className="flex flex-col flex-shrink-0 w-[288px] h-full overflow-hidden"
        style={{
          borderRight: '1px solid var(--border-300)',
          backgroundColor: 'var(--bg-200)',
        }}
      >
        {/* Sidebar header */}
        <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-300)' }}>
          <button
            onClick={handleBackToFullConfig}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-500)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-300)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-100)' }}>{project.title}</h3>
          </div>
          <span
            className="px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
            style={{
              backgroundColor: 'rgba(var(--neon-rgb), 0.1)',
              color: 'var(--neon-color)',
              border: '1px solid rgba(var(--neon-rgb), 0.2)',
            }}
          >
            {LAYOUT_LABELS[layout] || layout}
          </span>
        </div>

        {/* Scrollable chip categories */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <StitchPromptBar
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            theme={theme}
            models={models}
            selectedModelId={selectedModelId}
            onModelChange={setSelectedModelId}
          />
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Preview toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-300)' }}>
          <button
            onClick={() => setViewMode(viewMode === 'preview' ? 'source' : 'preview')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
            style={{
              backgroundColor: 'var(--bg-200)',
              color: 'var(--text-300)',
              border: '1px solid var(--border-300)',
            }}
          >
            {viewMode === 'preview' ? <Code size={12} /> : <Eye size={12} />}
            {viewMode === 'preview' ? 'Source' : 'Preview'}
          </button>

          <div className="flex-1" />

          {!isGenerating && lastPrompt && (
            <button
              onClick={handleRegenerate}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
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
          {isGenerating && (
            <button
              onClick={handleStopGeneration}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
              style={{
                backgroundColor: 'rgba(239,68,68,0.15)',
                color: '#f87171',
                border: '1px solid rgba(239,68,68,0.3)',
              }}
            >
              Stop
            </button>
          )}
          {generatedHtml && !isGenerating && (
            <>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
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
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                style={{
                  backgroundColor: 'rgba(var(--neon-rgb), 0.15)',
                  color: 'var(--neon-color)',
                  border: '1px solid rgba(var(--neon-rgb), 0.3)',
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </>
          )}
        </div>

        {/* Thinking panel */}
        {showThinking && (
          <div
            className="flex-shrink-0 mx-4 mt-3 rounded-xl overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-200)',
              border: '1px solid var(--border-300)',
            }}
          >
            <button
              onClick={() => setThinkingExpanded(!thinkingExpanded)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
              style={{ color: 'var(--text-300)' }}
            >
              <Brain size={14} style={{ color: 'var(--neon-color)' }} />
              <span className="text-[11px] font-semibold flex-1">Thinking</span>
              {isGenerating && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--neon-color)' }} />}
              {thinkingExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            {thinkingExpanded && thinkingText && (
              <div
                className="px-3 pb-3 max-h-40 overflow-y-auto text-[11px] font-mono leading-relaxed"
                style={{ color: 'var(--text-500)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {thinkingText}
              </div>
            )}
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-hidden flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-100)' }}>
          {displayHtml ? (
            viewMode === 'preview' ? (
              <div
                className="w-full h-full max-w-full overflow-hidden rounded-xl"
                style={{
                  aspectRatio: `${aspectRatio}`,
                  maxHeight: '100%',
                  maxWidth: `min(100%, ${100 * aspectRatio}vh)`,
                  boxShadow: '0 4px 30px rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-300)',
                }}
              >
                <iframe
                  className="w-full h-full border-0"
                  style={{ backgroundColor: '#fff' }}
                  sandbox="allow-scripts"
                  srcDoc={displayHtml}
                  title="HTML Preview"
                />
              </div>
            ) : (
              <pre
                className="w-full h-full rounded-xl p-4 overflow-auto text-xs font-mono"
                style={{
                  backgroundColor: 'var(--bg-100)',
                  border: '1px solid var(--border-300)',
                  color: 'var(--text-300)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {streamingHtml || generatedHtml}
              </pre>
            )
          ) : isGenerating ? (
            <div className="text-center py-20">
              <div
                className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'rgba(var(--neon-rgb), 0.1)' }}
              >
                <Loader2 size={28} className="animate-spin" style={{ color: 'var(--neon-color)' }} />
              </div>
              <p className="text-sm mb-1" style={{ color: 'var(--text-300)' }}>Generating HTML...</p>
              <p className="text-xs" style={{ color: 'var(--text-500)' }}>The AI is building your design</p>
            </div>
          ) : (
            <div className="text-center py-20">
              <div
                className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'rgba(var(--neon-rgb), 0.1)' }}
              >
                <Eye size={28} style={{ color: 'var(--text-500)' }} />
              </div>
              <p className="text-sm mb-1" style={{ color: 'var(--text-300)' }}>No design generated yet</p>
              <p className="text-xs" style={{ color: 'var(--text-500)' }}>Use the sidebar to configure and generate</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StitchEditor;
