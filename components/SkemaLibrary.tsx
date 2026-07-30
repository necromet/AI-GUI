import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Plus, Trash2, X, Package, Layers, Image as ImageIcon, Code, LayoutGrid, RefreshCw, Check, Palette, Layout, Upload, Link as LinkIcon } from 'lucide-react';
import type { SkemaComponent } from '../types/skemaSpec';
import type { SkemaProjectType } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SkemaLibraryProps {
  projectType?: SkemaProjectType;
  theme?: 'dark' | 'light';
  onComponentsSelected?: (components: SkemaComponent[]) => void;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  onPaletteSelect?: (palette: { name: string; colors: string[] }) => void;
  onLayoutSelect?: (layout: SkemaComponent) => void;
}

const CATEGORIES = [
  { key: 'all', label: 'All', icon: <Package className="h-3.5 w-3.5" /> },
  { key: 'section', label: 'Sections', icon: <Layers className="h-3.5 w-3.5" /> },
  { key: 'component', label: 'Components', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { key: 'image', label: 'Images', icon: <ImageIcon className="h-3.5 w-3.5" /> },
  { key: 'palette', label: 'Palettes', icon: <Palette className="h-3.5 w-3.5" /> },
  { key: 'layout', label: 'Layouts', icon: <Layout className="h-3.5 w-3.5" /> },
  { key: 'icon', label: 'Icons', icon: <ImageIcon className="h-3.5 w-3.5" /> },
  { key: 'svg', label: 'SVGs', icon: <Code className="h-3.5 w-3.5" /> },
  { key: 'template', label: 'Templates', icon: <Layers className="h-3.5 w-3.5" /> },
];

const PALETTE_PRESETS: { name: string; colors: string[] }[] = [
  { name: 'Neon Dark', colors: ['#0f0f23', '#6366f1', '#a5b4fc', '#f59e0b', '#10b981'] },
  { name: 'Sunset Warm', colors: ['#fef7ed', '#f97316', '#ef4444', '#f59e0b', '#78350f'] },
  { name: 'Ocean Cool', colors: ['#f0f9ff', '#0ea5e9', '#06b6d4', '#1e40af', '#0c4a6e'] },
  { name: 'Forest Earth', colors: ['#f0fdf4', '#22c55e', '#15803d', '#92400e', '#451a03'] },
  { name: 'Monochrome', colors: ['#ffffff', '#f5f5f5', '#a3a3a3', '#525252', '#0a0a0a'] },
];

const SkemaLibrary: React.FC<SkemaLibraryProps> = ({
  projectType,
  theme = 'dark',
  onComponentsSelected,
  onNotification,
  onPaletteSelect,
  onLayoutSelect,
}) => {
  const [components, setComponents] = useState<SkemaComponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [addCategory, setAddCategory] = useState<string>('section');
  const [newComponent, setNewComponent] = useState({
    name: '',
    category: 'section' as SkemaComponent['category'],
    contentType: 'json' as SkemaComponent['contentType'],
    description: '',
    tags: '',
    content: '',
  });
  const [paletteColors, setPaletteColors] = useState<string[]>(['#6366f1', '#a5b4fc', '#f59e0b']);
  const [newColorInput, setNewColorInput] = useState('#10b981');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageLabelInput, setImageLabelInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadComponents = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'all') params.set('category', activeCategory);
      if (projectType) params.set('projectType', projectType);

      const response = await fetch(`/api/skema/components?${params}`);
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
      const response = await fetch('/api/skema/components/search', {
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
      const response = await fetch(`/api/skema/components/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
      setComponents(prev => prev.filter(c => c.id !== id));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      onNotification?.('Component deleted', 'success');
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  const handleAdd = async () => {
    if (!newComponent.name) return;

    let content = newComponent.content;
    let contentType = newComponent.contentType;
    const category = newComponent.category;

    if (category === 'palette') {
      content = JSON.stringify(paletteColors);
      contentType = 'colors';
    } else if (category === 'image') {
      if (!imageUrlInput.trim()) return;
      content = imageUrlInput.trim();
      contentType = content.startsWith('data:') ? 'image-base64' : 'image-url';
    }

    if (!content) return;

    try {
      const response = await fetch('/api/skema/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newComponent.name,
          category,
          contentType,
          description: newComponent.description,
          tags: newComponent.tags.split(',').map(t => t.trim()).filter(Boolean),
          content,
          projectType: projectType || 'all',
          isGlobal: true,
          thumbnail: category === 'image' ? content : undefined,
        }),
      });
      if (!response.ok) throw new Error('Failed to add component');
      const data = await response.json();
      setComponents(prev => [data.component, ...prev]);
      setIsAdding(false);
      resetAddForm();
      onNotification?.('Component added', 'success');
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      setImageUrlInput(dataUri);
      if (!imageLabelInput) {
        setImageLabelInput(file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '-'));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const resetAddForm = () => {
    setNewComponent({ name: '', category: 'section', contentType: 'json', description: '', tags: '', content: '' });
    setPaletteColors(['#6366f1', '#a5b4fc', '#f59e0b']);
    setNewColorInput('#10b981');
    setImageUrlInput('');
    setImageLabelInput('');
  };

  const openAddDialog = (category?: string) => {
    const cat = category || 'section';
    setAddCategory(cat);
    setNewComponent(prev => ({
      ...prev,
      category: cat as SkemaComponent['category'],
      contentType: cat === 'palette' ? 'colors' : cat === 'image' ? 'image-url' : 'json',
    }));
    setIsAdding(true);
  };

  const handleReindex = async () => {
    try {
      const response = await fetch('/api/skema/components/reindex', { method: 'POST' });
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

  const parseColors = (content: string): string[] => {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return [];
  };

  const renderComponentCard = (comp: SkemaComponent) => {
    const isSelected = selectedIds.has(comp.id);
    const score = 'score' in comp ? (comp as any).score : undefined;

    if (comp.category === 'image') {
      return (
        <Card
          key={comp.id}
          onClick={() => toggleSelect(comp.id)}
          className="group cursor-pointer transition-all p-0 overflow-hidden"
          style={{
            backgroundColor: isSelected ? 'rgba(var(--neon-rgb), 0.1)' : 'var(--bg-200)',
            borderColor: isSelected ? 'rgba(var(--neon-rgb), 0.3)' : 'var(--border-300)',
          }}
        >
          <div
            className="w-full h-20 bg-cover bg-center"
            style={{
              backgroundImage: `url(${comp.thumbnail || comp.content})`,
              backgroundColor: 'var(--bg-300)',
            }}
          />
          <CardContent className="p-2.5 flex items-start gap-2.5">
            <div className="flex-shrink-0 mt-0.5">
              {isSelected ? (
                <Check size={14} style={{ color: 'var(--neon-color)' }} />
              ) : (
                <div className="w-3.5 h-3.5 rounded-sm" style={{ border: '1px solid var(--border-300)' }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium truncate" style={{ color: 'var(--text-100)' }}>{comp.name}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 rounded-full">image</Badge>
                {score !== undefined && (
                  <span className="text-[10px] px-1 py-0.5 rounded" style={{ color: 'var(--neon-color)' }}>
                    {(score * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-500)' }}>{comp.description}</p>
              {comp.tags.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {comp.tags.slice(0, 3).map(tag => (
                    <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0.5">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={e => { e.stopPropagation(); handleDelete(comp.id); }}
              >
                <Trash2 size={12} className="text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (comp.category === 'palette') {
      const colors = parseColors(comp.content);
      return (
        <Card
          key={comp.id}
          onClick={() => toggleSelect(comp.id)}
          className="group cursor-pointer transition-all p-0"
          style={{
            backgroundColor: isSelected ? 'rgba(var(--neon-rgb), 0.1)' : 'var(--bg-200)',
            borderColor: isSelected ? 'rgba(var(--neon-rgb), 0.3)' : 'var(--border-300)',
          }}
        >
          <CardContent className="p-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex gap-0.5 flex-shrink-0">
                {colors.slice(0, 6).map((color, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-md border"
                    style={{ backgroundColor: color, borderColor: 'rgba(255,255,255,0.1)' }}
                    title={color}
                  />
                ))}
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                {isSelected ? (
                  <Check size={14} style={{ color: 'var(--neon-color)' }} />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ border: '1px solid var(--border-300)' }} />
                )}
                <span className="text-sm font-medium truncate" style={{ color: 'var(--text-100)' }}>{comp.name}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0">palette</Badge>
              </div>
            </div>
            <p className="text-xs truncate" style={{ color: 'var(--text-500)' }}>{comp.description}</p>
            <div className="flex items-center gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {onPaletteSelect && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={e => {
                    e.stopPropagation();
                    onPaletteSelect({ name: comp.name, colors });
                    onNotification?.(`Palette "${comp.name}" selected`, 'success');
                  }}
                >
                  Apply
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={e => { e.stopPropagation(); handleDelete(comp.id); }}
              >
                <Trash2 size={11} className="text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (comp.category === 'layout') {
      return (
        <Card
          key={comp.id}
          onClick={() => toggleSelect(comp.id)}
          className="group cursor-pointer transition-all p-0"
          style={{
            backgroundColor: isSelected ? 'rgba(var(--neon-rgb), 0.1)' : 'var(--bg-200)',
            borderColor: isSelected ? 'rgba(var(--neon-rgb), 0.3)' : 'var(--border-300)',
          }}
        >
          <CardContent className="p-2.5 flex items-start gap-2.5">
            <div className="flex-shrink-0 mt-0.5">
              {isSelected ? (
                <Check size={14} style={{ color: 'var(--neon-color)' }} />
              ) : (
                <div className="w-3.5 h-3.5 rounded-sm" style={{ border: '1px solid var(--border-300)' }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Layout size={12} style={{ color: 'var(--neon-color)' }} />
                <span className="text-sm font-medium truncate" style={{ color: 'var(--text-100)' }}>{comp.name}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 rounded-full">layout</Badge>
              </div>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-500)' }}>{comp.description}</p>
              {comp.specSnippet && (
                <p className="text-[10px] mt-0.5 font-mono truncate" style={{ color: 'var(--text-500)', opacity: 0.6 }}>
                  {comp.specSnippet}
                </p>
              )}
              {comp.tags.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {comp.tags.slice(0, 3).map(tag => (
                    <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0.5">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {onLayoutSelect && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={e => {
                    e.stopPropagation();
                    onLayoutSelect(comp);
                    onNotification?.(`Layout "${comp.name}" selected`, 'success');
                  }}
                  title="Use as template"
                >
                  <Plus size={12} style={{ color: 'var(--neon-color)' }} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={e => { e.stopPropagation(); handleDelete(comp.id); }}
              >
                <Trash2 size={12} className="text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Default card for section, component, icon, svg, template, widget
    return (
      <Card
        key={comp.id}
        onClick={() => toggleSelect(comp.id)}
        className="group cursor-pointer transition-all p-0"
        style={{
          backgroundColor: isSelected ? 'rgba(var(--neon-rgb), 0.1)' : 'var(--bg-200)',
          borderColor: isSelected ? 'rgba(var(--neon-rgb), 0.3)' : 'var(--border-300)',
        }}
      >
        <CardContent className="p-2.5 flex items-start gap-2.5">
          <div className="flex-shrink-0 mt-0.5">
            {isSelected ? (
              <Check size={14} style={{ color: 'var(--neon-color)' }} />
            ) : (
              <div className="w-3.5 h-3.5 rounded-sm" style={{ border: '1px solid var(--border-300)' }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium truncate" style={{ color: 'var(--text-100)' }}>{comp.name}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 rounded-full">
                {comp.category}
              </Badge>
              {score !== undefined && (
                <span className="text-[10px] px-1 py-0.5 rounded" style={{ color: 'var(--neon-color)' }}>
                  {(score * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-500)' }}>{comp.description}</p>
            {comp.tags.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {comp.tags.slice(0, 3).map(tag => (
                  <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0.5">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            onClick={e => { e.stopPropagation(); handleDelete(comp.id); }}
          >
            <Trash2 size={12} className="text-destructive" />
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid var(--border-300)' }}>
        <div className="flex items-center gap-2">
          <Package size={16} style={{ color: 'var(--neon-color)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>Library</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReindex} title="Reindex embeddings">
            <RefreshCw size={14} style={{ color: 'var(--text-500)' }} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAddDialog()} title="Add component">
            <Plus size={14} style={{ color: 'var(--neon-color)' }} />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border-300)' }}>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)' }}>
            <Search size={14} style={{ color: 'var(--text-500)' }} />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search library..."
              className="h-7 border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
              style={{ color: 'var(--text-100)' }}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 p-0"
                onClick={() => { setSearchQuery(''); loadComponents(); }}
              >
                <X size={12} style={{ color: 'var(--text-500)' }} />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 px-3 py-1.5 overflow-x-auto scrollbar-hidden" style={{ borderBottom: '1px solid var(--border-300)' }}>
        {CATEGORIES.map(cat => (
          <Button
            key={cat.key}
            variant={activeCategory === cat.key ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2.5 text-xs font-medium gap-1.5 flex-shrink-0"
            onClick={() => setActiveCategory(cat.key)}
            style={{
              backgroundColor: activeCategory === cat.key ? 'rgba(var(--neon-rgb), 0.2)' : undefined,
              color: activeCategory === cat.key ? 'var(--neon-color)' : 'var(--text-500)',
            }}
          >
            {cat.icon}
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Add component dialog */}
      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {addCategory === 'image' ? 'Add Image' : addCategory === 'palette' ? 'Add Palette' : addCategory === 'layout' ? 'Add Layout' : 'Add Component'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="comp-name" className="text-sm">Name</Label>
              <Input
                id="comp-name"
                value={addCategory === 'image' ? imageLabelInput : newComponent.name}
                onChange={e => {
                  if (addCategory === 'image') setImageLabelInput(e.target.value);
                  else setNewComponent(prev => ({ ...prev, name: e.target.value }));
                }}
                placeholder={addCategory === 'image' ? 'Image label (e.g. hero-photo)' : 'Component name'}
                className="h-9 text-sm"
              />
            </div>

            {/* Category & Content Type — hidden for image/palette (auto-set) */}
            {addCategory !== 'image' && addCategory !== 'palette' && (
              <div className="flex gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="comp-category" className="text-sm">Category</Label>
                  <select
                    id="comp-category"
                    value={newComponent.category}
                    onChange={e => {
                      const cat = e.target.value as SkemaComponent['category'];
                      setAddCategory(cat);
                      setNewComponent(prev => ({
                        ...prev,
                        category: cat,
                        contentType: cat === 'palette' ? 'colors' : cat === 'image' ? 'image-url' : 'json',
                      }));
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="section">Section</option>
                    <option value="component">Component</option>
                    <option value="icon">Icon</option>
                    <option value="svg">SVG</option>
                    <option value="template">Template</option>
                    <option value="layout">Layout</option>
                    <option value="image">Image</option>
                    <option value="palette">Palette</option>
                  </select>
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="comp-content-type" className="text-sm">Content Type</Label>
                  <select
                    id="comp-content-type"
                    value={newComponent.contentType}
                    onChange={e => setNewComponent(prev => ({ ...prev, contentType: e.target.value as any }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="json">JSON Spec</option>
                    <option value="html">HTML</option>
                    <option value="svg">SVG</option>
                  </select>
                </div>
              </div>
            )}

            {/* Description — for all types */}
            <div className="space-y-1.5">
              <Label htmlFor="comp-desc" className="text-sm">Description</Label>
              <Input
                id="comp-desc"
                value={newComponent.description}
                onChange={e => setNewComponent(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description (for search)"
                className="h-9 text-sm"
              />
            </div>

            {/* Tags — for all types */}
            <div className="space-y-1.5">
              <Label htmlFor="comp-tags" className="text-sm">Tags</Label>
              <Input
                id="comp-tags"
                value={newComponent.tags}
                onChange={e => setNewComponent(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="Tags (comma-separated)"
                className="h-9 text-sm"
              />
            </div>

            {/* Image-specific: URL/upload */}
            {addCategory === 'image' && (
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label className="text-sm">Image URL</Label>
                  <Input
                    value={imageUrlInput}
                    onChange={e => setImageUrlInput(e.target.value)}
                    placeholder="Paste image URL..."
                    className="h-9 text-sm"
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 px-3 text-xs font-medium"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={12} className="mr-1" />
                    Upload File
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageFileUpload} className="hidden" />
                  {imageUrlInput && (
                    <div className="flex-1 flex items-center gap-1.5">
                      <div
                        className="w-8 h-8 rounded bg-cover bg-center flex-shrink-0"
                        style={{ backgroundImage: `url(${imageUrlInput})`, backgroundColor: 'var(--bg-300)' }}
                      />
                      <span className="text-xs truncate" style={{ color: 'var(--text-500)' }}>Preview</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Palette-specific: color picker */}
            {addCategory === 'palette' && (
              <div className="space-y-2">
                <Label className="text-sm">Colors</Label>
                <div className="flex flex-wrap gap-1.5">
                  {paletteColors.map((color, i) => (
                    <div key={i} className="relative group/color">
                      <input
                        type="color"
                        value={color}
                        onChange={e => {
                          const next = [...paletteColors];
                          next[i] = e.target.value;
                          setPaletteColors(next);
                        }}
                        className="w-8 h-8 rounded-md cursor-pointer border-0 p-0"
                        style={{ backgroundColor: color }}
                      />
                      <button
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/color:opacity-100 transition-opacity"
                        onClick={() => setPaletteColors(prev => prev.filter((_, j) => j !== i))}
                      >
                        <X size={8} />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      value={newColorInput}
                      onChange={e => setNewColorInput(e.target.value)}
                      className="w-8 h-8 rounded-md cursor-pointer border-0 p-0"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => {
                        if (paletteColors.length < 8) {
                          setPaletteColors(prev => [...prev, newColorInput]);
                        }
                      }}
                      disabled={paletteColors.length >= 8}
                    >
                      <Plus size={10} />
                    </Button>
                  </div>
                </div>
                {/* Quick presets */}
                <div className="flex gap-1 flex-wrap">
                  {PALETTE_PRESETS.map(preset => (
                    <Button
                      key={preset.name}
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[9px] gap-1"
                      onClick={() => {
                        setPaletteColors(preset.colors);
                        if (!imageLabelInput && !newComponent.name) {
                          setNewComponent(prev => ({ ...prev, name: preset.name }));
                        }
                      }}
                    >
                      <div className="flex gap-px">
                        {preset.colors.slice(0, 3).map((c, i) => (
                          <div key={i} className="w-2 h-2 rounded-sm" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      {preset.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Content textarea — for non-image, non-palette */}
            {addCategory !== 'image' && addCategory !== 'palette' && (
              <div className="space-y-1.5">
                <Label htmlFor="comp-content" className="text-sm">Content</Label>
                <Textarea
                  id="comp-content"
                  value={newComponent.content}
                  onChange={e => setNewComponent(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Content (HTML, SVG, or JSON)"
                  className="h-24 text-sm font-mono resize-none"
                />
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-sm"
                onClick={() => { setIsAdding(false); resetAddForm(); }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-9 text-sm"
                onClick={handleAdd}
                disabled={
                  addCategory === 'image'
                    ? !imageLabelInput || !imageUrlInput
                    : addCategory === 'palette'
                      ? !newComponent.name || paletteColors.length < 2
                      : !newComponent.name || !newComponent.content
                }
              >
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Component list */}
      <ScrollArea className="flex-1">
        <div className="px-3 py-2 space-y-1.5">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--border-300)', borderTopColor: 'var(--neon-color)' }} />
            </div>
          ) : components.length === 0 ? (
            <div className="text-center py-8">
              <Package size={28} className="mx-auto mb-2" style={{ color: 'var(--text-500)' }} />
              <p className="text-sm" style={{ color: 'var(--text-500)' }}>No components found</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs"
                style={{ color: 'var(--neon-color)' }}
                onClick={() => openAddDialog(activeCategory === 'all' ? undefined : activeCategory)}
              >
                <Plus size={12} className="mr-1" />
                Add {activeCategory === 'all' ? 'component' : activeCategory}
              </Button>
            </div>
          ) : (
            components.map(comp => renderComponentCard(comp))
          )}
        </div>
      </ScrollArea>

      {/* Selection footer */}
      {selectedIds.size > 0 && (
        <div className="px-3 py-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-300)', backgroundColor: 'var(--bg-200)' }}>
          <span className="text-xs" style={{ color: 'var(--text-500)' }}>
            {selectedIds.size} component{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
};

export default SkemaLibrary;
