import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Plus, Trash2, X, Package, Layers, Code, LayoutGrid, RefreshCw, Eye, Copy, Check, Bot, Send, Sparkles, FileCode, FileText, FileJson, FileType, Undo2, Redo2, ArrowLeft, Upload, PanelLeftClose } from 'lucide-react';
import { LibraryComponent, LibraryComponentFile, ModelConfig } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CodeEditor } from '@/components/ui/code-editor-sheet';

const CATEGORIES = [
  { key: 'all', label: 'All', icon: <Package size={12} /> },
  { key: 'ui-widget', label: 'Widgets', icon: <LayoutGrid size={12} /> },
  { key: 'template', label: 'Templates', icon: <Layers size={12} /> },
  { key: 'snippet', label: 'Snippets', icon: <Code size={12} /> },
  { key: 'hook', label: 'Hooks', icon: <Code size={12} /> },
  { key: 'util', label: 'Utils', icon: <Code size={12} /> },
  { key: 'pattern', label: 'Patterns', icon: <Layers size={12} /> },
  { key: 'agent-tool', label: 'Agent Tools', icon: <Bot size={12} /> },
];

const CATEGORY_LABELS: Record<string, string> = {
  'ui-widget': 'Widget',
  'template': 'Template',
  'snippet': 'Snippet',
  'hook': 'Hook',
  'util': 'Utility',
  'pattern': 'Pattern',
  'agent-tool': 'Agent Tool',
};

const CONTENT_TYPES = [
  { value: 'html', label: 'HTML' },
  { value: 'tsx', label: 'TSX (React)' },
  { value: 'css', label: 'CSS' },
  { value: 'js', label: 'JavaScript' },
  { value: 'ts', label: 'TypeScript' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
];

const FILENAME_MAP: Record<string, string> = {
  html: 'index.html', tsx: 'Component.tsx', css: 'style.css', js: 'script.js', ts: 'script.ts', json: 'data.json', markdown: 'README.md',
};

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  html: 'html', htm: 'html',
  css: 'css',
  js: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'tsx',
  json: 'json',
  md: 'markdown', markdown: 'markdown',
  py: 'python',
  java: 'java',
  cpp: 'c_cpp', c: 'c_cpp', h: 'c_cpp',
  rb: 'ruby',
  php: 'php',
  sql: 'sql',
  go: 'golang',
  rs: 'rust',
  lua: 'lua',
};

function deriveContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_CONTENT_TYPE[ext] || 'js';
}

const ACE_MODE_MAP: Record<string, string> = {
  html: 'html', css: 'css', js: 'javascript', ts: 'typescript', tsx: 'typescript', json: 'json', markdown: 'markdown',
};

const ACE_LANG_MAP: Record<string, 'html' | 'css' | 'javascript' | 'typescript' | 'json' | 'markdown'> = {
  html: 'html', css: 'css', js: 'javascript', ts: 'typescript', tsx: 'typescript', json: 'json', markdown: 'markdown',
};

function getFileIcon(filename: string) {
  if (filename.endsWith('.html')) return <FileCode size={12} />;
  if (filename.endsWith('.css')) return <FileCode size={12} />;
  if (filename.endsWith('.js') || filename.endsWith('.ts') || filename.endsWith('.tsx')) return <FileType size={12} />;
  if (filename.endsWith('.json')) return <FileJson size={12} />;
  return <FileText size={12} />;
}

