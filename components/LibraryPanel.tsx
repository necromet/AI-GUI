import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Trash2, X, Package, Layers, Code, LayoutGrid, RefreshCw, Eye, Copy, Check, ChevronDown, ChevronRight, Bot, Send, Sparkles } from 'lucide-react';
import { LibraryComponent, LibraryComponentWithScore, Role, Message, ModelConfig } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

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

interface LibraryPanelProps {
  theme?: 'dark' | 'light';
  modelConfig?: ModelConfig;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
}

const LibraryPanel: React.FC<LibraryPanelProps> = ({ theme = 'dark', modelConfig, onNotification }) => {
  const [components, setComponents] = useState<LibraryComponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedComponent, setSelectedComponent] = useState<LibraryComponent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const [newComponent, setNewComponent] = useState({
    name: '',
    category: 'ui-widget' as LibraryComponent['category'],
    contentType: 'html' as LibraryComponent['contentType'],
    description: '',
    tags: '',
    content: '',
  });

  const [showAgent, setShowAgent] = useState(false);
  const [agentMessages, setAgentMessages] = useState<{ role: 'user' | 'assistant'; content: string; id: string }[]>([]);
  const [agentInput, setAgentInput] = useState('');
  const [isAgentStreaming, setIsAgentStreaming] = useState(false);
  const agentMessagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    if (!newComponent.name || !newComponent.content) return;
    try {
      const response = await fetch('/api/library/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newComponent,
          tags: newComponent.tags.split(',').map(t => t.trim()).filter(Boolean),
          isGlobal: true,
          agentAccessible: true,
        }),
      });
      if (!response.ok) throw new Error('Failed to create component');
      const data = await response.json();
      setComponents(prev => [data.component, ...prev]);
      setIsCreating(false);
      setNewComponent({ name: '', category: 'ui-widget', contentType: 'html', description: '', tags: '', content: '' });
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

  if (selectedComponent) {
    return (
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-4 p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedComponent(null)}
            style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)', borderColor: 'var(--border-300)' }}
          >
            &larr; Back
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-100)' }}>{selectedComponent.name}</h2>
            <p className="text-xs" style={{ color: 'var(--text-500)' }}>{selectedComponent.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className="text-[10px]"
              style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.1)', color: 'var(--neon-color)' }}
            >
              {CATEGORY_LABELS[selectedComponent.category] || selectedComponent.category}
            </Badge>
            <Badge
              variant="secondary"
              className="text-[10px]"
              style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}
            >
              {selectedComponent.contentType}
            </Badge>
          </div>
        </div>

        {selectedComponent.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {selectedComponent.tags.map(tag => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-[10px]"
                style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <Card style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
          <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--border-300)' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--text-500)' }}>Content</span>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 h-7 text-[10px]"
              style={{ color: 'var(--text-300)' }}
              onClick={() => {
                navigator.clipboard.writeText(selectedComponent.content);
                onNotification?.('Copied to clipboard', 'success');
              }}
            >
              <Copy size={10} />
              Copy
            </Button>
          </div>
          <pre className="p-4 overflow-x-auto text-xs leading-relaxed max-h-[60vh]" style={{ color: 'var(--text-300)' }}>
            <code>{selectedComponent.content}</code>
          </pre>
        </Card>

        {selectedComponent.metadata && Object.keys(selectedComponent.metadata).length > 0 && (
          <Card style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
            <CardContent className="p-4">
              <span className="text-xs font-semibold block mb-2" style={{ color: 'var(--text-500)' }}>Metadata</span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(selectedComponent.metadata).map(([key, value]) => (
                  <Badge
                    key={key}
                    variant="secondary"
                    className="text-[10px]"
                    style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}
                  >
                    {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
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
            <p className="text-xs" style={{ color: 'var(--text-500)' }}>Reusable components, templates, and agent tools</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl"
            onClick={() => setShowAgent(!showAgent)}
            style={{
              backgroundColor: showAgent ? 'rgba(var(--neon-rgb), 0.15)' : 'var(--bg-200)',
              color: showAgent ? 'var(--neon-color)' : 'var(--text-300)',
              borderColor: showAgent ? 'rgba(var(--neon-rgb), 0.3)' : 'var(--border-300)',
            }}
          >
            <Bot size={14} />
            Agent
          </Button>
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

      {/* Agent Chat Panel */}
      {showAgent && (
        <Card className="rounded-2xl animate-fade-in" style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border-300)' }}>
            <Bot size={14} style={{ color: 'var(--neon-color)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-100)' }}>Library Agent</span>
            <span className="text-[10px]" style={{ color: 'var(--text-500)' }}>Search, create, and manage components with AI</span>
          </div>

          <ScrollArea className="max-h-64 px-4 py-3">
            <div className="space-y-3">
              {agentMessages.length === 0 && (
                <div className="text-center py-4">
                  <Sparkles size={20} className="mx-auto mb-2" style={{ color: 'var(--text-500)' }} />
                  <p className="text-xs" style={{ color: 'var(--text-500)' }}>Ask me to find or create components</p>
                </div>
              )}
              {agentMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed"
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

          <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--border-300)' }}>
            <Input
              type="text"
              value={agentInput}
              onChange={e => setAgentInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAgentSend()}
              placeholder="Ask the agent to find or create components..."
              className="flex-1 h-8 text-xs rounded-lg"
              style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
              disabled={isAgentStreaming}
            />
            <Button
              size="icon"
              className="h-8 w-8 rounded-lg"
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
                className="h-8 w-8 rounded-lg"
                onClick={() => abortControllerRef.current?.abort()}
                style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171' }}
              >
                <X size={14} />
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Create Form */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent
          className="max-w-2xl"
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
                className="text-xs"
                style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-500)' }}>Description</Label>
              <Input
                type="text"
                value={newComponent.description}
                onChange={e => setNewComponent(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description"
                className="text-xs"
                style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-500)' }}>Category</Label>
              <Select
                value={newComponent.category}
                onValueChange={value => setNewComponent(prev => ({ ...prev, category: value as any }))}
              >
                <SelectTrigger
                  className="text-xs"
                  style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
                  {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                    <SelectItem
                      key={c.key}
                      value={c.key}
                      className="text-xs"
                      style={{ color: 'var(--text-100)' }}
                    >
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-500)' }}>Content Type</Label>
              <Select
                value={newComponent.contentType}
                onValueChange={value => setNewComponent(prev => ({ ...prev, contentType: value as any }))}
              >
                <SelectTrigger
                  className="text-xs"
                  style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
                  {CONTENT_TYPES.map(ct => (
                    <SelectItem
                      key={ct.value}
                      value={ct.value}
                      className="text-xs"
                      style={{ color: 'var(--text-100)' }}
                    >
                      {ct.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: 'var(--text-500)' }}>Tags</Label>
            <Input
              type="text"
              value={newComponent.tags}
              onChange={e => setNewComponent(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="Tags (comma-separated)"
              className="text-xs"
              style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: 'var(--text-500)' }}>Content</Label>
            <Textarea
              value={newComponent.content}
              onChange={e => setNewComponent(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Component content (code, HTML, JSON, etc.)"
              className="text-xs font-mono resize-none h-40"
              style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleCreate}
              disabled={!newComponent.name || !newComponent.content}
              className="text-xs"
              style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
            >
              Create
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsCreating(false)}
              className="text-xs"
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
            className="flex-1 bg-transparent border-0 text-xs h-9 focus-visible:ring-0 focus-visible:ring-offset-0"
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
            className="h-7 text-[10px] rounded-lg"
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
              className="gap-1 h-7 text-[11px] whitespace-nowrap rounded-lg"
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
            <p className="text-sm mb-2" style={{ color: 'var(--text-300)' }}>No components yet</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-500)' }}>Create your first component or seed the defaults</p>
            <Button
              className="rounded-xl text-xs"
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
                      <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-100)' }}>{comp.name}</h3>
                      <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--text-500)' }}>{comp.description}</p>
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
                      className="text-[9px] px-1.5 py-0.5"
                      style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.1)', color: 'var(--neon-color)' }}
                    >
                      {CATEGORY_LABELS[comp.category] || comp.category}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="text-[9px] px-1.5 py-0.5"
                      style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}
                    >
                      {comp.contentType}
                    </Badge>
                    {isScored && (
                      <span className="text-[9px] px-1 py-0.5 rounded" style={{ color: 'var(--neon-color)' }}>
                        {((comp as any).score * 100).toFixed(0)}%
                      </span>
                    )}
                    {comp.tags.slice(0, 2).map(tag => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-[8px] px-1 py-0.5"
                        style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}
                      >
                        {tag}
                      </Badge>
                    ))}
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
