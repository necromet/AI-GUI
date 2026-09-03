import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Pencil, Unlink, X } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { closeLinkPopover } from './LinkPopoverPlugin';

interface LinkPopoverProps {
  editor: Editor;
  href: string;
  rect: DOMRect | null;
  onClose: () => void;
}

export const LinkPopover: React.FC<LinkPopoverProps> = ({ editor, href, rect, onClose }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editUrl, setEditUrl] = useState(href);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditUrl(href);
    setIsEditing(false);
  }, [href]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        closeLinkPopover(editor);
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editor, onClose]);

  if (!rect) return null;

  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    top: rect.bottom + 8,
    left: rect.left + rect.width / 2,
    transform: 'translateX(-50%)',
    zIndex: 1000,
  };

  const handleSave = () => {
    if (editUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: editUrl }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    closeLinkPopover(editor);
    onClose();
  };

  const handleUnlink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    closeLinkPopover(editor);
    onClose();
  };

  const handleOpen = () => {
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return createPortal(
    <div ref={popoverRef} style={popoverStyle}>
      <div
        className="tiptap-popover flex items-center gap-1.5"
        style={{ minWidth: isEditing ? '280px' : 'auto' }}
      >
        {isEditing ? (
          <>
            <input
              ref={inputRef}
              type="url"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') { setIsEditing(false); setEditUrl(href); }
              }}
              className="flex-1 h-7 px-2 rounded-md text-xs outline-none"
              style={{
                backgroundColor: 'var(--bg-200)',
                color: 'var(--text-100)',
                border: '1px solid rgba(var(--neon-rgb), 0.2)',
              }}
              placeholder="https://..."
            />
            <button
              type="button"
              onClick={handleSave}
              className="h-7 px-2 rounded-md text-xs font-medium cursor-pointer transition-all duration-150"
              style={{
                backgroundColor: 'var(--neon-color)',
                color: '#000',
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setIsEditing(false); setEditUrl(href); }}
              className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer transition-colors"
              style={{ color: 'var(--text-400)' }}
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs truncate max-w-[200px] px-1.5 py-1 rounded-md transition-colors"
              style={{ color: 'var(--neon-color)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
              onClick={(e) => e.stopPropagation()}
            >
              {href}
            </a>
            <div className="w-px h-4 mx-0.5" style={{ backgroundColor: 'var(--border-300)', opacity: 0.5 }} />
            <button
              type="button"
              onClick={handleOpen}
              title="Open link"
              className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer transition-all duration-150"
              style={{ color: 'var(--text-400)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-100)'; e.currentTarget.style.backgroundColor = 'var(--bg-200)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-400)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <ExternalLink size={12} />
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              title="Edit link"
              className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer transition-all duration-150"
              style={{ color: 'var(--text-400)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-100)'; e.currentTarget.style.backgroundColor = 'var(--bg-200)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-400)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              onClick={handleUnlink}
              title="Remove link"
              className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer transition-all duration-150"
              style={{ color: 'var(--text-400)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-400)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Unlink size={12} />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
