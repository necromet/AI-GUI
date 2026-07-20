import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Terminal, Plus, Trash2, Play, Square, FileCode, X, Search, BookOpen, ChevronRight, Package, Loader2, Upload, Download, Eye, PanelLeft, ChevronDown, ChevronUp, MoreVertical } from 'lucide-react';
import { ModelConfig, LibraryComponent } from '../types';
import * as db from '../services/apiDatabaseAdapter';
import type { PythonProject, PythonProjectFile } from '../services/apiDatabaseAdapter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CodeEditor } from '@/components/ui/code-editor-sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

interface PythonExecutorPanelProps {
  theme?: 'dark' | 'light';
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  modelConfig?: ModelConfig;
  initialProjectId?: string;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

interface PythonOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  autoDetected?: string[];
  generatedFiles?: { filename: string; size: number }[];
}

interface UploadedFile {
  filename: string;
  size: number;
  uploadedAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileTypeIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['csv', 'xlsx', 'xls'].includes(ext)) return '📊';
  if (['pdf'].includes(ext)) return '📄';
  if (['doc', 'docx', 'rtf'].includes(ext)) return '📝';
  if (['txt', 'md', 'log'].includes(ext)) return '📃';
  if (['json', 'xml', 'yaml', 'yml'].includes(ext)) return '🔧';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp', 'webp'].includes(ext)) return '🖼️';
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return '📦';
  return '📎';
}

function parseCSV(content: string, delimiter: string): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < content.length && content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        current.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        current.push(field);
        field = '';
        if (current.length > 0 && !(current.length === 1 && current[0] === '')) {
          lines.push(current);
        }
        current = [];
        if (ch === '\r' && i + 1 < content.length && content[i + 1] === '\n') i++;
      } else {
        field += ch;
      }
    }
  }
  current.push(field);
  if (current.length > 0 && !(current.length === 1 && current[0] === '')) {
    lines.push(current);
  }
  return lines;
}

