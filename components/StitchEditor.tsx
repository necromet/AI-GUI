import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Brain, Loader2, Send, Eye, Wrench, Check } from 'lucide-react';
import { StitchProject, StitchBoard, StitchLayout, ModelConfig } from '../types';
import { getLayoutDimensions } from '../services/stitchService';
import { sendAgentMessage, ToolResult } from '../services/agentService';
import * as db from '../services/databaseAdapter';
import StitchPromptBar from './StitchPromptBar';

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
  const abortControllerRef = useRef<AbortController | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; html?: string; thinking?: string; timestamp: number }>>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [sidebarInput, setSidebarInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(new Set());
  const [activeStyleChips, setActiveStyleChips] = useState<string[]>([]);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolResult[]>([]);
  const [editSummary, setEditSummary] = useState<string>('');

  const dims = getLayoutDimensions(layout);

  useEffect(() => {
    const restoreConversation = async () => {
      try {
        const stitchConvs = await db.getConversationsByType('stitch');
        const match = stitchConvs.find(c => c.title === project.title);
        if (match && match.conversation_id) {
          setConversationId(match.conversation_id);
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
    const newId = await db.createConversation(dbModel!.model_id!, project.title, 'stitch');
    setConversationId(newId);
    return newId;
  }, [conversationId, modelConfig, project.title]);

  const loadChatMessages = useCallback(async () => {
    if (!conversationId) {
      setChatMessages([]);
      return;
    }
    const messages = await db.getMessagesByConversation(conversationId);
    const chat: Array<{ role: 'user' | 'assistant'; content: string; html?: string; thinking?: string; timestamp: number }> = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'user') {
        chat.push({ role: 'user', content: msg.content, timestamp: msg.timestamp });
      } else if (msg.role === 'assistant') {
        try {
          const envelope = JSON.parse(msg.content);
          if (envelope.type === 'stitch_generation') {
            chat.push({ role: 'assistant', content: envelope.prompt || '', html: envelope.html || '', thinking: envelope.thinking || '', timestamp: msg.timestamp });
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
  }, [chatMessages]);

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
    const updatedProject = { ...project, boards: [updatedBoard], updatedAt: Date.now() };
    onSave(updatedProject);
  }, [board, project, onSave]);

  const handleGenerate = async (prompt: string) => {
    setIsGenerating(true);
    setLastPrompt(prompt);
    setThinkingText('');
    setStreamingHtml('');
    setActiveToolCalls([]);
    setEditSummary('');

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
    };
    if (generatedHtml) {
      context.currentHtml = generatedHtml;
    }

    let fullText = '';
    let fullThinking = '';
    let extractedHtml = '';
    const toolCalls: ToolResult[] = [];

    try {
      const stream = sendAgentMessage(
        [...history, { role: 'user', content: prompt }],
        ['edit_html', 'generate_html'],
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
          if (!extractedHtml) {
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
          const pending: ToolResult = { name: chunk.toolCall.name, input: chunk.toolCall.arguments, output: '' };
          toolCalls.push(pending);
          setActiveToolCalls([...toolCalls]);
        }
        if (chunk.toolResult) {
          const idx = toolCalls.findIndex(r => r.name === chunk.toolResult!.name && !r.output);
          if (idx >= 0) toolCalls[idx] = chunk.toolResult;
          setActiveToolCalls([...toolCalls]);

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
      }

      let finalHtml = extractedHtml;
      if (!finalHtml && fullText) {
        let cleaned = fullText.trim();
        const fenceMatch = cleaned.match(/```(?:html)?\s*\n?([\s\S]*?)```/);
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
          const convId = await ensureStitchConversation();
          const order1 = await db.getNextMessageOrder(convId);
          await db.addMessage(convId, 'user', prompt, order1);
          const envelope = JSON.stringify({ type: 'stitch_generation', html: finalHtml, thinking: fullThinking, prompt });
          const order2 = await db.getNextMessageOrder(convId);
          await db.addMessage(convId, 'assistant', envelope, order2);
          setChatMessages(prev => [
            ...prev,
            { role: 'user', content: prompt, timestamp: Date.now() },
            { role: 'assistant', content: prompt, html: finalHtml, thinking: fullThinking, timestamp: Date.now() },
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

  const handleExport = useCallback(() => {
    if (!generatedHtml) return;
    const blob = new Blob([generatedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, '-').toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generatedHtml, project.title]);

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

  const displayHtml = generatedHtml || (isGenerating ? streamingHtml : '');
  const showSidebar = !!displayHtml || chatMessages.length > 0;

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
        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {chatMessages.map((msg, idx) => (
            <div key={idx}>
              {msg.role === 'user' ? (
                <div
                  className="rounded-xl px-3 py-2.5 text-xs leading-relaxed"
                  style={{
                    backgroundColor: 'rgba(var(--neon-rgb), 0.1)',
                    color: 'var(--text-100)',
                    border: '1px solid rgba(var(--neon-rgb), 0.15)',
                  }}
                >
                  {msg.content}
                </div>
              ) : (
                <div
                  className="rounded-xl overflow-hidden cursor-pointer transition-all"
                  style={{
                    backgroundColor: generatedHtml === msg.html ? 'var(--bg-100)' : 'var(--bg-300)',
                    border: generatedHtml === msg.html
                      ? '1px solid rgba(var(--neon-rgb), 0.3)'
                      : '1px solid var(--border-300)',
                  }}
                  onClick={() => {
                    if (msg.html) {
                      setGeneratedHtml(msg.html);
                      setViewMode('preview');
                    }
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.3)'; }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = generatedHtml === msg.html
                      ? 'rgba(var(--neon-rgb), 0.3)' : 'var(--border-300)';
                  }}
                >
                  {msg.thinking && (
                    <div style={{ borderBottom: '1px solid var(--border-300)' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
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
                        <span className="text-xs font-semibold flex-1">Thinking</span>
                        {expandedThinking.has(idx) ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                      </button>
                      {expandedThinking.has(idx) && (
                        <div
                          className="px-3 pb-2 max-h-32 overflow-y-auto text-xs font-mono leading-relaxed"
                          style={{ color: 'var(--text-500)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                        >
                          {msg.thinking}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="px-3 py-2.5">
                    <p className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>
                      {msg.html === generatedHtml ? 'Current Design' : 'Generated HTML'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-500)' }}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isGenerating && (
            <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: 'var(--bg-300)', border: '1px solid var(--border-300)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Loader2 size={12} className="animate-spin" style={{ color: 'var(--neon-color)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>
                  {activeToolCalls.length > 0
                    ? activeToolCalls[activeToolCalls.length - 1].name === 'edit_html'
                      ? 'Applying edits...'
                      : 'Generating HTML...'
                    : streamingHtml ? 'Processing...' : 'Waiting for AI response...'}
                </span>
              </div>
              {activeToolCalls.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {activeToolCalls.map((tc, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
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
              {thinkingText && (
                <div className="mt-2" style={{ borderTop: '1px solid var(--border-300)', paddingTop: '6px' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Brain size={10} style={{ color: 'var(--neon-color)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-500)' }}>Thinking</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto text-xs font-mono leading-relaxed"
                    style={{ color: 'var(--text-500)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {thinkingText}
                  </div>
                </div>
              )}
              {streamingHtml && (
                <div className="mt-2" style={{ borderTop: '1px solid var(--border-300)', paddingTop: '6px' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Eye size={10} style={{ color: 'var(--neon-color)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-500)' }}>HTML Preview</span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-500)' }}>
                    {streamingHtml.length.toLocaleString()} characters
                  </p>
                </div>
              )}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Chat input — always visible */}
        <div className="flex-shrink-0 px-3 py-3" style={{ borderTop: '1px solid var(--border-300)' }}>
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{
              backgroundColor: 'var(--bg-100)',
              border: '1px solid var(--border-300)',
            }}
          >
            <input
              type="text"
              value={sidebarInput}
              onChange={(e) => setSidebarInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && sidebarInput.trim() && !isGenerating) {
                  e.preventDefault();
                  handleGenerate(sidebarInput.trim());
                  setSidebarInput('');
                }
              }}
              placeholder={chatMessages.length === 0 ? 'Describe your design...' : 'Modify the design...'}
              className="flex-1 bg-transparent text-xs outline-none"
              style={{ color: 'var(--text-100)' }}
              disabled={isGenerating}
            />
            <button
              onClick={() => {
                if (sidebarInput.trim() && !isGenerating) {
                  handleGenerate(sidebarInput.trim());
                  setSidebarInput('');
                }
              }}
              disabled={!sidebarInput.trim() || isGenerating}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              style={{ color: 'var(--neon-color)' }}
            >
              <Send size={14} />
            </button>
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
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StitchEditor;
