import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Plus, X, Code, Eye, Undo2, Redo2, Maximize2, Minimize2, Play, Square, Terminal } from 'lucide-react';
import { LibraryComponent, LibraryComponentFile } from '../../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CodeEditor } from '@/components/ui/code-editor-sheet';
import { ACE_LANG_MAP, deriveContentType, getFileIcon, buildPreviewHtml, buildThemePreviewHtml } from './constants';

export interface LibraryControls {
  componentName: string;
  componentDescription: string;
  componentTags: string[];
  componentId: string;
  componentCategory: string;
  onBack: () => void;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  files: LibraryComponentFile[];
  activeFileId: string | null;
  onSelectFile: (fileId: string) => void;
  onAddFile: () => void;
  onDeleteFile: (fileId: string) => void;
  viewMode: 'code' | 'preview';
  onViewModeChange: (mode: 'code' | 'preview') => void;
  onUndoAgent: () => void;
  onRedoAgent: () => void;
  canUndoAgent: boolean;
  canRedoAgent: boolean;
}

interface ComponentEditorProps {
  selectedComponent: LibraryComponent;
  setSelectedComponent: (comp: LibraryComponent | null) => void;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  onControlsChange?: (controls: LibraryControls | null) => void;
  onComponentsReload: () => void;
}