function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0] || '';
  const candidates = [',', '\t', ';', '|'];
  let best = ',';
  let bestCount = 0;
  for (const d of candidates) {
    const count = (firstLine.match(new RegExp(d === '|' ? '\\|' : d === '\t' ? '\t' : d, 'g')) || []).length;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

const PythonExecutorPanel: React.FC<PythonExecutorPanelProps> = ({
  theme = 'dark',
  onNotification,
  modelConfig,
  initialProjectId,
  isSidebarOpen,
  onToggleSidebar,
}) => {
  const [projects, setProjects] = useState<PythonProject[]>([]);
  const [activeProject, setActiveProject] = useState<PythonProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [files, setFiles] = useState<PythonProjectFile[]>([]);
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<PythonOutput | null>(null);
  const [requirements, setRequirements] = useState('');
  const [showAddFile, setShowAddFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryResults, setLibraryResults] = useState<LibraryComponent[]>([]);
  const [librarySearching, setLibrarySearching] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewingFile, setViewingFile] = useState<{ filename: string; type: string; content?: string; url?: string; extension?: string; size?: number; truncated?: boolean; message?: string } | null>(null);
  const [isLoadingView, setIsLoadingView] = useState(false);
  const [csvDelimiter, setCsvDelimiter] = useState<string>(',');
  const [csvPage, setCsvPage] = useState(0);
  const CSV_PAGE_SIZE = 100;

  const handleViewerClose = useCallback((open: boolean) => {
    if (!open) setViewingFile(null);
  }, []);

  const abortRef = useRef<AbortController | null>(null);
  const editorRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeFile = files[activeFileIdx] || null;

  const loadProjects = useCallback(async () => {
    try {
      const data = await db.getPythonProjects();
      setProjects(data);
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [onNotification]);

  const loadUploadedFiles = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/python/projects/${projectId}/files`);
      if (!res.ok) return;
      const data = await res.json();
      setUploadedFiles(data.files || []);
    } catch {}
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    if (initialProjectId && projects.length > 0 && !activeProject) {
      const project = projects.find(p => p.id === initialProjectId);
      if (project) openProject(project);
    }
  }, [initialProjectId, projects]);

  const openProject = (project: PythonProject) => {
    setActiveProject(project);
    setFiles(project.files.length > 0 ? project.files : [{ filename: 'main.py', content: '', isEntry: true }]);
    const entryIdx = project.files.findIndex(f => f.isEntry);
    setActiveFileIdx(entryIdx >= 0 ? entryIdx : 0);
    setIsDirty(false);
    setOutput(null);
    setRequirements(project.settings?.requirements?.join(', ') || '');
    loadUploadedFiles(project.id);
  };

  const handleCreateProject = async () => {
    const title = newProjectName.trim() || `Project ${Date.now().toString(36).slice(-4)}`;
    try {
      const project = await db.createPythonProject(title);
      setProjects(prev => [project, ...prev]);
      openProject(project);
      setIsCreating(false);
      setNewProjectName('');
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  const handleSaveProject = async () => {
    if (!activeProject) return;
    try {
      const reqs = requirements.split(',').map(s => s.trim()).filter(Boolean);
      const updated = await db.savePythonProject({
        id: activeProject.id,
        title: activeProject.title,
        description: activeProject.description,
        files,
        settings: { requirements: reqs.length > 0 ? reqs : undefined },
      });
      setActiveProject(updated);
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
      setIsDirty(false);
      onNotification?.('Saved', 'success');
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await db.deletePythonProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      if (activeProject?.id === id) {
        setActiveProject(null);
        setFiles([]);
      }
      onNotification?.('Project deleted', 'success');
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  const handleRun = async () => {
    if (!activeFile || isRunning || !activeProject) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);
    setOutput(null);
    try {
      const reqs = requirements.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/python/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activeFile.content,
          requirements: reqs.length > 0 ? reqs : undefined,
          projectId: activeProject.id,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        setOutput({ stdout: '', stderr: err.error || 'Request failed', exitCode: 1, timedOut: false });
      } else {
        const data = await res.json();
        setOutput(data);
        if (activeProject && data.generatedFiles && data.generatedFiles.length > 0) {
          loadUploadedFiles(activeProject.id);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setOutput({ stdout: '', stderr: 'Execution cancelled', exitCode: 130, timedOut: false });
      } else {
        setOutput({ stdout: '', stderr: err.message, exitCode: 1, timedOut: false });
      }
    } finally {
      abortRef.current = null;
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsRunning(false);
  };

  const handleFileContentChange = (content: string) => {
    setFiles(prev => prev.map((f, i) => i === activeFileIdx ? { ...f, content } : f));
    setIsDirty(true);
  };

  const handleAddFile = () => {
    const name = newFileName.trim();
    if (!name) return;
    const filename = name.endsWith('.py') ? name : name + '.py';
    setFiles(prev => [...prev, { filename, content: '', isEntry: false }]);
    setActiveFileIdx(files.length);
    setIsDirty(true);
    setShowAddFile(false);
    setNewFileName('');
  };

  const handleDeleteFile = (idx: number) => {
    if (files.length <= 1) return;
    setFiles(prev => prev.filter((_, i) => i !== idx));
    if (activeFileIdx >= files.length - 1) {
      setActiveFileIdx(Math.max(0, files.length - 2));
    }
    setIsDirty(true);
  };

  const handleSetEntry = (idx: number) => {
    setFiles(prev => prev.map((f, i) => ({ ...f, isEntry: i === idx })));
    setIsDirty(true);
  };

  const handleLibrarySearch = async () => {
    if (!librarySearch.trim()) return;
    setLibrarySearching(true);
    try {
      const res = await fetch('/api/library/components/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: librarySearch, topK: 10 }),
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setLibraryResults((data.components || []).filter((c: LibraryComponent) => c.category === 'python' || c.contentType === 'python'));
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    } finally {
      setLibrarySearching(false);
    }
  };

  const handleLoadFromLibrary = (comp: LibraryComponent) => {
    const content = comp.files?.find(f => f.isEntry)?.content || comp.content || '';
    const filename = comp.files?.find(f => f.isEntry)?.filename || `${comp.name.toLowerCase().replace(/\s+/g, '_')}.py`;
    setFiles(prev => [...prev, { filename, content, isEntry: false }]);
    setActiveFileIdx(files.length);
    setIsDirty(true);
    onNotification?.(`Loaded "${comp.name}" from library`, 'success');
  };

  const handleUploadFiles = async (uploadFiles: FileList | File[]) => {
    if (!activeProject || uploadFiles.length === 0) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      for (const file of Array.from(uploadFiles)) {
        formData.append('files', file);
      }
      const res = await fetch(`/api/python/projects/${activeProject.id}/files`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || 'Upload failed');
      }
      const data = await res.json();
      onNotification?.(`Uploaded ${data.files.length} file(s)`, 'success');
      loadUploadedFiles(activeProject.id);
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteUploadedFile = async (filename: string) => {
    if (!activeProject) return;
    try {
      const res = await fetch(`/api/python/projects/${activeProject.id}/files/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      onNotification?.(`Deleted "${filename}"`, 'success');
      loadUploadedFiles(activeProject.id);
      if (viewingFile?.filename === filename) setViewingFile(null);
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  const handleViewFile = async (filename: string) => {
    if (!activeProject) return;
    setIsLoadingView(true);
    setCsvPage(0);
    try {
      const res = await fetch(`/api/python/projects/${activeProject.id}/files/${encodeURIComponent(filename)}/view`);
      if (!res.ok) throw new Error('Failed to load file');
      const data = await res.json();
      setViewingFile({ filename, ...data });
      if (data.type === 'text' && filename.toLowerCase().endsWith('.csv') && data.content) {
        setCsvDelimiter(detectDelimiter(data.content));
      }
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    } finally {
      setIsLoadingView(false);
    }
  };

  const handleDownloadFile = (filename: string) => {
    if (!activeProject) return;
    window.open(`/api/python/projects/${activeProject.id}/files/${encodeURIComponent(filename)}/download`, '_blank');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleBackToGrid = () => {
    if (isDirty) {
      handleSaveProject().then(() => {
        setActiveProject(null);
        setFiles([]);
        setOutput(null);
        setUploadedFiles([]);
      });
    } else {
      setActiveProject(null);
      setFiles([]);
      setOutput(null);
      setUploadedFiles([]);
    }
  };

  if (!activeProject) {
    return (
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && onToggleSidebar && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleSidebar}
                className="h-8 w-8 flex-shrink-0 text-[var(--text-500)] hover:text-[var(--text-100)]"
              >
                <PanelLeft size={18} />
              </Button>
            )}
            <div className="p-2.5 rounded-xl" style={{ background: 'rgba(var(--neon-rgb), 0.1)', boxShadow: '0 0 20px rgba(var(--neon-rgb), 0.08)' }}>
              <Terminal size={22} style={{ color: 'var(--neon-color)' }} />
            </div>
            <div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-100)' }}>Python Executor</h2>
              <p className="text-xs" style={{ color: 'var(--text-500)' }}>Write, run, and debug Python code</p>
            </div>
          </div>
          <Button
            onClick={() => setIsCreating(true)}
            className="gap-2 rounded-xl"
            style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
          >
            <Plus size={16} />
            New Project
          </Button>
        </div>

        {isCreating && (
          <Card className="rounded-2xl animate-fade-in" style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-100)' }}>Create New Project</h3>
              <p className="text-xs mb-4" style={{ color: 'var(--text-500)' }}>Name your Python project</p>
              <div className="mb-4">
                <Input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                  placeholder="Enter project name..."
                  className="rounded-xl"
                  style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)', color: 'var(--text-100)' }}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateProject} className="rounded-xl" style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}>
                  Create
                </Button>
                <Button variant="secondary" onClick={() => { setIsCreating(false); setNewProjectName(''); }} className="rounded-xl" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-300)' }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-300)', borderTopColor: 'var(--neon-color)' }} />
          </div>
        ) : projects.length === 0 && !isCreating ? (
          <Card className="rounded-2xl" style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
            <CardContent className="p-12 text-center">
              <Terminal size={48} className="mx-auto mb-4" style={{ color: 'var(--text-500)' }} />
              <p className="text-sm mb-2" style={{ color: 'var(--text-300)' }}>No projects yet</p>
              <p className="text-xs" style={{ color: 'var(--text-500)' }}>Create your first Python project to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
            {projects.map((project, idx) => (
              <Card
                key={project.id}
                onClick={() => openProject(project)}
                className="group rounded-2xl cursor-pointer transition-all duration-300 animate-fade-in"
                style={{
                  backgroundColor: 'var(--bg-200)',
                  borderColor: 'var(--border-300)',
                  opacity: 0,
                  animationFillMode: 'forwards',
                  animationDelay: `${idx * 60}ms`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.3)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(var(--neon-rgb), 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-300)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.1)' }}>
                        <Terminal size={18} style={{ color: 'var(--neon-color)' }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-100)' }}>{project.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px]" style={{ color: 'var(--text-500)' }}>
                            {project.files.length} file{project.files.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-[11px]" style={{ color: 'var(--text-500)' }}>
                            {new Date(project.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      className="h-7 w-7 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: '#f87171' }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  {project.files.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {project.files.slice(0, 4).map((f, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0.5" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}>
                          {f.filename}
                        </Badge>
                      ))}
                      {project.files.length > 4 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}>
                          +{project.files.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden animate-panel-in"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center animate-fade-in rounded-2xl" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.1)', border: '2px dashed var(--neon-color)' }}>
          <div className="flex flex-col items-center gap-2 animate-slide-in-up">
            <Upload size={32} style={{ color: 'var(--neon-color)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--neon-color)' }}>Drop files to upload</span>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files) handleUploadFiles(e.target.files); e.target.value = ''; }}
      />

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-300)', backgroundColor: 'var(--bg-100)' }}>
        <div className="flex items-center gap-2">
          {!isSidebarOpen && onToggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              className="h-8 w-8 flex-shrink-0 text-[var(--text-500)] hover:text-[var(--text-100)]"
            >
              <PanelLeft size={18} />
            </Button>
          )}
          <button onClick={handleBackToGrid} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--text-500)' }}>
            <ChevronRight size={14} className="rotate-180" />
          </button>
          <Terminal size={16} style={{ color: 'var(--neon-color)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>{activeProject.title}</span>
          {isDirty && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f59e0b' }} />}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLibrary(!showLibrary)}
            className="gap-1.5 h-8 px-3 rounded-lg text-xs"
            style={{
              backgroundColor: showLibrary ? 'rgba(var(--neon-rgb), 0.1)' : 'var(--bg-200)',
              color: showLibrary ? 'var(--neon-color)' : 'var(--text-300)',
              borderColor: showLibrary ? 'rgba(var(--neon-rgb), 0.3)' : 'var(--border-300)',
            }}
          >
            <BookOpen size={12} />
            Library
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveProject}
            disabled={!isDirty}
            className="gap-1.5 h-8 px-3 rounded-lg text-xs"
            style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)', borderColor: 'var(--border-300)' }}
          >
            Save
          </Button>
          <Button
            size="sm"
            onClick={isRunning ? handleStop : handleRun}
            className="gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold"
            style={{
              backgroundColor: isRunning ? '#ef4444' : 'var(--neon-color)',
              color: isRunning ? '#fff' : '#000',
              boxShadow: `0 2px 12px ${isRunning ? 'rgba(239,68,68,0.3)' : 'rgba(var(--neon-rgb), 0.3)'}`,
            }}
          >
            {isRunning ? <><Square size={12} /> Stop</> : <><Play size={12} /> Run</>}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 relative">
        {/* Left sidebar — file list + uploaded files + library */}
        <div className="flex flex-col flex-shrink-0 overflow-hidden" style={{ width: showLibrary ? '280px' : '220px', borderRight: '1px solid var(--border-300)', backgroundColor: 'var(--bg-100)' }}>
          {/* Code files */}
          <div className="px-2 pt-2 pb-1">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--text-500)' }}>Code Files</span>
              <button onClick={() => setShowAddFile(true)} className="p-0.5 rounded transition-colors hover:opacity-80" style={{ color: 'var(--neon-color)' }} title="Add .py file">
                <Plus size={12} />
              </button>
            </div>
          </div>
          <div className="px-2 space-y-0.5 flex-shrink-0" style={{ maxHeight: '25%', overflowY: 'auto' }}>
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center gap-1 group/file">
                <button
                  onClick={() => setActiveFileIdx(idx)}
                  onDoubleClick={() => handleSetEntry(idx)}
                  className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors min-w-0"
                  style={{
                    backgroundColor: activeFileIdx === idx ? 'rgba(var(--neon-rgb), 0.1)' : 'transparent',
                    color: activeFileIdx === idx ? 'var(--neon-color)' : 'var(--text-500)',
                    fontSize: '12px',
                  }}
                >
                  <FileCode size={12} />
                  <span className="truncate flex-1">{file.filename}</span>
                  {file.isEntry && (
                    <span className="text-[8px] px-1 rounded flex-shrink-0" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.15)', color: 'var(--neon-color)' }}>E</span>
                  )}
                </button>
                {files.length > 1 && (
                  <button
                    onClick={() => handleDeleteFile(idx)}
                    className="p-1 rounded opacity-0 group-hover/file:opacity-100 transition-opacity flex-shrink-0"
                    style={{ color: '#ef4444' }}
                    title="Delete file"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {showAddFile && (
            <div className="px-2 py-2 animate-expand-in overflow-hidden" style={{ borderTop: '1px solid var(--border-300)' }}>
              <div className="flex gap-1">
                <Input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddFile(); if (e.key === 'Escape') { setShowAddFile(false); setNewFileName(''); } }}
                  placeholder="filename.py"
                  className="h-7 text-xs rounded-lg"
                  style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)', color: 'var(--text-100)' }}
                  autoFocus
                />
                <button onClick={handleAddFile} className="p-1 rounded transition-colors hover:opacity-80" style={{ color: 'var(--neon-color)' }}>
                  <Plus size={14} />
                </button>
                <button onClick={() => { setShowAddFile(false); setNewFileName(''); }} className="p-1 rounded transition-colors hover:opacity-80" style={{ color: 'var(--text-500)' }}>
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Uploaded data files */}
          <div className="px-2 pt-3 pb-1" style={{ borderTop: '1px solid var(--border-300)' }}>
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--text-500)' }}>Data Files</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-0.5 rounded transition-colors hover:opacity-80"
                style={{ color: 'var(--neon-color)' }}
                title="Upload files (CSV, PDF, docs, txt, images, etc.)"
              >
                {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              </button>
            </div>
          </div>
          <div className="px-2 space-y-0.5 flex-shrink-0 overflow-y-auto" style={{ maxHeight: '30%' }}>
            {uploadedFiles.length === 0 ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg transition-colors"
                style={{ border: '1px dashed var(--border-300)', color: 'var(--text-500)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.4)'; e.currentTarget.style.color = 'var(--neon-color)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-300)'; e.currentTarget.style.color = 'var(--text-500)'; }}
              >
                <Upload size={14} />
                <span className="text-[10px]">Upload data files</span>
              </button>
            ) : (
              uploadedFiles.map((file) => (
                <div key={file.filename} className="flex items-center gap-1 group/uploaded">
                  <div className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg min-w-0 transition-colors duration-150" style={{ fontSize: '12px', color: 'var(--text-500)' }}>
                    <span className="text-xs flex-shrink-0">{getFileTypeIcon(file.filename)}</span>
                    <span className="truncate flex-1">{file.filename}</span>
                    <span className="text-[9px] flex-shrink-0" style={{ color: 'var(--text-500)' }}>{formatFileSize(file.size)}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="p-1 rounded opacity-0 group-hover/uploaded:opacity-100 transition-opacity flex-shrink-0"
                        style={{ color: 'var(--text-500)' }}
                      >
                        <MoreVertical size={12} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[140px]" style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
                      <DropdownMenuItem onClick={() => handleViewFile(file.filename)} className="gap-2 text-xs cursor-pointer">
                        <Eye size={12} />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadFile(file.filename)} className="gap-2 text-xs cursor-pointer">
                        <Download size={12} />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteUploadedFile(file.filename)} className="gap-2 text-xs cursor-pointer" style={{ color: '#ef4444' }}>
                        <Trash2 size={12} />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>

          {/* Requirements */}
          <div className="px-2 pt-3 pb-2" style={{ borderTop: '1px solid var(--border-300)' }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] block pb-1.5" style={{ color: 'var(--text-500)' }}>Pip Packages</span>
            <Input
              type="text"
              value={requirements}
              onChange={(e) => { setRequirements(e.target.value); setIsDirty(true); }}
              placeholder="numpy, pandas (comma-sep)"
              className="h-7 text-[11px] rounded-lg"
              style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)', color: 'var(--text-100)' }}
            />
            {output?.autoDetected && output.autoDetected.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {output.autoDetected.map((pkg, i) => (
                  <Badge key={i} variant="secondary" className="text-[9px] px-1 py-0" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.1)', color: 'var(--neon-color)' }}>
                    {pkg}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Library reference */}
          {showLibrary && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ borderTop: '1px solid var(--border-300)' }}>
              <div className="px-2 pt-2 pb-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--text-500)' }}>Library Reference</span>
              </div>
              <div className="px-2 pb-2">
                <div className="flex gap-1">
                  <Input
                    type="text"
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLibrarySearch()}
                    placeholder="Search Python code..."
                    className="h-7 text-[11px] rounded-lg"
                    style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)', color: 'var(--text-100)' }}
                  />
                  <button onClick={handleLibrarySearch} className="p-1 rounded transition-colors hover:opacity-80 flex-shrink-0" style={{ color: 'var(--neon-color)' }}>
                    {librarySearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
                {libraryResults.length === 0 && librarySearch && !librarySearching && (
                  <p className="text-[11px] text-center py-4" style={{ color: 'var(--text-500)' }}>No Python components found</p>
                )}
                {libraryResults.map((comp) => (
                  <button
                    key={comp.id}
                    onClick={() => handleLoadFromLibrary(comp)}
                    className="w-full text-left p-2 rounded-lg transition-colors"
                    style={{ backgroundColor: 'var(--bg-200)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(var(--neon-rgb), 0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-200)'; }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Package size={11} style={{ color: 'var(--neon-color)' }} />
                      <span className="text-[11px] font-medium truncate" style={{ color: 'var(--text-100)' }}>{comp.name}</span>
                    </div>
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-500)' }}>{comp.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center — code editor */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeFile ? (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-300)', backgroundColor: 'var(--bg-200)' }}>
                <FileCode size={12} style={{ color: 'var(--neon-color)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-100)' }}>{activeFile.filename}</span>
                <div className="flex-1" />
                <button onClick={() => editorRef.current?.undo()} className="p-1 rounded transition-colors hover:opacity-80" style={{ color: 'var(--text-500)' }} title="Undo">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" /></svg>
                </button>
                <button onClick={() => editorRef.current?.redo()} className="p-1 rounded transition-colors hover:opacity-80" style={{ color: 'var(--text-500)' }} title="Redo">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13" /></svg>
                </button>
              </div>
              <div className="flex-1 relative min-h-0">
                <CodeEditor
                  language="python"
                  value={activeFile.content}
                  onChange={handleFileContentChange}
                  onLoad={(editor) => { editorRef.current = editor; }}
                  className="absolute inset-0"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-500)' }}>
              <p className="text-sm">No file selected</p>
            </div>
          )}
        </div>

        {/* Right — output panel */}
        {(output || isRunning) && (
          <div className="flex-shrink-0 flex flex-col animate-fade-slide-in" style={{ width: '380px', borderLeft: '1px solid var(--border-300)' }}>
            <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0" style={{ backgroundColor: '#0d1117', borderBottom: '1px solid #21262d' }}>
              <div className="flex items-center gap-1.5">
                <Terminal size={11} style={{ color: '#8b949e' }} />
                <span className="text-[11px] font-medium" style={{ color: '#8b949e' }}>Output</span>
                {isRunning && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.15)', color: 'var(--neon-color)' }}>
                    running...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {output && (
                  <span className="text-[10px]" style={{ color: output.exitCode === 0 ? '#3fb950' : '#f85149' }}>
                    exit {output.exitCode}{output.timedOut ? ' (timed out)' : ''}
                  </span>
                )}
                <button onClick={() => setOutput(null)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#8b949e', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  Clear
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-3" style={{ backgroundColor: '#0d1117' }}>
              {output?.stdout && (
                <pre className="text-xs whitespace-pre-wrap mb-2" style={{ color: '#c9d1d9', fontFamily: "'JetBrains Mono', monospace" }}>
                  {output.stdout}
                </pre>
              )}
              {output?.stderr && (
                <pre className="text-xs whitespace-pre-wrap" style={{ color: '#f85149', fontFamily: "'JetBrains Mono', monospace" }}>
                  {output.stderr}
                </pre>
              )}
              {isRunning && !output && (
                <div className="flex items-center gap-2 py-2">
                  <div className="w-3 h-3 rounded-full animate-spin" style={{ border: '2px solid #30363d', borderTopColor: 'var(--neon-color)' }} />
                  <span className="text-xs" style={{ color: '#8b949e' }}>Executing...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen file viewer modal — only mount when a file is being viewed to avoid Radix FocusScope infinite re-render loop */}
      {viewingFile && <Dialog open onOpenChange={handleViewerClose}>
        <DialogContent hideCloseButton fullscreen className="max-w-[95vw] w-[95vw] h-[92vh] max-h-[92vh] p-0 flex flex-col overflow-hidden rounded-2xl" style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)' }}>
          {viewingFile && (
            <>
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-300)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg">{getFileTypeIcon(viewingFile.filename)}</span>
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-100)' }}>{viewingFile.filename}</span>
                  {viewingFile.size !== undefined && (
                    <Badge variant="secondary" className="text-[10px] flex-shrink-0" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}>{formatFileSize(viewingFile.size)}</Badge>
                  )}
                  {viewingFile.truncated && (
                    <Badge variant="secondary" className="text-[10px] flex-shrink-0" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Truncated</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* CSV delimiter picker */}
                  {viewingFile.type === 'text' && viewingFile.filename.toLowerCase().endsWith('.csv') && (
                    <div className="flex items-center gap-2 mr-2">
                      <span className="text-[11px] font-medium" style={{ color: 'var(--text-500)' }}>Delimiter</span>
                      <select
                        value={csvDelimiter}
                        onChange={(e) => { setCsvDelimiter(e.target.value); setCsvPage(0); }}
                        className="h-7 text-xs px-2 rounded-lg outline-none"
                        style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)', color: 'var(--text-100)' }}
                      >
                        <option value=",">,  Comma</option>
                        <option value={'\t'}>↹  Tab</option>
                        <option value=";">;  Semicolon</option>
                        <option value="|">|  Pipe</option>
                      </select>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadFile(viewingFile.filename)}
                    className="gap-1.5 h-8 px-3 rounded-lg text-xs"
                    style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)', borderColor: 'var(--border-300)' }}
                  >
                    <Download size={12} />
                    Download
                  </Button>
                </div>
              </div>

              {/* Modal body */}
              <div className="flex-1 overflow-auto" style={{ backgroundColor: viewingFile.type === 'text' ? '#0d1117' : 'var(--bg-100)' }}>
                {isLoadingView ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 rounded-full animate-spin" style={{ border: '2px solid var(--border-300)', borderTopColor: 'var(--neon-color)' }} />
                  </div>
                ) : viewingFile.type === 'text' && viewingFile.filename.toLowerCase().endsWith('.csv') && viewingFile.content ? (
                  /* CSV table view */
                  (() => {
                    const rows = parseCSV(viewingFile.content!, csvDelimiter);
                    if (rows.length === 0) return <div className="p-8 text-center text-sm" style={{ color: 'var(--text-500)' }}>Empty CSV file</div>;
                    const headers = rows[0];
                    const dataRows = rows.slice(1);
                    const totalPages = Math.max(1, Math.ceil(dataRows.length / CSV_PAGE_SIZE));
                    const pageRows = dataRows.slice(csvPage * CSV_PAGE_SIZE, (csvPage + 1) * CSV_PAGE_SIZE);
                    return (
                      <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-300)', backgroundColor: 'var(--bg-200)' }}>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium" style={{ color: 'var(--text-500)' }}>
                              {dataRows.length} row{dataRows.length !== 1 ? 's' : ''} × {headers.length} column{headers.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {totalPages > 1 && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setCsvPage(p => Math.max(0, p - 1))}
                                disabled={csvPage === 0}
                                className="p-1 rounded transition-colors hover:opacity-80 disabled:opacity-30"
                                style={{ color: 'var(--text-300)' }}
                              >
                                <ChevronDown size={14} className="rotate-90" />
                              </button>
                              <span className="text-xs" style={{ color: 'var(--text-500)' }}>
                                {csvPage + 1} / {totalPages}
                              </span>
                              <button
                                onClick={() => setCsvPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={csvPage >= totalPages - 1}
                                className="p-1 rounded transition-colors hover:opacity-80 disabled:opacity-30"
                                style={{ color: 'var(--text-300)' }}
                              >
                                <ChevronDown size={14} className="-rotate-90" />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 overflow-auto">
                          <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th className="sticky top-0 z-10 px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ backgroundColor: '#161b22', color: 'var(--text-500)', borderBottom: '1px solid #30363d', minWidth: '40px' }}>#</th>
                                {headers.map((h, i) => (
                                  <th key={i} className="sticky top-0 z-10 px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ backgroundColor: '#161b22', color: 'var(--neon-color)', borderBottom: '1px solid #30363d' }}>
                                    {h.trim() || `Col ${i + 1}`}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody key={csvPage} className="animate-fade-in">
                              {pageRows.map((row, ri) => (
                                <tr key={ri} style={{ backgroundColor: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)', transition: 'background-color 0.15s' }}>
                                  <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: 'var(--text-500)', borderBottom: '1px solid #21262d' }}>
                                    {csvPage * CSV_PAGE_SIZE + ri + 1}
                                  </td>
                                  {headers.map((_, ci) => (
                                    <td key={ci} className="px-3 py-1.5 whitespace-nowrap max-w-[300px] truncate" style={{ color: '#c9d1d9', borderBottom: '1px solid #21262d' }}>
                                      {(row[ci] || '').trim()}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()
                ) : viewingFile.type === 'text' ? (
                  /* Plain text view */
                  <div className="p-4">
                    <pre className="text-xs whitespace-pre-wrap" style={{ color: '#c9d1d9', fontFamily: "'JetBrains Mono', monospace", lineHeight: '1.6' }}>
                      {viewingFile.content}
                    </pre>
                  </div>
                ) : viewingFile.type === 'image' ? (
                  <div className="flex items-center justify-center h-full p-6">
                    <img
                      src={viewingFile.url}
                      alt={viewingFile.filename}
                      className="max-w-full max-h-full rounded-lg shadow-lg"
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                ) : viewingFile.type === 'pdf' ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4">
                    <span className="text-5xl">📄</span>
                    <p className="text-sm" style={{ color: 'var(--text-500)' }}>PDF files cannot be previewed inline.</p>
                    <Button
                      onClick={() => handleDownloadFile(viewingFile.filename)}
                      className="gap-2 rounded-xl"
                      style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
                    >
                      <Download size={14} />
                      Download PDF
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-4">
                    <span className="text-5xl">📎</span>
                    <p className="text-sm" style={{ color: 'var(--text-500)' }}>{viewingFile.message || 'Binary file — download to view.'}</p>
                    <Button
                      onClick={() => handleDownloadFile(viewingFile.filename)}
                      className="gap-2 rounded-xl"
                      style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
                    >
                      <Download size={14} />
                      Download File
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>}
    </div>
  );
};

export default PythonExecutorPanel;
