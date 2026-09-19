import { useState } from 'react';
import { NODE_DEFINITIONS } from './constants';
import type { WorkflowNodeType } from './types';
import { Plus, Circle } from 'lucide-react';
import { ICON_MAP } from './shared/icons';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  x: number;
  y: number;
  sourceNodeId: string;
  targetNodeId: string;
  onInsertNode: (type: WorkflowNodeType, sourceId: string, targetId: string) => void;
  onClose: () => void;
}

const ctxMenuTransition = { ease: [0.1, 0.1, 0.25, 1] as const, duration: 0.2 };

export default function EdgeAddButton({ x, y, sourceNodeId, targetNodeId, onInsertNode, onClose }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  if (!showPicker) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        className="absolute z-10 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
        style={{
          left: x - 12,
          top: y - 12,
          backgroundColor: 'var(--neon-color)',
          color: '#000',
          boxShadow: '0 0 8px rgba(var(--neon-rgb), 0.4)',
        }}
        onClick={() => setShowPicker(true)}
      >
        <Plus size={12} />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 1, filter: "blur(1px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: 8, scale: 0.98, filter: "blur(1px)" }}
      transition={ctxMenuTransition}
      className="absolute z-20 min-w-[160px] rounded-lg border shadow-xl overflow-hidden"
      style={{
        left: x,
        top: y,
        borderColor: 'var(--border-300)',
        backgroundColor: 'var(--bg-100)',
      }}
    >
      <div className="px-2 py-1 border-b" style={{ borderColor: 'var(--border-300)' }}>
        <span className="text-[10px] font-medium" style={{ color: 'var(--text-500)' }}>Insert Node</span>
      </div>
      {(['agent', 'mcp', 'guardrails', 'transform', 'if-else', 'while', 'user-approval'] as WorkflowNodeType[]).map((type) => {
        const def = NODE_DEFINITIONS[type];
        const Icon = ICON_MAP[def.icon] || Circle;
        return (
          <button
            key={type}
            onClick={() => { onInsertNode(type, sourceNodeId, targetNodeId); onClose(); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] transition-colors cursor-pointer active:scale-[0.98]"
            style={{ color: 'var(--text-300)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-300)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Icon size={11} style={{ color: def.color }} />
            {def.label}
          </button>
        );
      })}
    </motion.div>
  );
}