export const ComponentEditor: React.FC<ComponentEditorProps> = ({
  selectedComponent,
  setSelectedComponent,
  onNotification,
  onControlsChange,
  onComponentsReload,
}) => {
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [editFiles, setEditFiles] = useState<LibraryComponentFile[]>([]);
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
  const [showAddFileDialog, setShowAddFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [deleteFileDialog, setDeleteFileDialog] = useState<string | null>(null);
  const [agentChangedFileIds, setAgentChangedFileIds] = useState<Set<string>>(new Set());
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [pythonOutput, setPythonOutput] = useState<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean } | null>(null);
  const [pythonRunning, setPythonRunning] = useState(false);
  const [pythonRequirements, setPythonRequirements] = useState('');
  const pythonAbortRef = useRef<AbortController | null>(null);
  const editorRef = useRef<any>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const previewErrorsRef = useRef<{ errors: string[]; loadErrors: string[]; complete: boolean }>({ errors: [], loadErrors: [], complete: false });
  const agentHistoryRef = useRef<LibraryComponentFile[][]>([]);
  const agentFutureRef = useRef<LibraryComponentFile[][]>([]);

  const activeFile = useMemo(() => editFiles.find(f => f.id === activeFileId) || null, [editFiles, activeFileId]);
  const [previewHtml, setPreviewHtml] = useState('');
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      const builder = selectedComponent?.category === 'theme' ? buildThemePreviewHtml : buildPreviewHtml;
      setPreviewHtml(builder(editFiles, selectedComponent?.id, isDark));
    }, 400);
    return () => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); };
  }, [editFiles, selectedComponent?.id, isDark]);

  useEffect(() => {
    setPreviewErrors([]);
  }, [previewHtml]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleUndoAgent = () => {
    if (agentHistoryRef.current.length === 0) return;
    const prev = agentHistoryRef.current.pop()!;
    agentFutureRef.current.push(editFiles.map(f => ({ ...f })));
    setEditFiles(prev);
    setIsDirty(true);
    onNotification?.('Undone', 'success');
  };

  const handleRedoAgent = () => {
    if (agentFutureRef.current.length === 0) return;
    const next = agentFutureRef.current.pop()!;
    agentHistoryRef.current.push(editFiles.map(f => ({ ...f })));
    setEditFiles(next);
    setIsDirty(true);
    onNotification?.('Redone', 'success');
  };

  const handleRunPython = useCallback(async () => {
    if (!activeFile || activeFile.contentType !== 'python' || pythonRunning) return;
    const controller = new AbortController();
    pythonAbortRef.current = controller;
    setPythonRunning(true);
    setPythonOutput(null);
    try {
      const reqs = pythonRequirements
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const res = await fetch('/api/python/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: activeFile.content, requirements: reqs.length > 0 ? reqs : undefined }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        setPythonOutput({ stdout: '', stderr: err.error || 'Request failed', exitCode: 1, timedOut: false });
      } else {
        const data = await res.json();
        setPythonOutput(data);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setPythonOutput({ stdout: '', stderr: 'Execution cancelled', exitCode: 130, timedOut: false });
      } else {
        setPythonOutput({ stdout: '', stderr: err.message, exitCode: 1, timedOut: false });
      }
    } finally {
      pythonAbortRef.current = null;
      setPythonRunning(false);
    }
  }, [activeFile, pythonRunning, pythonRequirements]);

  const handleStopPython = useCallback(() => {
    pythonAbortRef.current?.abort();
    setPythonRunning(false);
  }, []);

  useEffect(() => {
    if (!onControlsChange) return;
    onControlsChange({
      componentName: selectedComponent.name,
      componentDescription: selectedComponent.description,
      componentTags: selectedComponent.tags,
      componentId: selectedComponent.id,
      componentCategory: selectedComponent.category,
      onBack: () => setSelectedComponent(null),
      isDirty,
      isSaving,
      onSave: handleSaveFiles,
      files: editFiles,
      activeFileId,
      onSelectFile: (fileId: string) => {
        setActiveFileId(fileId);
        setViewMode('code');
        if (!openFileIds.includes(fileId)) {
          setOpenFileIds(prev => [...prev, fileId]);
        }
      },
      onAddFile: () => setShowAddFileDialog(true),
      onDeleteFile: (fileId: string) => setDeleteFileDialog(fileId),
      viewMode,
      onViewModeChange: setViewMode,
      onUndoAgent: handleUndoAgent,
      onRedoAgent: handleRedoAgent,
      canUndoAgent: agentHistoryRef.current.length > 0,
      canRedoAgent: agentFutureRef.current.length > 0,
    });
  }, [selectedComponent, isDirty, isSaving, onControlsChange, editFiles, activeFileId, viewMode, openFileIds, handleUndoAgent, handleRedoAgent]);

  useEffect(() => {
    return () => { onControlsChange?.(null); };
  }, [onControlsChange]);

  useEffect(() => {
    if (selectedComponent?.files) {
      setEditFiles([...selectedComponent.files]);
      setOpenFileIds(selectedComponent.files.map(f => f.id));
      setActiveFileId(selectedComponent.files.find(f => f.isEntry)?.id || selectedComponent.files[0]?.id || null);
      setIsDirty(false);
      setViewMode('code');
    }
  }, [selectedComponent]);

  useEffect(() => {
    const handler = ((e: CustomEvent) => {
      if (e.detail.componentId !== selectedComponent?.id) return;
      const newFiles = e.detail.files as LibraryComponentFile[];
      if (!newFiles) return;

      const changedIds = new Set<string>();
      for (const newFile of newFiles) {
        const oldFile = editFiles.find(f => f.id === newFile.id);
        if (!oldFile || oldFile.content !== newFile.content) {
          changedIds.add(newFile.id);
        }
      }

      agentHistoryRef.current.push(editFiles.map(f => ({ ...f })));
      if (agentHistoryRef.current.length > 50) agentHistoryRef.current.shift();
      agentFutureRef.current = [];

      setEditFiles(newFiles);
      setOpenFileIds(prev => {
        const newIds = newFiles.map(f => f.id);
        return [...new Set([...prev, ...newIds])];
      });
      setIsDirty(false);

      const addedFiles = newFiles.filter(f => !editFiles.find(ef => ef.id === f.id));
      if (addedFiles.length > 0) {
        setActiveFileId(addedFiles[0].id);
      }

      setAgentChangedFileIds(changedIds);
      setTimeout(() => setAgentChangedFileIds(new Set()), 3000);
    }) as EventListener;

    window.addEventListener('agent-file-changed', handler);
    return () => window.removeEventListener('agent-file-changed', handler);
  }, [selectedComponent?.id, editFiles]);

  useEffect(() => {
    if (!editorRef.current || !activeFileId || !agentChangedFileIds.has(activeFileId)) return;
    const editor = editorRef.current;
    const model = editor.getModel?.();
    if (!model) return;

    const lineCount = model.getLineCount?.() || 0;
    const decorations = Array.from({ length: lineCount }, (_, i) => ({
      range: { startLineNumber: i + 1, startColumn: 1, endLineNumber: i + 1, endColumn: 1 },
      options: {
        isWholeLine: true,
        className: 'agent-changed-line',
        overviewRuler: { color: 'rgba(var(--neon-rgb), 0.5)', position: 1 },
      },
    }));

    const decIds = editor.deltaDecorations?.([], decorations) || [];
    const timer = setTimeout(() => {
      editor.deltaDecorations?.(decIds, []);
    }, 3000);

    return () => clearTimeout(timer);
  }, [agentChangedFileIds, activeFileId]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type !== 'preview-errors') return;
      const errors = [...(e.data.errors || []), ...(e.data.loadErrors || []).map((e: string) => '[Package] ' + e)];
      previewErrorsRef.current = {
        errors: e.data.errors || [],
        loadErrors: e.data.loadErrors || [],
        complete: !!e.data.complete,
      };
      setPreviewErrors(errors);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.componentId !== selectedComponent?.id) return;

      if (viewMode !== 'preview') {
        setViewMode('preview');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      previewErrorsRef.current = { errors: [], loadErrors: [], complete: false };
      await new Promise(resolve => setTimeout(resolve, 8000));

      try {
        const { errors: renderErrors, loadErrors } = previewErrorsRef.current;
        const errors: string[] = [
          ...renderErrors,
          ...loadErrors.map((e: string) => '[Package] ' + e),
        ];
        window.dispatchEvent(new CustomEvent('agent-verify-result', {
          detail: { success: errors.length === 0, errors },
        }));
      } catch (err: any) {
        window.dispatchEvent(new CustomEvent('agent-verify-result', {
          detail: { success: false, errors: [err.message] },
        }));
      }
    };

    window.addEventListener('agent-verify-component', handler);
    return () => window.removeEventListener('agent-verify-component', handler);
  }, [selectedComponent?.id, viewMode]);

  const handleFileContentChange = (fileId: string, newContent: string) => {
    setEditFiles(prev => prev.map(f => f.id === fileId ? { ...f, content: newContent } : f));
    setIsDirty(true);
  };

  const handleSaveFiles = async () => {
    if (!selectedComponent) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/library/components/${selectedComponent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: editFiles.map(f => ({
            filename: f.filename,
            contentType: f.contentType,
            content: f.content,
            sortOrder: f.sortOrder,
            isEntry: f.isEntry,
          })),
        }),
      });
      if (!response.ok) throw new Error('Failed to save');
      const data = await response.json();
      setSelectedComponent(data.component);
      setEditFiles(data.component.files || []);
      setIsDirty(false);
      onNotification?.('Saved', 'success');
      onComponentsReload();
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddFile = () => {
    if (!newFileName.trim()) return;
    const id = Math.random().toString(36).slice(2);
    const newFile: LibraryComponentFile = {
      id,
      componentId: selectedComponent?.id || '',
      filename: newFileName.trim(),
      contentType: deriveContentType(newFileName.trim()) as any,
      content: '',
      sortOrder: editFiles.length,
      isEntry: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEditFiles(prev => [...prev, newFile]);
    setOpenFileIds(prev => [...prev, id]);
    setActiveFileId(id);
    setIsDirty(true);
    setShowAddFileDialog(false);
    setNewFileName('');
  };

  const handleCloseTab = (fileId: string) => {
    setOpenFileIds(prev => {
      const remaining = prev.filter(id => id !== fileId);
      if (remaining.length === 0) return prev;
      if (activeFileId === fileId) {
        setActiveFileId(remaining[0]);
      }
      return remaining;
    });
  };

  const handleDeleteFile = (fileId: string) => {
    setEditFiles(prev => {
      const remaining = prev.filter(f => f.id !== fileId);
      if (remaining.length === 0) return prev;
      if (activeFileId === fileId) {
        setActiveFileId(remaining[0].id);
      }
      return remaining;
    });
    setOpenFileIds(prev => prev.filter(id => id !== fileId));
    setIsDirty(true);
    setDeleteFileDialog(null);
  };

  const handleSetEntryFile = (fileId: string) => {
    setEditFiles(prev => prev.map(f => ({ ...f, isEntry: f.id === fileId })));
    setIsDirty(true);
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-hidden">
      {/* File Tabs */}
      <div className="flex items-center gap-1 flex-shrink-0 overflow-x-auto pb-1" style={{ borderBottom: '1px solid var(--border-300)' }}>
        {openFileIds.map(fileId => {
          const file = editFiles.find(f => f.id === fileId);
          if (!file) return null;
          return (
            <div
              key={file.id}
              className="flex items-center gap-1.5 cursor-pointer transition-colors group/tab"
              onClick={() => setActiveFileId(file.id)}
              onDoubleClick={() => handleSetEntryFile(file.id)}
              title={file.isEntry ? 'Entry file (double-click another to change)' : 'Double-click to set as entry'}
              style={{
                padding: '6px 12px',
                borderRadius: '8px 8px 0 0',
                backgroundColor: activeFileId === file.id ? 'var(--bg-200)' : 'transparent',
                color: activeFileId === file.id ? 'var(--neon-color)' : 'var(--text-500)',
                borderBottom: activeFileId === file.id ? '2px solid var(--neon-color)' : '2px solid transparent',
                fontSize: '13px',
                whiteSpace: 'nowrap',
                boxShadow: agentChangedFileIds.has(file.id) ? '0 0 12px rgba(var(--neon-rgb), 0.4), inset 0 0 8px rgba(var(--neon-rgb), 0.1)' : 'none',
                transition: 'box-shadow 0.3s ease',
              }}
            >
              {getFileIcon(file.filename)}
              <span>{file.filename}</span>
              {file.isEntry && <span className="text-[9px] px-1 rounded" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.15)', color: 'var(--neon-color)' }}>entry</span>}
              {isDirty && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f59e0b' }} />}
              <button
                onClick={(e) => { e.stopPropagation(); handleCloseTab(file.id); }}
                className="ml-1 opacity-0 group-hover/tab:opacity-100 transition-opacity"
                style={{ color: 'var(--text-500)' }}
                title="Close tab"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
        <button
          onClick={() => setShowAddFileDialog(true)}
          className="flex items-center justify-center transition-colors"
          style={{
            padding: '6px 8px',
            borderRadius: '8px',
            color: 'var(--text-500)',
            fontSize: '13px',
          }}
          title="Add file"
        >
          <Plus size={14} />
        </button>

        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setViewMode(v => v === 'code' ? 'preview' : 'code')}
            style={{ color: 'var(--text-300)' }}
          >
            {viewMode === 'code' ? <Eye size={12} /> : <Code size={12} />}
            {viewMode === 'code' ? 'Preview' : 'Code'}
          </Button>
        </div>
      </div>

      {/* Editor + Preview Split */}
      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
        {viewMode === 'code' ? (
          <div className="flex-1 flex flex-col min-w-0 rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}>
            {activeFile ? (
              <>
                <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-300)' }}>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0.5 font-mono uppercase"
                      style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}
                    >
                      {activeFile.contentType}
                    </Badge>
                    {activeFile.isEntry && (
                      <Badge
                        className="text-[10px] px-1.5 py-0.5"
                        style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.15)', color: 'var(--neon-color)' }}
                      >
                        entry
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => editorRef.current?.undo()}
                      className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                      style={{ color: 'var(--text-500)' }}
                      title="Undo (Ctrl+Z)"
                    >
                      <Undo2 size={12} />
                    </button>
                    <button
                      onClick={() => editorRef.current?.redo()}
                      className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                      style={{ color: 'var(--text-500)' }}
                      title="Redo (Ctrl+Shift+Z)"
                    >
                      <Redo2 size={12} />
                    </button>
                    {activeFile.contentType === 'python' && (
                      <button
                        onClick={pythonRunning ? handleStopPython : handleRunPython}
                        className="p-1.5 rounded-lg transition-colors hover:opacity-80 ml-1"
                        style={{ color: pythonRunning ? '#ef4444' : 'var(--neon-color)' }}
                        title={pythonRunning ? 'Stop' : 'Run Python'}
                      >
                        {pythonRunning ? <Square size={12} /> : <Play size={12} />}
                      </button>
                    )}
                    {!activeFile.isEntry && (
                      <button
                        onClick={() => handleSetEntryFile(activeFile.id)}
                        className="text-xs px-2 py-1 rounded-lg transition-colors hover:opacity-80 ml-1"
                        style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.1)', color: 'var(--neon-color)' }}
                      >
                        Set as entry
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 relative min-h-0">
                  <CodeEditor
                    language={ACE_LANG_MAP[activeFile.contentType] || 'html'}
                    value={activeFile.content}
                    onChange={(val) => handleFileContentChange(activeFile.id, val)}
                    onLoad={(editor) => { editorRef.current = editor; }}
                    className="absolute inset-0"
                  />
                </div>
                {activeFile.contentType === 'python' && (pythonOutput || pythonRunning) && (
                  <div className="flex-shrink-0 flex flex-col" style={{ maxHeight: '40%', borderTop: '1px solid var(--border-300)' }}>
                    <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0" style={{ backgroundColor: '#0d1117', borderBottom: '1px solid #21262d' }}>
                      <div className="flex items-center gap-1.5">
                        <Terminal size={11} style={{ color: '#8b949e' }} />
                        <span className="text-[11px] font-medium" style={{ color: '#8b949e' }}>Output</span>
                        {pythonRunning && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.15)', color: 'var(--neon-color)' }}>
                            running...
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={pythonRequirements}
                          onChange={e => setPythonRequirements(e.target.value)}
                          placeholder="pip packages (comma-separated)"
                          className="text-[11px] px-2 py-0.5 rounded outline-none"
                          style={{ backgroundColor: '#161b22', border: '1px solid #30363d', color: '#c9d1d9', width: '200px' }}
                          title="Enter pip package names separated by commas"
                        />
                        {pythonOutput && (
                          <span className="text-[10px]" style={{ color: pythonOutput.exitCode === 0 ? '#3fb950' : '#f85149' }}>
                            exit {pythonOutput.exitCode}
                            {pythonOutput.timedOut ? ' (timed out)' : ''}
                          </span>
                        )}
                        <button
                          onClick={() => { setPythonOutput(null); }}
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ color: '#8b949e', backgroundColor: 'rgba(255,255,255,0.05)' }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="overflow-auto p-3" style={{ backgroundColor: '#0d1117' }}>
                      {pythonOutput?.stdout && (
                        <pre className="text-xs whitespace-pre-wrap mb-2" style={{ color: '#c9d1d9', fontFamily: "'JetBrains Mono', monospace" }}>
                          {pythonOutput.stdout}
                        </pre>
                      )}
                      {pythonOutput?.stderr && (
                        <pre className="text-xs whitespace-pre-wrap" style={{ color: '#f85149', fontFamily: "'JetBrains Mono', monospace" }}>
                          {pythonOutput.stderr}
                        </pre>
                      )}
                      {pythonRunning && !pythonOutput && (
                        <div className="flex items-center gap-2 py-2">
                          <div className="w-3 h-3 rounded-full animate-spin" style={{ border: '2px solid #30363d', borderTopColor: 'var(--neon-color)' }} />
                          <span className="text-xs" style={{ color: '#8b949e' }}>Executing...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-500)' }}>
                <p className="text-sm">No file selected</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-w-0 rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}>
            <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-300)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--text-500)' }}>Live Preview</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="p-1 rounded-md transition-colors hover:bg-[var(--bg-300)]"
                  style={{ color: 'var(--text-500)' }}
                  title="Fullscreen preview"
                >
                  <Maximize2 size={13} />
                </button>
                {editFiles.filter(f => f.contentType === 'css').length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}>
                    +{editFiles.filter(f => f.contentType === 'css').length} CSS
                  </Badge>
                )}
                {editFiles.filter(f => f.contentType === 'js').length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}>
                    +{editFiles.filter(f => f.contentType === 'js').length} JS
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 flex items-center justify-center min-h-0 overflow-auto p-4" style={{ backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }}>
                {previewHtml ? (
                  <iframe
                    ref={previewIframeRef}
                    srcDoc={previewHtml}
                    sandbox="allow-scripts"
                    className="w-full h-full border-0 rounded-lg"
                    style={{ maxWidth: '100%', maxHeight: '100%', boxShadow: '0 4px 30px rgba(0,0,0,0.2)' }}
                    title="Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center" style={{ color: 'var(--text-500)' }}>
                    <p className="text-sm">No previewable content</p>
                  </div>
                )}
              </div>
              {previewErrors.length > 0 && (
                <div
                  className="flex-shrink-0 overflow-auto"
                  style={{
                    maxHeight: '40%',
                    backgroundColor: '#1a1a2e',
                    borderTop: '1px solid #333',
                    padding: '12px 16px',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold" style={{ color: '#fca5a5' }}>
                      {previewErrors.length} error{previewErrors.length > 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => setPreviewErrors([])}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ color: '#888', backgroundColor: 'rgba(255,255,255,0.05)' }}
                    >
                      Dismiss
                    </button>
                  </div>
                  {previewErrors.map((err, i) => (
                    <pre
                      key={i}
                      className="text-xs whitespace-pre-wrap mb-1"
                      style={{ color: '#f87171', fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {err}
                    </pre>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Preview Overlay */}
      {isFullscreen && previewHtml && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }}>
          <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{ backgroundColor: 'var(--bg-100)', borderBottom: '1px solid var(--border-300)' }}>
            <div className="flex items-center gap-2">
              <Eye size={14} style={{ color: 'var(--neon-color)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>{selectedComponent.name}</span>
              <Badge variant="secondary" className="text-[10px]" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}>Preview</Badge>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-300)]"
              style={{ color: 'var(--text-500)' }}
              title="Exit fullscreen"
            >
              <Minimize2 size={16} />
            </button>
          </div>
          <iframe
            srcDoc={previewHtml}
            sandbox="allow-scripts"
            className="flex-1 w-full border-0"
            title="Fullscreen Preview"
          />
        </div>
      )}

      {/* Metadata */}
      {selectedComponent.metadata && Object.keys(selectedComponent.metadata).length > 0 && (
        <Card className="flex-shrink-0" style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
          <CardContent className="p-3">
            <span className="text-sm font-semibold block mb-2" style={{ color: 'var(--text-500)' }}>Metadata</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(selectedComponent.metadata).map(([key, value]) => (
                <Badge key={key} variant="secondary" className="text-xs" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}>
                  {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add File Dialog */}
      <Dialog open={showAddFileDialog} onOpenChange={setShowAddFileDialog}>
        <DialogContent style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--text-100)' }}>Add File</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-500)' }}>Filename</Label>
              <Input
                type="text"
                value={newFileName}
                onChange={e => setNewFileName(e.target.value)}
                placeholder="e.g. utils.js"
                className="text-sm font-mono"
                style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
                onKeyDown={e => e.key === 'Enter' && handleAddFile()}
                autoFocus
              />
              {newFileName.includes('.') && (
                <p className="text-xs" style={{ color: 'var(--text-500)' }}>
                  Type: <span style={{ color: 'var(--neon-color)' }}>{deriveContentType(newFileName)}</span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddFile} disabled={!newFileName.trim() || !newFileName.includes('.')} style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}>
                Add
              </Button>
              <Button variant="secondary" onClick={() => { setShowAddFileDialog(false); setNewFileName(''); }} style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-300)' }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete File Confirm Dialog */}
      <Dialog open={!!deleteFileDialog} onOpenChange={() => setDeleteFileDialog(null)}>
        <DialogContent style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--text-100)' }}>Delete File</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--text-500)' }}>
            Are you sure you want to delete <strong style={{ color: 'var(--text-100)' }}>{editFiles.find(f => f.id === deleteFileDialog)?.filename}</strong>?
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => deleteFileDialog && handleDeleteFile(deleteFileDialog)}
              style={{ backgroundColor: '#ef4444', color: '#fff' }}
            >
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setDeleteFileDialog(null)} style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-300)' }}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
