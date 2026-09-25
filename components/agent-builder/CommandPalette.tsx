import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { NODE_DEFINITIONS, NODE_CATEGORIES } from './constants';
import { ICON_MAP } from './shared/icons';
import { Circle, Search, CornerDownLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WorkflowNodeType } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddNode: (type: WorkflowNodeType) => void;
  recentNodes?: WorkflowNodeType[];
}

const modalSpring = { type: "spring" as const, damping: 25, stiffness: 300 };

export default function CommandPalette({ isOpen, onClose, onAddNode, recentNodes = [] }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
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
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="cmd-palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]"
          onClick={onClose}
        >
          <motion.div
            key="cmd-palette-card"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={modalSpring}
            className="w-[420px] max-w-[calc(100vw-32px)] rounded-xl border shadow-2xl overflow-hidden"
            style={{
              borderColor: 'rgba(var(--neon-rgb), 0.3)',
              backgroundColor: 'var(--bg-100, #1a1a1a)',
              boxShadow: '0px 32px 40px 6px rgba(0,0,0,0.08), 0px 12px 32px 0px rgba(0,0,0,0.06), 0px 4px 16px 0px rgba(0,0,0,0.04)',
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
                        className="flex items-center gap-3 w-full px-3 py-2 text-left transition-colors cursor-pointer active:scale-[0.99]"
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
