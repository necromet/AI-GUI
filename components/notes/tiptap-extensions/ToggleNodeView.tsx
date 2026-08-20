import React from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { ChevronRight } from 'lucide-react';
import type { NodeViewProps } from '@tiptap/react';

export const ToggleNodeView: React.FC<NodeViewProps> = ({ node, updateAttributes }) => {
  const isOpen = node.attrs.open !== false;

  return (
    <NodeViewWrapper data-type="toggle" className="my-2">
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={() => updateAttributes({ open: !isOpen })}
          className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-200"
          style={{
            color: 'var(--text-400)',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--neon-color)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-400)'; }}
        >
          <ChevronRight size={14} />
        </button>
        <NodeViewContent className="flex-1 min-h-[1.5em] font-medium outline-none" />
      </div>
      {isOpen && (
        <div
          className="ml-6 mt-1 pl-3 border-l overflow-hidden"
          style={{
            borderColor: 'rgba(var(--neon-rgb), 0.2)',
            animation: 'expand-in 0.2s ease-out forwards',
          }}
        >
          <NodeViewContent className="min-h-[1.5em] text-sm outline-none" />
        </div>
      )}
    </NodeViewWrapper>
  );
};
