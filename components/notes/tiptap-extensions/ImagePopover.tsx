import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Trash2, X } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import type { ImagePopoverState } from './ImagePopoverPlugin';

interface ImagePopoverProps {
  editor: Editor;
  state: ImagePopoverState;
  onClose: () => void;
}

export const ImagePopover: React.FC<ImagePopoverProps> = ({ editor, state, onClose }) => {
  const [editAlt, setEditAlt] = useState(state.alt);
  const [isEditing, setIsEditing] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditAlt(state.alt);
    setIsEditing(false);
  }, [state.src, state.alt]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!state.rect || !state.active) return null;

  const handleDelete = () => {
    if (state.pos !== null) {
      editor.chain().focus().deleteRange({ from: state.pos, to: state.pos + 1 }).run();
    }
    onClose();
  };

  const handleSaveAlt = () => {
    if (state.pos !== null) {
      const tr = editor.view.state.tr;
      tr.setNodeMarkup(state.pos, undefined, { ...editor.view.state.nodeAt(state.pos)?.attrs, alt: editAlt });
      editor.view.dispatch(tr);
    }
    setIsEditing(false);
  };

  const handleOpen = () => {
    window.open(state.src, '_blank', 'noopener,noreferrer');
  };

  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    top: state.rect.top - 8,
    left: state.rect.left + state.rect.width / 2,
    transform: 'translate(-50%, -100%)',
    zIndex: 1000,
  };

  return createPortal(
    <div ref={popoverRef} style={popoverStyle}>
      <div
        className="tiptap-popover flex items-center gap-1.5"
        data-placement="bottom"
        style={{ minWidth: isEditing ? '240px' : 'auto' }}
      >
        {isEditing ? (
          <>
            <input
              ref={inputRef}
              type="text"
              value={editAlt}
              onChange={(e) => setEditAlt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveAlt();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              className="flex-1 h-7 px-2 rounded-md text-xs outline-none"
              style={{
                backgroundColor: 'var(--bg-200)',
                color: 'var(--text-100)',
                border: '1px solid rgba(var(--neon-rgb), 0.2)',
              }}
              placeholder="Alt text..."
            />
            <button
              type="button"
              onClick={handleSaveAlt}
              className="h-7 px-2 rounded-md text-xs font-medium cursor-pointer transition-all duration-150"
              style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer transition-colors"
              style={{ color: 'var(--text-400)' }}
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <>
            <span className="text-xs truncate max-w-[160px] px-1" style={{ color: 'var(--text-300)' }}>
              {state.alt || 'No alt text'}
            </span>
            <div className="w-px h-4 mx-0.5" style={{ backgroundColor: 'var(--border-300)', opacity: 0.5 }} />
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              title="Edit alt text"
              className="h-6 px-1.5 rounded-md text-[10px] font-medium cursor-pointer transition-all duration-150"
              style={{ color: 'var(--text-400)', backgroundColor: 'var(--bg-200)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-100)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-400)'; }}
            >
              ALT
            </button>
            <button
              type="button"
              onClick={handleOpen}
              title="Open image"
              className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer transition-all duration-150"
              style={{ color: 'var(--text-400)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-100)'; e.currentTarget.style.backgroundColor = 'var(--bg-200)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-400)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <ExternalLink size={12} />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              title="Delete image"
              className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer transition-all duration-150"
              style={{ color: 'var(--text-400)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-400)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
