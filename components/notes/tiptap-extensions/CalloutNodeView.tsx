import React from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

const EMOJI_OPTIONS = ['💡', '⚠️', '🔥', '✅', '❌', '📝', '🎯', '🚀', '💬', '❤️'];

export const CalloutNodeView: React.FC<NodeViewProps> = ({ node, updateAttributes }) => {
  const [showPicker, setShowPicker] = React.useState(false);
  const emoji = node.attrs.emoji || '💡';

  return (
    <NodeViewWrapper
      data-type="callout"
      className="flex items-start gap-3 p-4 rounded-xl my-2"
      style={{
        background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.08), rgba(var(--neon-rgb), 0.03))',
        border: '1px solid rgba(var(--neon-rgb), 0.15)',
        borderLeft: '3px solid rgba(var(--neon-rgb), 0.4)',
      }}
    >
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="text-lg cursor-pointer hover:opacity-80 transition-opacity"
        >
          {emoji}
        </button>
        {showPicker && (
          <div
            className="absolute left-0 top-full z-50 p-1.5 rounded-xl border shadow-lg grid grid-cols-5 gap-1 animate-dropdown-in"
            style={{
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              backgroundColor: 'rgba(var(--bg-100-rgb, 255, 255, 255), 0.92)',
              borderColor: 'rgba(var(--neon-rgb), 0.15)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            }}
          >
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  updateAttributes({ emoji: e });
                  setShowPicker(false);
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer text-base transition-all duration-150"
                style={{
                  backgroundColor: e === emoji ? 'rgba(var(--neon-rgb), 0.15)' : 'transparent',
                  boxShadow: e === emoji ? '0 0 6px rgba(var(--neon-rgb), 0.15)' : 'none',
                }}
                onMouseEnter={(ev) => { ev.currentTarget.style.backgroundColor = 'var(--bg-200)'; }}
                onMouseLeave={(ev) => {
                  ev.currentTarget.style.backgroundColor = e === emoji ? 'rgba(var(--neon-rgb), 0.15)' : 'transparent';
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
      <NodeViewContent className="flex-1 min-h-[1.5em] outline-none" />
    </NodeViewWrapper>
  );
};
