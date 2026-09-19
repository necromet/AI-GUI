import { useEffect, useRef, useLayoutEffect, useState, useCallback } from 'react';
import { NODE_CATEGORIES, NODE_DEFINITIONS } from './constants';
import type { WorkflowNodeType } from './types';
import { Circle } from 'lucide-react';
import { ICON_MAP } from './shared/icons';
import { SEMANTIC_COLORS } from './shared/colors';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  x: number;
  y: number;
  onAddNode: (type: WorkflowNodeType, x: number, y: number) => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onClose: () => void;
}

const ctxMenuTransition = { ease: [0.1, 0.1, 0.25, 1] as const, duration: 0.2 };

export default function CanvasContextMenu({ x, y, onAddNode, onSelectAll, onDeleteSelected, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setAdjustedPos({
      x: Math.min(x, vw - rect.width - 8),
      y: Math.min(y, vh - rect.height - 8),
    });
  }, [x, y]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -6, scale: 1, filter: "blur(1px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: 8, scale: 0.98, filter: "blur(1px)" }}
      transition={ctxMenuTransition}
      className="fixed z-50 min-w-[200px] rounded-lg border shadow-xl overflow-hidden"
      style={{
        left: adjustedPos.x,
        top: adjustedPos.y,
        borderColor: 'var(--border-300)',
        backgroundColor: 'var(--bg-100)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--border-300)' }}>
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>Add Node</span>
      </div>

      {NODE_CATEGORIES.map((cat) => (
        <div key={cat.id}>
          <div className="px-3 py-1" style={{ borderTop: '1px solid var(--border-300)' }}>
            <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>{cat.label}</span>
          </div>
          {cat.types.map((type) => {
            const def = NODE_DEFINITIONS[type];
            const Icon = ICON_MAP[def.icon] || Circle;
            return (
              <button
                key={type}
                onClick={() => onAddNode(type, x, y)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors cursor-pointer active:scale-[0.98]"
                style={{ color: 'var(--text-300)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-300)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Icon size={12} style={{ color: def.color }} />
                {def.label}
              </button>
            );
          })}
        </div>
      ))}

      <div className="border-t" style={{ borderColor: 'var(--border-300)' }}>
        <button
          onClick={() => { onSelectAll(); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors cursor-pointer active:scale-[0.98]"
          style={{ color: 'var(--text-300)' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-300)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Select All
        </button>
        <button
          onClick={() => { onDeleteSelected(); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors cursor-pointer active:scale-[0.98]"
          style={{ color: SEMANTIC_COLORS.danger }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-300)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Delete Selected
        </button>
      </div>
    </motion.div>
  );
}
