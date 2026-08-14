import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Plus, X, Package, RefreshCw, Sparkles, Layers, LayoutGrid, Folder, ChevronRight, Loader2 } from 'lucide-react';
import { LibraryComponent, LibraryFolder, ModelConfig } from '../types';
import * as db from '../services/apiDatabaseAdapter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { CATEGORIES } from './library/constants';
import { ComponentCard } from './library/ComponentCard';
import { FolderCard } from './library/FolderCard';
import { CreateComponentDialog } from './library/CreateComponentDialog';
import { CreateFolderDialog } from './library/CreateFolderDialog';
import { EditFolderDialog } from './library/EditFolderDialog';
import { EditComponentDialog } from './library/EditComponentDialog';
import { ComponentEditor, type LibraryControls } from './library/ComponentEditor';

export type { LibraryControls } from './library/ComponentEditor';

interface LibraryPanelProps {
  theme?: 'dark' | 'light';
  modelConfig?: ModelConfig;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  onControlsChange?: (controls: LibraryControls | null) => void;
}

const LibraryPanel: React.FC<LibraryPanelProps> = ({ theme = 'dark', modelConfig, onNotification, onControlsChange }) => {
  const navigate = useNavigate();
  const { componentId, folderId: routeFolderId } = useParams<{ componentId: string; folderId: string }>();
  const [components, setComponents] = useState<LibraryComponent[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedComponent, setSelectedComponent] = useState<LibraryComponent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingComponent, setEditingComponent] = useState<LibraryComponent | null>(null);
  const [editingFolder, setEditingFolder] = useState<LibraryFolder | null>(null);
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [movingComponentId, setMovingComponentId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const pageSize = 24;

  const activeFolder = useMemo(() => {
    if (!routeFolderId || folders.length === 0) return null;
    return folders.find(f => f.id === routeFolderId) || null;
  }, [routeFolderId, folders]);

  const loadComponents = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'all') params.set('category', activeCategory);
      if (activeFolder) {
        params.set('folderId', activeFolder.id);
      } else if (folders.length > 0) {
        params.set('unfoldered', 'true');
      }
      params.set('limit', String(pageSize));
      params.set('offset', '0');

      const response = await fetch(`/api/library/components?${params}`);
      if (!response.ok) throw new Error('Failed to load components');
      const data = await response.json();
      setComponents(data.components || []);
      setTotal(data.total || 0);
      setHasMore(data.hasMore || false);
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, activeFolder, folders.length, onNotification]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'all') params.set('category', activeCategory);
      if (activeFolder) {
        params.set('folderId', activeFolder.id);
      } else if (folders.length > 0) {
        params.set('unfoldered', 'true');
      }
      params.set('limit', String(pageSize));
      params.set('offset', String(components.length));

      const response = await fetch(`/api/library/components?${params}`);
      if (!response.ok) throw new Error('Failed to load components');
      const data = await response.json();
      setComponents(prev => [...prev, ...(data.components || [])]);
      setHasMore(data.hasMore || false);
      setTotal(data.total || 0);
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeCategory, activeFolder, folders.length, onNotification, isLoadingMore, hasMore, components.length]);

  const loadFolders = useCallback(async () => {
    try {
      const folders = await db.getLibraryFolders();
      setFolders(folders);
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  }, [onNotification]);

  useEffect(() => { loadComponents(); }, [loadComponents]);
  useEffect(() => { loadFolders(); }, [loadFolders]);

  useEffect(() => {
    const handler = () => { db.invalidateLibraryCache(); loadComponents(); loadFolders(); };
    window.addEventListener('library-reload', handler);
    return () => window.removeEventListener('library-reload', handler);
  }, [loadComponents, loadFolders]);

  useEffect(() => {
    setActiveCategory('all');
    setSearchQuery('');
  }, [routeFolderId]);

  useEffect(() => {
    if (!componentId || components.length === 0) return;
    if (selectedComponent?.id === componentId) return;
    const match = components.find(c => c.id === componentId);
    if (match) setSelectedComponent(match);
  }, [componentId, components]);

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
      db.invalidateLibraryCache();
      onNotification?.(data.message, 'success');
      await loadComponents();
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const response = await fetch(`/api/library/components/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
      db.invalidateLibraryCache();
      setComponents(prev => prev.filter(c => c.id !== id));
      if (selectedComponent?.id === id) {
        setSelectedComponent(null);
        if (activeFolder) {
          navigate(`/library/folder/${activeFolder.id}`);
        } else {
          navigate('/library');
        }
      }
      onNotification?.('Component deleted', 'success');
      loadFolders();
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  const handleCopy = (component: LibraryComponent, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(component.content).then(() => {
      setCopiedId(component.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleDuplicate = async (component: LibraryComponent, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const response = await fetch(`/api/library/components/${component.id}/duplicate`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to duplicate');
      const data = await response.json();
      db.invalidateLibraryCache();
      setComponents(prev => [data.component, ...prev]);
      onNotification?.('Component duplicated', 'success');
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  const handleEdit = (component: LibraryComponent, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingComponent(component);
    setTimeout(() => setIsEditing(true), 50);
  };

  const handleEditSaved = (updated: LibraryComponent) => {
    db.invalidateLibraryCache();
    setComponents(prev => prev.map(c => c.id === updated.id ? updated : c));
    if (selectedComponent?.id === updated.id) {
      setSelectedComponent(updated);
    }
  };

  const handleCreated = (component: LibraryComponent) => {
    db.invalidateLibraryCache();
    setComponents(prev => [component, ...prev]);
    loadFolders();
  };

  const handleSelectComponent = (comp: LibraryComponent) => {
    setSelectedComponent(comp);
    if (activeFolder) {
      navigate(`/library/folder/${activeFolder.id}/${comp.id}`, { replace: true });
    } else {
      navigate(`/library/${comp.id}`, { replace: true });
    }
  };

  const handleSelectFolder = (folder: LibraryFolder) => {
    navigate(`/library/folder/${folder.id}`, { replace: true });
  };

  const handleBackToFolders = () => {
    navigate('/library', { replace: true });
  };

  const handleFolderCreated = (folder: LibraryFolder) => {
    db.invalidateLibraryCache();
    setFolders(prev => [...prev, { ...folder, componentCount: 0 }]);
  };

  const handleFolderSaved = (updated: LibraryFolder) => {
    db.invalidateLibraryCache();
    setFolders(prev => prev.map(f => f.id === updated.id ? updated : f));
  };

  const handleDeleteFolder = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const response = await fetch(`/api/library/folders/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete folder failed');
      db.invalidateLibraryCache();
      setFolders(prev => prev.filter(f => f.id !== id));
      if (activeFolder?.id === id) {
        navigate('/library', { replace: true });
      }
      onNotification?.('Folder deleted', 'success');
      loadComponents();
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  const handleEditFolder = (folder: LibraryFolder, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingFolder(folder);
    setTimeout(() => setIsEditingFolder(true), 50);
  };

  const handleMoveToFolder = async (componentId: string, folderId: string | null) => {
    try {
      const response = await fetch(`/api/library/components/${componentId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      });
      if (!response.ok) throw new Error('Move failed');
      db.invalidateLibraryCache();
      onNotification?.(folderId ? 'Moved to folder' : 'Removed from folder', 'success');
      await loadComponents();
      await loadFolders();
    } catch (err: any) {
      onNotification?.(err.message, 'error');
    }
  };

  if (selectedComponent) {
    return (
      <ComponentEditor
        selectedComponent={selectedComponent}
        setSelectedComponent={(comp) => {
          setSelectedComponent(comp);
          if (!comp) {
            if (activeFolder) {
              navigate(`/library/folder/${activeFolder.id}`);
            } else {
              navigate('/library');
            }
          }
        }}
        onNotification={onNotification}
        onControlsChange={onControlsChange}
        onComponentsReload={() => { loadComponents(); loadFolders(); }}
      />
    );
  }

  const filteredCount = total || components.length;
  const showFolders = !activeFolder && !searchQuery;

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col h-full">
      {/* Hero Header */}
      <div className="relative overflow-hidden px-6 pt-8 pb-6 flex-shrink-0">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 50% -20%, rgba(var(--neon-rgb), 0.15), transparent)`,
          }}
        />
        <div className="relative flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div
                className="relative p-3 rounded-2xl"
                style={{
                  background: 'rgba(var(--neon-rgb), 0.1)',
                  boxShadow: '0 0 30px rgba(var(--neon-rgb), 0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                <Package size={24} style={{ color: 'var(--neon-color)' }} />
              </div>
              <div>
                <h1
                  className="text-2xl font-bold tracking-tight"
                  style={{ color: 'var(--text-100)' }}
                >
                  Component Library
                </h1>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-500)' }}>
                  Reusable widgets, templates, and agent tools
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 px-3 rounded-xl text-xs"
              onClick={handleSeed}
              disabled={isSeeding}
              style={{
                backgroundColor: 'var(--bg-200)',
                color: 'var(--text-300)',
                borderColor: 'var(--border-300)',
              }}
            >
              <RefreshCw size={13} className={isSeeding ? 'animate-spin' : ''} />
              Seed
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 px-3 rounded-xl text-xs"
              onClick={() => setIsCreatingFolder(true)}
              style={{
                backgroundColor: 'var(--bg-200)',
                color: 'var(--text-300)',
                borderColor: 'var(--border-300)',
              }}
            >
              <Folder size={13} />
              New Folder
            </Button>
            <Button
              size="sm"
              className="gap-1.5 h-9 px-4 rounded-xl text-xs font-semibold"
              onClick={() => setIsCreating(true)}
              style={{
                background: 'linear-gradient(135deg, var(--neon-color), rgba(var(--neon-rgb), 0.8))',
                color: '#000',
                boxShadow: '0 2px 12px rgba(var(--neon-rgb), 0.3)',
              }}
            >
              <Plus size={14} strokeWidth={2.5} />
              New Component
            </Button>
          </div>
        </div>

        {/* Breadcrumb + Stats row */}
        {!isLoading && (
          <div className="relative flex items-center gap-4 mt-5">
            {activeFolder ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleBackToFolders}
                  className="text-xs font-medium transition-colors hover:opacity-80"
                  style={{ color: 'var(--text-500)' }}
                >
                  All Folders
                </button>
                <ChevronRight size={12} style={{ color: 'var(--text-500)' }} />
                <span className="text-xs font-semibold" style={{ color: activeFolder.color }}>
                  {activeFolder.name}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <LayoutGrid size={13} style={{ color: 'var(--text-500)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-500)' }}>
                  {filteredCount} component{filteredCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {!activeFolder && (
              <>
                <div className="w-px h-3" style={{ backgroundColor: 'var(--border-300)' }} />
                <div className="flex items-center gap-1.5">
                  <Folder size={13} style={{ color: 'var(--text-500)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-500)' }}>
                    {folders.length} folder{folders.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="w-px h-3" style={{ backgroundColor: 'var(--border-300)' }} />
                <div className="flex items-center gap-1.5">
                  <Layers size={13} style={{ color: 'var(--text-500)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-500)' }}>
                    {CATEGORIES.length - 1} categories
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <CreateComponentDialog
        open={isCreating}
        onOpenChange={setIsCreating}
        onCreated={handleCreated}
        onNotification={onNotification}
        defaultFolderId={activeFolder?.id}
      />

      <EditComponentDialog
        open={isEditing}
        component={editingComponent}
        onOpenChange={setIsEditing}
        onSaved={handleEditSaved}
        onNotification={onNotification}
        folders={folders}
      />

      <CreateFolderDialog
        open={isCreatingFolder}
        onOpenChange={setIsCreatingFolder}
        onCreated={handleFolderCreated}
        onNotification={onNotification}
      />

      <EditFolderDialog
        open={isEditingFolder}
        folder={editingFolder}
        onOpenChange={setIsEditingFolder}
        onSaved={handleFolderSaved}
        onNotification={onNotification}
      />

      {/* Search Bar */}
      <div className="px-6 pb-4 flex-shrink-0">
        <div
          className="flex items-center gap-3 h-11 px-4 rounded-xl transition-all duration-200"
          style={{
            backgroundColor: 'var(--bg-200)',
            border: '1px solid var(--border-300)',
          }}
        >
          <Search size={15} style={{ color: 'var(--text-500)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder={activeFolder ? `Search in ${activeFolder.name}...` : 'Search components by name, tag, or description...'}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-500)]"
            style={{ color: 'var(--text-100)' }}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); loadComponents(); }}
              className="p-1 rounded-md transition-colors hover:bg-[var(--bg-300)]"
              style={{ color: 'var(--text-500)' }}
            >
              <X size={13} />
            </button>
          )}
          <div className="w-px h-5" style={{ backgroundColor: 'var(--border-300)' }} />
          <button
            onClick={handleSearch}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-150"
            style={{
              backgroundColor: 'rgba(var(--neon-rgb), 0.1)',
              color: 'var(--neon-color)',
            }}
          >
            Search
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-6 pb-5 flex-shrink-0">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-1.5">
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap"
                  style={{
                    backgroundColor: isActive ? 'rgba(var(--neon-rgb), 0.15)' : 'transparent',
                    color: isActive ? 'var(--neon-color)' : 'var(--text-500)',
                    border: isActive ? '1px solid rgba(var(--neon-rgb), 0.25)' : '1px solid transparent',
                  }}
                >
                  {cat.icon}
                  {cat.label}
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" className="h-1.5" />
        </ScrollArea>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative">
              <div
                className="w-10 h-10 rounded-full animate-spin"
                style={{
                  border: '2px solid var(--border-300)',
                  borderTopColor: 'var(--neon-color)',
                }}
              />
              <div
                className="absolute inset-0 rounded-full animate-ping opacity-20"
                style={{ backgroundColor: 'var(--neon-color)' }}
              />
            </div>
            <span className="text-sm" style={{ color: 'var(--text-500)' }}>Loading components...</span>
          </div>
        ) : components.length === 0 && (!showFolders || folders.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div
              className="relative p-6 rounded-3xl mb-6"
              style={{
                background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.08), rgba(var(--neon-rgb), 0.02))',
                border: '1px solid rgba(var(--neon-rgb), 0.1)',
              }}
            >
              <Package size={40} style={{ color: 'var(--neon-color)', opacity: 0.6 }} />
              <div
                className="absolute -top-1 -right-1 p-1 rounded-full"
                style={{ backgroundColor: 'var(--bg-100)' }}
              >
                <Sparkles size={14} style={{ color: 'var(--neon-color)' }} />
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-1.5" style={{ color: 'var(--text-100)' }}>
              {searchQuery ? 'No results found' : activeFolder ? 'This folder is empty' : 'No components yet'}
            </h3>
            <p className="text-sm mb-6 max-w-sm text-center leading-relaxed" style={{ color: 'var(--text-500)' }}>
              {searchQuery
                ? `No components match "${searchQuery}". Try a different search term.`
                : activeFolder
                  ? 'Move components into this folder or create new ones.'
                  : 'Create your first component or seed the library with defaults to get started.'
              }
            </p>
            {!searchQuery && (
              <div className="flex items-center gap-2">
                <Button
                  className="gap-1.5 rounded-xl text-sm font-semibold"
                  onClick={activeFolder ? () => setIsCreating(true) : handleSeed}
                  style={{
                    background: 'linear-gradient(135deg, var(--neon-color), rgba(var(--neon-rgb), 0.8))',
                    color: '#000',
                    boxShadow: '0 2px 12px rgba(var(--neon-rgb), 0.3)',
                  }}
                >
                  {activeFolder ? <><Plus size={14} /> Create Component</> : <><Sparkles size={14} /> Seed Default Components</>}
                </Button>
                {!activeFolder && (
                  <Button
                    variant="outline"
                    className="gap-1.5 rounded-xl text-sm"
                    onClick={() => setIsCreating(true)}
                    style={{
                      borderColor: 'var(--border-300)',
                      color: 'var(--text-300)',
                    }}
                  >
                    <Plus size={14} />
                    Create New
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Folders Grid (only on root view) */}
            {showFolders && folders.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Folder size={14} style={{ color: 'var(--text-500)' }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>
                    Folders
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {folders.map((folder, idx) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      index={idx}
                      onSelect={handleSelectFolder}
                      onEdit={handleEditFolder}
                      onDelete={handleDeleteFolder}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Components Grid */}
            {components.length > 0 && (
              <div>
                {showFolders && folders.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <LayoutGrid size={14} style={{ color: 'var(--text-500)' }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>
                      {activeCategory !== 'all' ? CATEGORIES.find(c => c.key === activeCategory)?.label || 'Components' : 'Components'}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {components.map((comp, idx) => (
                    <ComponentCard
                      key={comp.id}
                      component={comp}
                      index={idx}
                      copiedId={copiedId}
                      onSelect={handleSelectComponent}
                      onCopy={handleCopy}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      onMoveToFolder={handleMoveToFolder}
                      folders={folders}
                    />
                  ))}
                </div>
                {hasMore && !searchQuery && (
                  <div className="flex justify-center mt-6">
                    <Button
                      variant="outline"
                      onClick={loadMore}
                      disabled={isLoadingMore}
                      className="gap-2 rounded-xl text-xs h-9 px-6"
                      style={{
                        backgroundColor: 'var(--bg-200)',
                        color: 'var(--text-300)',
                        borderColor: 'var(--border-300)',
                      }}
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          Load More ({components.length} of {total})
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LibraryPanel;
