import React, { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import type { GridComponent } from './types';
import { CanvasCatalogueCard } from './CanvasCatalogueCard';

interface LibraryComponent {
  id: string;
  name: string;
  category: string;
  contentType: string;
  description: string;
  content: string;
  thumbnail?: string;
}

interface CanvasCatalogueProps {
  onAddToCanvas: (component: LibraryComponent) => void;
}

export const CanvasCatalogue: React.FC<CanvasCatalogueProps> = ({ onAddToCanvas }) => {
  const [components, setComponents] = useState<LibraryComponent[]>([]);
  const [filtered, setFiltered] = useState<LibraryComponent[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComponents = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/library/components');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setComponents(data.components || []);
        const cats = [...new Set((data.components || []).map((c: LibraryComponent) => c.category))] as string[];
        setCategories(cats);
      } catch (err) {
        console.error('Failed to load library components:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchComponents();
  }, []);

  useEffect(() => {
    let result = components;
    if (activeCategory) {
      result = result.filter(c => c.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [components, search, activeCategory]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-3 py-2">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-500)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search components..."
            className="w-full pl-7 pr-7 py-1.5 text-[11px] rounded-md outline-none"
            style={{ background: 'var(--bg-200)', border: '1px solid var(--border-300)', color: 'var(--text-100)' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-500)' }}
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex-shrink-0 px-3 pb-2 flex flex-wrap gap-1">
          <button
            onClick={() => setActiveCategory(null)}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer"
            style={{
              background: !activeCategory ? 'rgba(var(--neon-rgb), 0.15)' : 'var(--bg-200)',
              color: !activeCategory ? 'var(--neon-color)' : 'var(--text-400)',
              border: `1px solid ${!activeCategory ? 'rgba(var(--neon-rgb), 0.3)' : 'var(--border-300)'}`,
            }}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer capitalize"
              style={{
                background: activeCategory === cat ? 'rgba(var(--neon-rgb), 0.15)' : 'var(--bg-200)',
                color: activeCategory === cat ? 'var(--neon-color)' : 'var(--text-400)',
                border: `1px solid ${activeCategory === cat ? 'rgba(var(--neon-rgb), 0.3)' : 'var(--border-300)'}`,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-300)', borderTopColor: 'var(--neon-color)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-20 text-center">
            <p className="text-[11px]" style={{ color: 'var(--text-400)' }}>
              {search ? `No results for "${search}"` : 'No components in library'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {filtered.map(comp => (
              <CanvasCatalogueCard
                key={comp.id}
                component={comp}
                onAdd={() => onAddToCanvas(comp)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
