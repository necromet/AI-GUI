import React from 'react';
import { createPortal } from 'react-dom';
import { Bold, Italic, Code, Highlighter, Link } from 'lucide-react';
import type { Editor } from '@tiptap/react';

interface FloatingToolbarProps {
  editor: Editor;
  rect: DOMRect | null;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({ editor, rect }) => {
  if (!rect) return null;

  const toolbarStyle: React.CSSProperties = {
    position: 'fixed',
    top: rect.top - 44,
    left: rect.left + rect.width / 2,
    transform: 'translateX(-50%)',
    zIndex: 1000,
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return createPortal(
    <div style={toolbarStyle} className="tiptap-floating-toolbar">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        data-active={editor.isActive('bold')}
        title="Bold"
      >
        <Bold size={13} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        data-active={editor.isActive('italic')}
        title="Italic"
      >
        <Italic size={13} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        data-active={editor.isActive('code')}
        title="Code"
      >
        <Code size={13} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        data-active={editor.isActive('highlight')}
        title="Highlight"
      >
        <Highlighter size={13} />
      </button>
      <div className="w-px h-4 mx-0.5" style={{ backgroundColor: 'var(--border-300)', opacity: 0.4 }} />
      <button
        type="button"
        onClick={setLink}
        data-active={editor.isActive('link')}
        title="Link"
      >
        <Link size={13} />
      </button>
    </div>,
    document.body
  );
};
