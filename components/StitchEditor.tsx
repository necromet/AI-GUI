import React, { useState, useCallback } from 'react';
import { Download, Copy, Check, Code, Eye, RotateCcw } from 'lucide-react';
import { StitchProject, StitchBoard, StitchLayout, ModelConfig } from '../types';
import { createNewBoard, getLayoutDimensions, generateHTML } from '../services/stitchService';
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
  onControlsChange?: (controls: StitchControls | null) => void;
}

const LAYOUT_OPTIONS: { value: StitchLayout; label: string; desc: string }[] = [
  { value: '16:9', label: '16:9', desc: 'Landscape' },
  { value: '1:1', label: '1:1', desc: 'Square' },
  { value: '9:16', label: '9:16', desc: 'Portrait' },
];

const StitchEditor: React.FC<StitchEditorProps> = ({ project, theme = 'dark', onNotification, onBack, onSave, modelConfig, onControlsChange }) => {
  const board = project.boards[0] || null;
  const [layout, setLayout] = useState<StitchLayout>(board?.layout || '16:9');
  const [generatedHtml, setGeneratedHtml] = useState<string>(board?.generatedHtml || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const [copied, setCopied] = useState(false);
  const [lastPrompt, setLastPrompt] = useState('');

  const updateBoard = useCallback((updates: Partial<StitchBoard>) => {
    if (!board) return;
    const updatedBoard = { ...board, ...updates, updatedAt: Date.now() };
    const updatedProject = { ...project, boards: [updatedBoard], updatedAt: Date.now() };
    onSave(updatedProject);
  }, [board, project, onSave]);

  const handleLayoutChange = (newLayout: StitchLayout) => {
    setLayout(newLayout);
    updateBoard({ layout: newLayout });
  };

  const handleGenerate = async (prompt: string) => {
    setIsGenerating(true);
    setLastPrompt(prompt);
    try {
      const html = await generateHTML(
        project.title,
        layout,
        prompt,
        modelConfig?.apiModelId || modelConfig?.id,
        modelConfig?.provider,
      );
      setGeneratedHtml(html);
      setViewMode('preview');
      updateBoard({ generatedHtml: html });
      onNotification?.('HTML generated successfully', 'success');
    } catch (err: any) {
      onNotification?.(err.message || 'Failed to generate HTML', 'error');
    } finally {
      setIsGenerating(false);
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

  return (
    <div className="flex flex-col h-full w-full">
      {/* Layout selector */}
      <div className="flex items-center justify-center gap-2 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-300)' }}>
        {LAYOUT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleLayoutChange(opt.value)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200"
            style={{
              backgroundColor: layout === opt.value ? 'rgba(var(--neon-rgb), 0.15)' : 'transparent',
              color: layout === opt.value ? 'var(--neon-color)' : 'var(--text-500)',
              border: layout === opt.value ? '1px solid rgba(var(--neon-rgb), 0.3)' : '1px solid transparent',
            }}
          >
            {opt.label}
            <span className="ml-1 text-[9px] opacity-60">{opt.desc}</span>
          </button>
        ))}

        {generatedHtml && (
          <>
            <div className="w-px h-4 mx-1" style={{ backgroundColor: 'var(--border-300)' }} />
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
            {lastPrompt && (
              <button
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-40"
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

      {/* Preview / Source area */}
      <div className="flex-1 overflow-hidden flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-100)' }}>
        {generatedHtml ? (
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
                srcDoc={generatedHtml}
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
              {generatedHtml}
            </pre>
          )
        ) : (
          <div className="text-center py-20">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(var(--neon-rgb), 0.1)' }}
            >
              <Eye size={28} style={{ color: 'var(--text-500)' }} />
            </div>
            <p className="text-sm mb-1" style={{ color: 'var(--text-300)' }}>No design generated yet</p>
            <p className="text-xs" style={{ color: 'var(--text-500)' }}>Use the prompt below to generate HTML</p>
          </div>
        )}
      </div>

      {/* Prompt bar */}
      <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border-300)', backgroundColor: 'var(--bg-100)' }}>
        <StitchPromptBar
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          theme={theme}
        />
      </div>
    </div>
  );
};

export default StitchEditor;
