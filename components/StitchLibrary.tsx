import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Trash2, X, Package, Layers, Image as ImageIcon, Code, LayoutGrid, RefreshCw, Check } from 'lucide-react';
import type { StitchComponent } from '../types/stitchSpec';
import type { StitchProjectType } from '../types';

interface StitchLibraryProps {
  projectType?: StitchProjectType;
  theme?: 'dark' | 'light';
  onComponentsSelected?: (components: StitchComponent[]) => void;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
}

const CATEGORIES = [
  { key: 'all', label: 'All', icon: <Package size={12} /> },
  { key: 'section', label: 'Sections', icon: <Layers size={12} /> },
  { key: 'component', label: 'Components', icon: <LayoutGrid size={12} /> },
  { key: 'icon', label: 'Icons', icon: <ImageIcon size={12} /> },
  { key: 'svg', label: 'SVGs', icon: <Code size={12} /> },
  { key: 'template', label: 'Templates', icon: <Layers size={12} /> },
];

const StitchLibrary: React.FC<StitchLibraryProps> = ({ projectType, theme = 'dark', onComponentsSelected, onNotification }) => {
  const [components, setComponents] = useState<StitchComponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [newComponent, setNewComponent] = useState({
    name: '',
    category: 'section' as StitchComponent['category'],
    contentType: 'json' as StitchComponent['contentType'],
    description: '',
    tags: '',
    content: '',
  });

  const loadComponents = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'all') params.set('category', activeCategory);
      if (projectType) params.set('projectType', projectType);

      const response = await fetch(`/api/stitch/components?${params}`);
      if (!response.ok) throw new Error('Failed to load components');
      const data = await response.json();
      setComponents(data.components || []);
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, projectType, onNotification]);

  useEffect(() => { loadComponents(); }, [loadComponents]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadComponents();
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/stitch/components/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, projectType, topK: 20 }),
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

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/stitch/components/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
      setComponents(prev => prev.filter(c => c.id !== id));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      onNotification?.('Component deleted', 'success');
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  const handleAdd = async () => {
    if (!newComponent.name || !newComponent.content) return;
    try {
      const response = await fetch('/api/stitch/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newComponent,
          tags: newComponent.tags.split(',').map(t => t.trim()).filter(Boolean),
          projectType: projectType || 'all',
          isGlobal: true,
        }),
      });
      if (!response.ok) throw new Error('Failed to add component');
      const data = await response.json();
      setComponents(prev => [data.component, ...prev]);
      setIsAdding(false);
      setNewComponent({ name: '', category: 'section', contentType: 'json', description: '', tags: '', content: '' });
      onNotification?.('Component added', 'success');
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  const handleReindex = async () => {
    try {
      const response = await fetch('/api/stitch/components/reindex', { method: 'POST' });
      if (!response.ok) throw new Error('Reindex failed');
      const data = await response.json();
      onNotification?.(`Reindexed ${data.count} components`, 'success');
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (selectedIds.size > 0 && onComponentsSelected) {
      onComponentsSelected(components.filter(c => selectedIds.has(c.id)));
    }
  }, [selectedIds, components]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border-300)' }}>
        <div className="flex items-center gap-2">
          <Package size={14} style={{ color: 'var(--neon-color)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-100)' }}>Component Library</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleReindex}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-500)' }}
            title="Reindex embeddings"
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--neon-color)' }}
            title="Add component"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border-300)' }}>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)' }}>
            <Search size={12} style={{ color: 'var(--text-500)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search components..."
              className="flex-1 bg-transparent text-xs outline-none"
              style={{ color: 'var(--text-100)' }}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); loadComponents(); }} style={{ color: 'var(--text-500)' }}>
                <X size={10} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 px-3 py-1.5 overflow-x-auto scrollbar-hidden" style={{ borderBottom: '1px solid var(--border-300)' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-all"
            style={{
              backgroundColor: activeCategory === cat.key ? 'rgba(var(--neon-rgb), 0.2)' : 'transparent',
              color: activeCategory === cat.key ? 'var(--neon-color)' : 'var(--text-500)',
            }}
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
      </div>

      {/* Add form */}
      {isAdding && (
        <div className="px-3 py-2 space-y-2" style={{ borderBottom: '1px solid var(--border-300)', backgroundColor: 'var(--bg-200)' }}>
          <input
            type="text"
            value={newComponent.name}
            onChange={e => setNewComponent(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Component name"
            className="w-full px-2 py-1 rounded text-xs outline-none"
            style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)', color: 'var(--text-100)' }}
          />
          <div className="flex gap-2">
            <select
              value={newComponent.category}
              onChange={e => setNewComponent(prev => ({ ...prev, category: e.target.value as any }))}
              className="flex-1 px-2 py-1 rounded text-xs outline-none"
              style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)', color: 'var(--text-100)' }}
            >
              <option value="section">Section</option>
              <option value="component">Component</option>
              <option value="icon">Icon</option>
              <option value="svg">SVG</option>
              <option value="template">Template</option>
            </select>
            <select
              value={newComponent.contentType}
              onChange={e => setNewComponent(prev => ({ ...prev, contentType: e.target.value as any }))}
              className="flex-1 px-2 py-1 rounded text-xs outline-none"
              style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)', color: 'var(--text-100)' }}
            >
              <option value="json">JSON Spec</option>
              <option value="html">HTML</option>
              <option value="svg">SVG</option>
            </select>
          </div>
          <input
            type="text"
            value={newComponent.description}
            onChange={e => setNewComponent(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Description (for search)"
            className="w-full px-2 py-1 rounded text-xs outline-none"
            style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)', color: 'var(--text-100)' }}
          />
          <input
            type="text"
            value={newComponent.tags}
            onChange={e => setNewComponent(prev => ({ ...prev, tags: e.target.value }))}
            placeholder="Tags (comma-separated)"
            className="w-full px-2 py-1 rounded text-xs outline-none"
            style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)', color: 'var(--text-100)' }}
          />
          <textarea
            value={newComponent.content}
            onChange={e => setNewComponent(prev => ({ ...prev, content: e.target.value }))}
            placeholder="Content (HTML, SVG, or JSON)"
            className="w-full px-2 py-1 rounded text-xs outline-none resize-none h-20 font-mono"
            style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)', color: 'var(--text-100)' }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newComponent.name || !newComponent.content}
              className="px-3 py-1 rounded text-xs font-medium disabled:opacity-40"
              style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
            >
              Add
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="px-3 py-1 rounded text-xs"
              style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-300)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Component list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--border-300)', borderTopColor: 'var(--neon-color)' }} />
          </div>
        ) : components.length === 0 ? (
          <div className="text-center py-8">
            <Package size={24} className="mx-auto mb-2" style={{ color: 'var(--text-500)' }} />
            <p className="text-xs" style={{ color: 'var(--text-500)' }}>No components found</p>
          </div>
        ) : (
          components.map(comp => {
            const isSelected = selectedIds.has(comp.id);
            const score = 'score' in comp ? (comp as any).score : undefined;
            return (
              <div
                key={comp.id}
                onClick={() => toggleSelect(comp.id)}
                className="group flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all"
                style={{
                  backgroundColor: isSelected ? 'rgba(var(--neon-rgb), 0.1)' : 'var(--bg-200)',
                  border: isSelected ? '1px solid rgba(var(--neon-rgb), 0.3)' : '1px solid var(--border-300)',
                }}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {isSelected ? (
                    <Check size={12} style={{ color: 'var(--neon-color)' }} />
                  ) : (
                    <div className="w-3 h-3 rounded-sm" style={{ border: '1px solid var(--border-300)' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-100)' }}>{comp.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}>
                      {comp.category}
                    </span>
                    {score !== undefined && (
                      <span className="text-[9px] px-1 py-0.5 rounded" style={{ color: 'var(--neon-color)' }}>
                        {(score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-500)' }}>{comp.description}</p>
                  {comp.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {comp.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[8px] px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(comp.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity flex-shrink-0"
                  style={{ color: '#ef4444' }}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Selection footer */}
      {selectedIds.size > 0 && (
        <div className="px-3 py-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-300)', backgroundColor: 'var(--bg-200)' }}>
          <span className="text-[10px]" style={{ color: 'var(--text-500)' }}>
            {selectedIds.size} component{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-[10px] px-2 py-0.5 rounded"
            style={{ color: 'var(--text-300)' }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

export default StitchLibrary;