function buildPreviewHtml(files: LibraryComponentFile[]): string {
  if (!files || files.length === 0) return '';
  const entry = files.find(f => f.isEntry) || files.find(f => f.filename.endsWith('.html')) || files[0];
  if (!entry) return '';

  if (entry.contentType === 'html') {
    let html = entry.content;
    const cssFiles = files.filter(f => f.contentType === 'css' && f.id !== entry.id);
    const jsFiles = files.filter(f => f.contentType === 'js' && f.id !== entry.id);

    const cssBlock = cssFiles.map(f => `<style data-file="${f.filename}">\n${f.content}\n</style>`).join('\n');
    const jsBlock = jsFiles.map(f => `<script data-file="${f.filename}">\n${f.content}\n</script>`).join('\n');

    if (cssBlock) {
      if (html.includes('</head>')) {
        html = html.replace('</head>', cssBlock + '\n</head>');
      } else {
        html = cssBlock + '\n' + html;
      }
    }
    if (jsBlock) {
      if (html.includes('</body>')) {
        html = html.replace('</body>', jsBlock + '\n</body>');
      } else {
        html = html + '\n' + jsBlock;
      }
    }
    return html;
  }

  if (entry.contentType === 'js' || entry.contentType === 'ts' || entry.contentType === 'tsx') {
    return `<!DOCTYPE html><html><head></head><body><pre style="font-family:monospace;padding:1rem;color:#e0e0e0;background:#0f0f1a;min-height:100vh;white-space:pre-wrap">${entry.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
  }

  if (entry.contentType === 'css') {
    return `<!DOCTYPE html><html><head><style>${entry.content}</style></head><body><div style="font-family:system-ui;padding:2rem;color:#888"><p>CSS Preview</p><p class="test">This text uses the component's stylesheet.</p></div></body></html>`;
  }

  return `<!DOCTYPE html><html><head></head><body><pre style="font-family:monospace;padding:1rem;color:#e0e0e0;background:#0f0f1a;min-height:100vh;white-space:pre-wrap">${entry.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
}

export interface LibraryControls {
  showAgent: boolean;
  onToggleAgent: () => void;
  componentName: string;
  componentDescription: string;
  componentTags: string[];
  onBack: () => void;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
}

interface LibraryPanelProps {
  theme?: 'dark' | 'light';
  modelConfig?: ModelConfig;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  onControlsChange?: (controls: LibraryControls | null) => void;
}

const LibraryPanel: React.FC<LibraryPanelProps> = ({ theme = 'dark', modelConfig, onNotification, onControlsChange }) => {
  const [components, setComponents] = useState<LibraryComponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedComponent, setSelectedComponent] = useState<LibraryComponent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const [showAgent, setShowAgent] = useState(false);
  const [agentMessages, setAgentMessages] = useState<{ role: 'user' | 'assistant'; content: string; id: string }[]>([]);
  const [agentInput, setAgentInput] = useState('');
  const [isAgentStreaming, setIsAgentStreaming] = useState(false);
  const agentMessagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const editorRef = useRef<any>(null);

  // File editor state
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [editFiles, setEditFiles] = useState<LibraryComponentFile[]>([]);
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
  const [showAddFileDialog, setShowAddFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [deleteFileDialog, setDeleteFileDialog] = useState<string | null>(null);

  // Create dialog multi-file state
  const [createFiles, setCreateFiles] = useState<Array<{ filename: string; contentType: string; content: string; isEntry: boolean }>>([
    { filename: 'index.html', contentType: 'html', content: '', isEntry: true },
  ]);

  const loadComponents = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'all') params.set('category', activeCategory);

      const response = await fetch(`/api/library/components?${params}`);
      if (!response.ok) throw new Error('Failed to load components');
      const data = await response.json();
      setComponents(data.components || []);
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, onNotification]);

  useEffect(() => { loadComponents(); }, [loadComponents]);

  useEffect(() => {
    agentMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentMessages]);

  useEffect(() => {
    if (!onControlsChange) return;
    if (selectedComponent) {
      onControlsChange({
        showAgent,
        onToggleAgent: () => setShowAgent(prev => !prev),
        componentName: selectedComponent.name,
        componentDescription: selectedComponent.description,
        componentTags: selectedComponent.tags,
        onBack: () => setSelectedComponent(null),
        isDirty,
        isSaving,
        onSave: handleSaveFiles,
      });
    } else {
      onControlsChange(null);
    }
  }, [selectedComponent, showAgent, isDirty, isSaving, onControlsChange]);

  useEffect(() => {
    return () => { onControlsChange?.(null); };
  }, [onControlsChange]);

  // When a component is selected, load its files into editor state
  useEffect(() => {
    if (selectedComponent?.files) {
      setEditFiles([...selectedComponent.files]);
      setOpenFileIds(selectedComponent.files.map(f => f.id));
      setActiveFileId(selectedComponent.files.find(f => f.isEntry)?.id || selectedComponent.files[0]?.id || null);
      setIsDirty(false);
      setViewMode('code');
    }
  }, [selectedComponent]);

  const activeFile = useMemo(() => editFiles.find(f => f.id === activeFileId) || null, [editFiles, activeFileId]);

  const previewHtml = useMemo(() => buildPreviewHtml(editFiles), [editFiles]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadComponents();
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/library/components/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, topK: 20 }),
      });
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      setComponents(data.components || []);
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const response = await fetch('/api/library/components/seed', { method: 'POST' });
      if (!response.ok) throw new Error('Seed failed');
      const data = await response.json();
      onNotification?.(data.message, 'success');
      await loadComponents();
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleCreate = async () => {
    const validFiles = createFiles.filter(f => f.content.trim());
    if (!newComponent.name || validFiles.length === 0) return;
    try {
      const body: any = {
        name: newComponent.name,
        category: newComponent.category,
        description: newComponent.description,
        tags: newComponent.tags.split(',').map(t => t.trim()).filter(Boolean),
        isGlobal: true,
        agentAccessible: true,
        files: validFiles.map(f => ({
          filename: f.filename,
          contentType: f.contentType,
          content: f.content,
          isEntry: f.isEntry,
        })),
      };

      const response = await fetch('/api/library/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Failed to create component');
      const data = await response.json();
      setComponents(prev => [data.component, ...prev]);
      setIsCreating(false);
      setNewComponent({ name: '', category: 'ui-widget', contentType: 'html', description: '', tags: '', content: '' });
      setCreateFiles([{ filename: 'index.html', contentType: 'html', content: '', isEntry: true }]);
      onNotification?.('Component created', 'success');
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/library/components/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
      setComponents(prev => prev.filter(c => c.id !== id));
      if (selectedComponent?.id === id) setSelectedComponent(null);
      onNotification?.('Component deleted', 'success');
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  const handleCopy = (component: LibraryComponent, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(component.content).then(() => {
      setCopiedId(component.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleAgentSend = async () => {
    const text = agentInput.trim();
    if (!text || isAgentStreaming) return;

    setAgentInput('');
    const userMsg = { id: Math.random().toString(36).slice(2), role: 'user' as const, content: text };
    setAgentMessages(prev => [...prev, userMsg]);

    const aiMsgId = Math.random().toString(36).slice(2);
    setAgentMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: '', isThinking: true } as any]);
    setIsAgentStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const history = [...agentMessages, userMsg].map(m => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/library/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          model: modelConfig?.apiModelId || modelConfig?.id || 'mimo-v2.5',
          provider: modelConfig?.provider,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.content) {
              fullText += parsed.content;
              setAgentMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: fullText } : m));
            }
            if (parsed.component_created) {
              onNotification?.(`Created: ${parsed.component_created.name}`, 'success');
              loadComponents();
            }
          } catch (e: any) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setAgentMessages(prev => prev.filter(m => m.id !== aiMsgId));
      } else {
        setAgentMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: `Error: ${err.message}` } : m));
      }
    } finally {
      abortControllerRef.current = null;
      setIsAgentStreaming(false);
    }
  };

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
      loadComponents();
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

  const handleRemoveCreateFile = (index: number) => {
    setCreateFiles(prev => {
      const remaining = prev.filter((_, i) => i !== index);
      if (remaining.length === 0) return [{ filename: 'index.html', contentType: 'html', content: '', isEntry: true }];
      if (!remaining.some(f => f.isEntry)) remaining[0].isEntry = true;
      return remaining;
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const readFile = (file: File): Promise<{ filename: string; contentType: string; content: string; isEntry: boolean }> =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            filename: file.name,
            contentType: deriveContentType(file.name),
            content: typeof reader.result === 'string' ? reader.result : '',
            isEntry: false,
          });
        };
        reader.readAsText(file);
      });

    const uploaded = await Promise.all(Array.from(files).map(readFile));
    if (uploaded.length > 0) uploaded[0].isEntry = true;

    setCreateFiles(prev => {
      const merged = prev.length === 1 && !prev[0].content.trim() ? uploaded : [...prev, ...uploaded];
      if (!merged.some(f => f.isEntry)) merged[0].isEntry = true;
      return merged;
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const [newComponent, setNewComponent] = useState({
    name: '',
    category: 'ui-widget' as LibraryComponent['category'],
    contentType: 'html' as LibraryComponent['contentType'],
    description: '',
    tags: '',
    content: '',
  });

  // Detail view with tabbed file editor + preview
  if (selectedComponent) {
    const aceMode = activeFile ? ACE_MODE_MAP[activeFile.contentType] || 'text' : 'text';

    return (
      <div className="flex h-full w-full">
      <div className="flex-1 flex flex-col gap-4 p-4 h-full overflow-hidden">
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
                }}
              >
                {getFileIcon(file.filename)}
                <span>{file.filename}</span>
                {file.isEntry && <span className="text-[9px] px-1 rounded" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.15)', color: 'var(--neon-color)' }}>entry</span>}
                {isDirty && activeFileId === file.id && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f59e0b' }} />}
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
          {/* Code Editor */}
          {viewMode === 'code' ? (
            <div className="flex-1 flex flex-col min-w-0 rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}>
              {activeFile ? (
                <>
                  {/* Editor Header */}
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
              <div className="flex-1">
                {previewHtml ? (
                  <iframe
                    srcDoc={previewHtml}
                    sandbox="allow-scripts"
                    className="w-full h-full border-0"
                    style={{ backgroundColor: '#fff' }}
                    title="Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-500)' }}>
                    <p className="text-sm">No previewable content</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mini file list sidebar */}
          <div className="w-48 flex-shrink-0 rounded-xl overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}>
            <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-300)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-500)' }}>Files</span>
              <button
                onClick={() => setShowAddFileDialog(true)}
                className="p-0.5 rounded transition-colors hover:opacity-80"
                style={{ color: 'var(--neon-color)' }}
                title="Add file"
              >
                <Plus size={12} />
              </button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-0.5">
                {editFiles.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-1 group/file"
                  >
                    <button
                      onClick={() => {
                        setActiveFileId(file.id);
                        setViewMode('code');
                        if (!openFileIds.includes(file.id)) {
                          setOpenFileIds(prev => [...prev, file.id]);
                        }
                      }}
                      className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors min-w-0"
                      style={{
                        backgroundColor: activeFileId === file.id ? 'rgba(var(--neon-rgb), 0.1)' : 'transparent',
                        color: activeFileId === file.id ? 'var(--neon-color)' : 'var(--text-500)',
                        fontSize: '12px',
                      }}
                    >
                      {getFileIcon(file.filename)}
                      <span className="truncate flex-1">{file.filename}</span>
                      {file.isEntry && <span className="text-[8px] px-1 rounded flex-shrink-0" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.15)', color: 'var(--neon-color)' }}>E</span>}
                    </button>
                    {editFiles.length > 1 && (
                      <button
                        onClick={() => setDeleteFileDialog(file.id)}
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
            </ScrollArea>
          </div>
        </div>

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

      {/* Agent Right Sidebar */}
      <aside
        className={`
          flex-shrink-0 h-full flex flex-col
          transition-all duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)]
          fixed right-0 top-0 z-50
          ${showAgent ? 'w-[288px]' : 'w-0 overflow-hidden'}
        `}
        style={{
          backgroundColor: 'var(--bg-100)',
          borderLeft: showAgent ? '1px solid var(--border-300)' : 'none',
          height: '100vh',
        }}
      >
        <div className={`flex flex-col h-full w-[288px] transition-opacity duration-200 ${showAgent ? 'opacity-100' : 'opacity-0'}`}>
          {/* Header */}
          <div className="flex w-full items-center p-2 pt-2 gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAgent(false)}
              className="h-8 w-8 flex-shrink-0"
              style={{ color: 'var(--text-500)' }}
            >
              <PanelLeftClose size={16} style={{ transform: 'scaleX(-1)' }} />
            </Button>
            <div className="flex items-center gap-2 h-8">
              <Bot size={16} style={{ color: 'var(--neon-color)' }} />
              <span className="font-semibold text-sm" style={{ color: 'var(--text-100)' }}>Library Agent</span>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-3 pt-2">
            <div className="space-y-3">
              {agentMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Sparkles size={20} className="mb-2" style={{ color: 'var(--text-500)' }} />
                  <p className="text-xs" style={{ color: 'var(--text-500)' }}>Ask me to find or create components</p>
                </div>
              )}
              {agentMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed"
                    style={{
                      backgroundColor: msg.role === 'user' ? 'rgba(var(--neon-rgb), 0.15)' : 'var(--bg-300)',
                      color: 'var(--text-100)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {(msg as any).content || ((msg as any).isThinking ? <span className="animate-pulse">Thinking...</span> : '')}
                  </div>
                </div>
              ))}
              <div ref={agentMessagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-2 space-y-2">
            <div className="flex items-center gap-1.5">
              <Input
                type="text"
                value={agentInput}
                onChange={e => setAgentInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAgentSend()}
                placeholder="Ask the agent..."
                className="flex-1 h-8 text-sm rounded-lg"
                style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
                disabled={isAgentStreaming}
              />
              <Button
                size="icon"
                className="h-8 w-8 rounded-lg flex-shrink-0"
                onClick={handleAgentSend}
                disabled={!agentInput.trim() || isAgentStreaming}
                style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
              >
                <Send size={14} />
              </Button>
              {isAgentStreaming && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg flex-shrink-0"
                  onClick={() => abortControllerRef.current?.abort()}
                  style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                >
                  <X size={14} />
                </Button>
              )}
            </div>
          </div>
        </div>
      </aside>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ background: 'rgba(var(--neon-rgb), 0.1)', boxShadow: '0 0 20px rgba(var(--neon-rgb), 0.08)' }}>
            <Package size={22} style={{ color: 'var(--neon-color)' }} />
          </div>
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-100)' }}>Component Library</h2>
            <p className="text-sm" style={{ color: 'var(--text-500)' }}>Reusable components, templates, and agent tools</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5 rounded-xl"
            onClick={() => setIsCreating(true)}
            style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
          >
            <Plus size={14} />
            New Component
          </Button>
        </div>
      </div>

      {/* Create Form */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent
          className="max-w-3xl"
          style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--text-100)' }}>New Component</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-500)' }}>Name</Label>
              <Input
                type="text"
                value={newComponent.name}
                onChange={e => setNewComponent(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Component name"
                className="text-sm"
                style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-500)' }}>Category</Label>
              <Select
                value={newComponent.category}
                onValueChange={value => setNewComponent(prev => ({ ...prev, category: value as any }))}
              >
                <SelectTrigger className="text-sm" style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
                  {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                    <SelectItem key={c.key} value={c.key} className="text-sm" style={{ color: 'var(--text-100)' }}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-500)' }}>Tags</Label>
              <Input
                type="text"
                value={newComponent.tags}
                onChange={e => setNewComponent(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="Tags (comma-separated)"
                className="text-sm"
                style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: 'var(--text-500)' }}>Description</Label>
            <Textarea
              value={newComponent.description}
              onChange={e => setNewComponent(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this component does..."
              className="text-sm min-h-[80px] resize-y"
              style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
            />
          </div>

          {/* File upload */}
          <div className="space-y-2">
            <Label className="text-xs" style={{ color: 'var(--text-500)' }}>Files</Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              accept=".html,.htm,.css,.js,.jsx,.ts,.tsx,.json,.md,.py,.java,.cpp,.c,.h,.rb,.php,.sql,.go,.rs,.lua"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center gap-2 py-6 rounded-lg border-2 border-dashed transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--border-300)', color: 'var(--text-500)' }}
            >
              <Upload size={20} style={{ color: 'var(--neon-color)', opacity: 0.6 }} />
              <span className="text-sm">Click to upload files</span>
              <span className="text-xs" style={{ color: 'var(--text-500)' }}>Supports multiple files at once</span>
            </button>
            {createFiles.some(f => f.content.trim()) && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {createFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)' }}
                  >
                    {getFileIcon(file.filename)}
                    <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--text-100)' }}>{file.filename}</span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1"
                      style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}
                    >
                      {file.contentType}
                    </Badge>
                    {file.isEntry && (
                      <Badge className="text-[10px] px-1" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.15)', color: 'var(--neon-color)' }}>
                        entry
                      </Badge>
                    )}
                    <button
                      onClick={() => handleRemoveCreateFile(idx)}
                      className="p-1 rounded transition-colors hover:opacity-80"
                      style={{ color: '#ef4444' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleCreate}
              disabled={!newComponent.name || !createFiles.some(f => f.content.trim())}
              style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
            >
              Create
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreating(false);
                setCreateFiles([{ filename: 'index.html', contentType: 'html', content: '', isEntry: true }]);
              }}
              style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-300)' }}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search + Filter */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 px-3 rounded-xl" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}>
          <Search size={14} style={{ color: 'var(--text-500)' }} />
          <Input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search components..."
            className="flex-1 bg-transparent border-0 text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{ color: 'var(--text-100)' }}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => { setSearchQuery(''); loadComponents(); }}
              style={{ color: 'var(--text-500)' }}
            >
              <X size={12} />
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 text-xs rounded-lg"
            onClick={handleSearch}
            style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
          >
            Search
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-xl"
          onClick={handleSeed}
          disabled={isSeeding}
          style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)', borderColor: 'var(--border-300)' }}
        >
          <RefreshCw size={12} className={isSeeding ? 'animate-spin' : ''} />
          Seed Defaults
        </Button>
      </div>

      {/* Category Tabs */}
      <ScrollArea className="w-full">
        <div className="flex gap-1.5 pb-1">
          {CATEGORIES.map(cat => (
            <Button
              key={cat.key}
              variant="outline"
              size="sm"
              className="gap-1 h-8 text-xs whitespace-nowrap rounded-lg"
              onClick={() => setActiveCategory(cat.key)}
              style={{
                backgroundColor: activeCategory === cat.key ? 'rgba(var(--neon-rgb), 0.2)' : 'var(--bg-200)',
                color: activeCategory === cat.key ? 'var(--neon-color)' : 'var(--text-500)',
                borderColor: activeCategory === cat.key ? 'rgba(var(--neon-rgb), 0.3)' : 'var(--border-300)',
              }}
            >
              {cat.icon}
              {cat.label}
            </Button>
          ))}
        </div>
      </ScrollArea>

      {/* Component Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-300)', borderTopColor: 'var(--neon-color)' }} />
        </div>
      ) : components.length === 0 ? (
        <Card className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
          <CardContent className="p-0">
            <Package size={48} className="mx-auto mb-4" style={{ color: 'var(--text-500)' }} />
            <p className="text-base mb-2" style={{ color: 'var(--text-300)' }}>No components yet</p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-500)' }}>Create your first component or seed the defaults</p>
            <Button
              className="rounded-xl text-sm"
              onClick={handleSeed}
              style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
            >
              Seed Default Components
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {components.map((comp, idx) => {
            const isScored = 'score' in comp;
            return (
              <Card
                key={comp.id}
                className="group cursor-pointer transition-all duration-200 animate-fade-in"
                style={{
                  backgroundColor: 'var(--bg-200)',
                  borderColor: 'var(--border-300)',
                  opacity: 0,
                  animationFillMode: 'forwards',
                  animationDelay: `${idx * 40}ms`,
                }}
                onClick={() => setSelectedComponent(comp)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(var(--neon-rgb), 0.3)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(var(--neon-rgb), 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-300)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold truncate" style={{ color: 'var(--text-100)' }}>{comp.name}</h3>
                      <p className="text-sm mt-0.5 line-clamp-2" style={{ color: 'var(--text-500)' }}>{comp.description}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => handleCopy(comp, e)}
                        style={{ color: 'var(--text-500)' }}
                        title="Copy content"
                      >
                        {copiedId === comp.id ? <Check size={12} style={{ color: '#4ade80' }} /> : <Copy size={12} />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => handleDelete(comp.id, e)}
                        style={{ color: '#ef4444' }}
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <Badge
                      className="text-xs px-1.5 py-0.5"
                      style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.1)', color: 'var(--neon-color)' }}
                    >
                      {CATEGORY_LABELS[comp.category] || comp.category}
                    </Badge>
                    {[comp.contentType, ...comp.tags.slice(0, 2)].map((label, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-xs px-1.5 py-0.5"
                        style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}
                      >
                        {label}
                      </Badge>
                    ))}
                    {comp.files && comp.files.length > 1 && (
                      <Badge
                        variant="secondary"
                        className="text-xs px-1.5 py-0.5 gap-0.5"
                        style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.08)', color: 'var(--neon-color)' }}
                      >
                        <FileCode size={10} />
                        {comp.files.length} files
                      </Badge>
                    )}
                    {isScored && (
                      <span className="text-xs px-1 py-0.5 rounded" style={{ color: 'var(--neon-color)' }}>
                        {((comp as any).score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LibraryPanel;
