import React, { useRef } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Strikethrough, Code, Highlighter, Link,
  Heading1, Heading2, Heading3, List, ListOrdered,
  CheckSquare, Code2, Quote, Minus, Image as ImageIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Undo2, Redo2, ChevronDown, RemoveFormatting,
} from 'lucide-react';

interface NoteToolbarProps {
  editor: Editor | null;
  onImageUpload?: (file: File) => void;
}

const ToolbarButton: React.FC<{
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, isActive, disabled, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer transition-all duration-150"
    style={{
      backgroundColor: isActive ? 'rgba(var(--neon-rgb), 0.15)' : 'transparent',
      color: isActive ? 'var(--neon-color)' : 'var(--text-400)',
      opacity: disabled ? 0.35 : 1,
      boxShadow: isActive ? '0 0 8px rgba(var(--neon-rgb), 0.12)' : 'none',
    }}
    onMouseEnter={(e) => {
      if (!isActive && !disabled) {
        e.currentTarget.style.backgroundColor = 'var(--bg-200)';
        e.currentTarget.style.color = 'var(--text-100)';
      }
    }}
    onMouseLeave={(e) => {
      if (!isActive) {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = isActive ? 'var(--neon-color)' : 'var(--text-400)';
      }
    }}
  >
    {children}
  </button>
);

const Divider: React.FC = () => (
  <div className="w-px h-5 mx-0.5" style={{ backgroundColor: 'var(--border-300)', opacity: 0.6 }} />
);

export const NoteToolbar: React.FC<NoteToolbarProps> = ({ editor, onImageUpload }) => {
  const [showHeadingMenu, setShowHeadingMenu] = React.useState(false);
  const headingRef = React.useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!showHeadingMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (headingRef.current && !headingRef.current.contains(e.target as Node)) {
        setShowHeadingMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHeadingMenu]);

  if (!editor) return null;

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

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageUpload) {
      onImageUpload(file);
    }
    e.target.value = '';
  };

  const currentHeading = editor.isActive('heading', { level: 1 })
    ? 'H1'
    : editor.isActive('heading', { level: 2 })
    ? 'H2'
    : editor.isActive('heading', { level: 3 })
    ? 'H3'
    : 'P';

  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1.5 rounded-xl border mb-4 flex-wrap"
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        backgroundColor: 'rgba(var(--bg-100-rgb, 255, 255, 255), 0.7)',
        borderColor: 'rgba(var(--neon-rgb), 0.1)',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(var(--neon-rgb), 0.04)',
      }}
    >
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />

      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 size={14} />
      </ToolbarButton>

      <Divider />

      {/* Heading selector */}
      <div ref={headingRef} className="relative">
        <button
          type="button"
          onClick={() => setShowHeadingMenu(!showHeadingMenu)}
          className="flex items-center gap-1 px-2 h-7 rounded-md text-xs font-medium cursor-pointer transition-all duration-150"
          style={{
            color: currentHeading !== 'P' ? 'var(--neon-color)' : 'var(--text-300)',
            backgroundColor: currentHeading !== 'P' ? 'rgba(var(--neon-rgb), 0.08)' : 'transparent',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-200)'; }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = currentHeading !== 'P' ? 'rgba(var(--neon-rgb), 0.08)' : 'transparent';
          }}
        >
          {currentHeading}
          <ChevronDown size={12} />
        </button>
        {showHeadingMenu && (
          <div
            className="absolute left-0 top-full z-50 mt-1 w-44 rounded-xl border py-1 animate-dropdown-in"
            style={{
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              backgroundColor: 'rgba(var(--bg-100-rgb, 255, 255, 255), 0.92)',
              borderColor: 'rgba(var(--neon-rgb), 0.15)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            }}
          >
            {[
              { label: 'Paragraph', level: 0, icon: null },
              { label: 'Heading 1', level: 1, icon: <Heading1 size={14} /> },
              { label: 'Heading 2', level: 2, icon: <Heading2 size={14} /> },
              { label: 'Heading 3', level: 3, icon: <Heading3 size={14} /> },
            ].map((item) => {
              const isActive = item.level === 0
                ? !editor.isActive('heading')
                : editor.isActive('heading', { level: item.level });
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    if (item.level === 0) {
                      editor.chain().focus().setParagraph().run();
                    } else {
                      editor.chain().focus().toggleHeading({ level: item.level as 1 | 2 | 3 }).run();
                    }
                    setShowHeadingMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-all duration-150 cursor-pointer"
                  style={{
                    color: isActive ? 'var(--neon-color)' : 'var(--text-300)',
                    backgroundColor: isActive ? 'rgba(var(--neon-rgb), 0.08)' : 'transparent',
                    borderLeft: isActive ? '2px solid var(--neon-color)' : '2px solid transparent',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-200)'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {item.icon}
                  <span className={item.level === 1 ? 'text-lg font-bold' : item.level === 2 ? 'text-base font-semibold' : item.level === 3 ? 'text-sm font-medium' : ''}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Divider />

      {/* Inline formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Strikethrough (Ctrl+Shift+X)"
      >
        <Strikethrough size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title="Inline Code (Ctrl+E)"
      >
        <Code size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive('highlight')}
        title="Highlight"
      >
        <Highlighter size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={setLink}
        isActive={editor.isActive('link')}
        title="Link (Ctrl+K)"
      >
        <Link size={14} />
      </ToolbarButton>

      <Divider />

      {/* Block formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <ListOrdered size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive('taskList')}
        title="Task List"
      >
        <CheckSquare size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title="Code Block"
      >
        <Code2 size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Quote"
      >
        <Quote size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Divider"
      >
        <Minus size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => imageInputRef.current?.click()}
        title="Insert Image"
      >
        <ImageIcon size={14} />
      </ToolbarButton>

      <Divider />

      {/* Text alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title="Align Left"
      >
        <AlignLeft size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title="Align Center"
      >
        <AlignCenter size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title="Align Right"
      >
        <AlignRight size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        isActive={editor.isActive({ textAlign: 'justify' })}
        title="Justify"
      >
        <AlignJustify size={14} />
      </ToolbarButton>

      <Divider />

      {/* Clear formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        title="Clear Formatting"
      >
        <RemoveFormatting size={14} />
      </ToolbarButton>
    </div>
  );
};
