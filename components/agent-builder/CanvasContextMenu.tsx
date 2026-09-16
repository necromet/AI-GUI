import { useEffect, useRef, useLayoutEffect, useState, useCallback } from 'react';
import { NODE_CATEGORIES, NODE_DEFINITIONS } from './constants';
import type { WorkflowNodeType } from './types';
import { Circle } from 'lucide-react';
import { ICON_MAP } from './shared/icons';
import { SEMANTIC_COLORS } from './shared/colors';

interface Props {
  x: number;
  y: number;
  onAddNode: (type: WorkflowNodeType, x: number, y: number) => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onClose: () => void;
}

export default function CanvasContextMenu({ x, y, onAddNode, onSelectAll, onDeleteSelected, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });
  const [exiting, setExiting] = useState(false);

  const handleClose = useCallback(() => {
    setExiting(true);
    setTimeout(() => onClose(), 120);
  }, [onClose]);

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
      if (ref.current && !ref.current.contains(e.target as Node)) handleClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [handleClose]);

  return (
    <div
      ref={ref}
      className={`fixed z-50 min-w-[200px] rounded-lg border shadow-xl overflow-hidden ${exiting ? 'ctx-menu-exit' : 'ctx-menu-enter'}`}
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
          <div className="px-3 py-1" style={{ borderTop: '1px solid var(--border-200)' }}>
            <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>{cat.label}</span>
          </div>
          {cat.types.map((type) => {
            const def = NODE_DEFINITIONS[type];
            const Icon = ICON_MAP[def.icon] || Circle;
            return (
              <button
                key={type}
                onClick={() => onAddNode(type, x, y)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors cursor-pointer"
                style={{ color: 'var(--text-300)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
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
          onClick={() => { onSelectAll(); handleClose(); }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors cursor-pointer"
          style={{ color: 'var(--text-300)' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Select All
        </button>
        <button
          onClick={() => { onDeleteSelected(); handleClose(); }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors cursor-pointer"
          style={{ color: SEMANTIC_COLORS.danger }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Delete Selected
        </button>
      </div>
    </div>
  );
}
