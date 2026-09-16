import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { NODE_DEFINITIONS, NODE_CATEGORIES } from './constants';
import { ICON_MAP } from './shared/icons';
import { Circle, Search, CornerDownLeft } from 'lucide-react';
import type { WorkflowNodeType } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddNode: (type: WorkflowNodeType) => void;
  recentNodes?: WorkflowNodeType[];
}

export default function CommandPalette({ isOpen, onClose, onAddNode, recentNodes = [] }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [animState, setAnimState] = useState<'enter' | 'visible' | 'exit'>('enter');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allItems = useMemo(() => {
    const items: { type: WorkflowNodeType; label: string; description: string; color: string; icon: string; category: string }[] = [];
    for (const [type, def] of Object.entries(NODE_DEFINITIONS)) {
      items.push({
        type: type as WorkflowNodeType,
        label: def.label,
        description: def.description,
        color: def.color,
        icon: def.icon,
        category: NODE_CATEGORIES.find(c => c.types.includes(type as WorkflowNodeType))?.label || '',
      });
    }
    return items;
  }, []);

  const filteredItems = useMemo(() => {
    if (!query) {
      const recent = recentNodes.map(t => allItems.find(i => i.type === t)).filter(Boolean) as typeof allItems;
      const rest = allItems.filter(i => !recentNodes.includes(i.type));
      return [...recent, ...rest];
    }
    const q = query.toLowerCase();
    return allItems.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q)
    );
  }, [query, allItems, recentNodes]);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => setAnimState('visible'));
    } else if (mounted) {
      setAnimState('exit');
      const t = setTimeout(() => { setMounted(false); setAnimState('enter'); }, 200);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    if (animState === 'visible' && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [animState]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && filteredItems[selectedIndex]) {
        e.preventDefault();
        onAddNode(filteredItems[selectedIndex].type);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, filteredItems, selectedIndex, onClose, onAddNode]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] transition-opacity duration-200"
      style={{ opacity: animState === 'visible' ? 1 : 0 }}
      onClick={onClose}
    >
      <div
        className="w-[420px] max-w-[calc(100vw-32px)] rounded-xl border shadow-2xl overflow-hidden transition-all duration-200"
        style={{
          borderColor: 'var(--border-300)',
          backgroundColor: 'var(--bg-100, #111114)',
          opacity: animState === 'visible' ? 1 : 0,
          transform: animState === 'visible' ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(-4px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: 'var(--border-300)' }}>
          <Search size={14} style={{ color: 'var(--text-500)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search nodes..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-100)' }}
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--border-300)', color: 'var(--text-500)' }}>
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-1">
          {!query && recentNodes.length > 0 && (
            <div className="px-3 py-1">
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>
                Recent
              </span>
            </div>
          )}
          {filteredItems.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs" style={{ color: 'var(--text-500)' }}>
              No nodes found
            </div>
          ) : (
            filteredItems.map((item, i) => {
              const Icon = ICON_MAP[item.icon] || Circle;
              const isSelected = i === selectedIndex;
              const isRecent = !query && recentNodes.includes(item.type) && i < recentNodes.length;
              const showCategoryHeader = !query && i === (isRecent ? recentNodes.length : 0) && recentNodes.length > 0;
              return (
                <div key={item.type}>
                  {showCategoryHeader && (
                    <div className="px-3 py-1 mt-1">
                      <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>
                        All Nodes
                      </span>
                    </div>
                  )}
                  <button
                    className="flex items-center gap-3 w-full px-3 py-2 text-left transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isSelected ? 'var(--bg-300)' : 'transparent',
                    }}
                    onClick={() => { onAddNode(item.type); onClose(); }}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${item.color}20` }}
                    >
                      <Icon size={14} style={{ color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium" style={{ color: 'var(--text-100)' }}>{item.label}</div>
                      <div className="text-[10px] truncate" style={{ color: 'var(--text-500)' }}>{item.description}</div>
                    </div>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `${item.color}15`, color: item.color }}
                    >
                      {item.category}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between px-3 py-1.5 border-t text-[10px]" style={{ borderColor: 'var(--border-300)', color: 'var(--text-500)' }}>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border" style={{ borderColor: 'var(--border-300)' }}>↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft size={10} /> select
            </span>
          </div>
          <span>{filteredItems.length} nodes</span>
        </div>
      </div>
    </div>
  );
}
