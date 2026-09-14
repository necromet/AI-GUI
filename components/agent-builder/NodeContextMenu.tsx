import { useEffect, useRef, useLayoutEffect, useState } from 'react';
import { Copy, Unlink, Trash2, Settings } from 'lucide-react';
import { SEMANTIC_COLORS } from './shared/colors';

interface Props {
  x: number;
  y: number;
  nodeId: string;
  onEdit: () => void;
  onDuplicate: () => void;
  onDisconnect: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function NodeContextMenu({ x, y, nodeId, onEdit, onDuplicate, onDisconnect, onDelete, onClose }: Props) {
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

  const items = [
    { icon: Settings, label: 'Edit Settings', action: onEdit, color: 'var(--text-300)' },
    { icon: Copy, label: 'Duplicate', action: onDuplicate, color: 'var(--text-300)' },
    { icon: Unlink, label: 'Disconnect All', action: onDisconnect, color: SEMANTIC_COLORS.warning },
    { icon: Trash2, label: 'Delete Node', action: onDelete, color: SEMANTIC_COLORS.danger },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-lg border shadow-xl overflow-hidden ctx-menu-enter"
      style={{
        left: adjustedPos.x,
        top: adjustedPos.y,
        borderColor: 'var(--border-300)',
        backgroundColor: 'var(--bg-100)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.action(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer"
          style={{ color: item.color }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <item.icon size={13} />
          {item.label}
        </button>
      ))}
    </div>
  );
}
