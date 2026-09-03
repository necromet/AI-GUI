import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Typography from '@tiptap/extension-typography';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import type { Note } from '../../types';
import { NoteToolbar } from './NoteToolbar';
import {
  CalloutNode,
  ToggleNode,
  SlashCommand,
  createLinkPopoverPlugin,
  createImagePopoverPlugin,
  createFloatingToolbarPlugin,
  LinkPopover,
  ImagePopover,
  FloatingToolbar,
  EditorDropZone,
} from './tiptap-extensions';
import type { LinkPopoverState, ImagePopoverState, FloatingToolbarState } from './tiptap-extensions';
import { migrateBlocks, isLegacyBlocks, isTipTapDocument } from './migrateBlocks';

const lowlight = createLowlight(common);

interface NoteEditorProps {
  note: Note;
  onSave: (id: string, updates: Partial<Note>) => Promise<void>;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ note, onSave }) => {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSettingContentRef = useRef(false);
  const lastNoteIdRef = useRef<string | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [linkPopover, setLinkPopover] = useState<LinkPopoverState>({ active: false, href: '', rect: null });
  const [imagePopover, setImagePopover] = useState<ImagePopoverState>({ active: false, src: '', alt: '', rect: null, pos: null });
  const [floatingToolbar, setFloatingToolbar] = useState<FloatingToolbarState>({ active: false, rect: null });
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const getInitialContent = useCallback(() => {
    const blocks = note.blocks;
    if (!blocks || (Array.isArray(blocks) && blocks.length === 0)) {
      return { type: 'doc' as const, content: [{ type: 'paragraph' as const }] };
    }
    if (isLegacyBlocks(blocks)) {
      return migrateBlocks(blocks);
    }
    if (isTipTapDocument(blocks)) {
      return blocks;
    }
    return { type: 'doc' as const, content: [{ type: 'paragraph' as const }] };
  }, [note.blocks]);

  const debouncedSave = useCallback(
    (content: Record<string, unknown>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        onSave(note.id, { blocks: content as any });
      }, 500);
    },
    [note.id, onSave]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands...",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Image.configure({
        HTMLAttributes: { class: 'rounded-lg max-w-full' },
        allowBase64: true,
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Typography,
      CodeBlockLowlight.configure({ lowlight }),
      CalloutNode,
      ToggleNode,
      SlashCommand,
    ],
    content: getInitialContent(),
    editorProps: {
      attributes: {
        class: 'tiptap-editor outline-none min-h-[200px]',
      },
    },
    onCreate: ({ editor }) => {
      const linkPlugin = createLinkPopoverPlugin(setLinkPopover);
      const imagePlugin = createImagePopoverPlugin(setImagePopover);
      const floatingPlugin = createFloatingToolbarPlugin(setFloatingToolbar);

      const newState = editor.view.state.reconfigure({
        plugins: [...editor.view.state.plugins, linkPlugin, imagePlugin, floatingPlugin],
      });
      editor.view.updateState(newState);
    },
    onUpdate: ({ editor }) => {
      debouncedSave(editor.getJSON());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (note.id !== lastNoteIdRef.current) {
      lastNoteIdRef.current = note.id;
      isSettingContentRef.current = true;
      const content = getInitialContent();
      editor.commands.setContent(content);
      isSettingContentRef.current = false;
    }
  }, [note.id, editor, getInitialContent]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleImageUpload = useCallback((file: File) => {
    if (!editor) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      editor.chain().focus().setImage({ src: dataUrl }).run();
    };
    reader.readAsDataURL(file);
  }, [editor]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    if (!editor) return;

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          editor.chain().focus().setImage({ src: dataUrl }).run();
        };
        reader.readAsDataURL(file);
      } else {
        const url = URL.createObjectURL(file);
        editor.chain().focus().insertContent(`<a href="${url}" target="_blank">${file.name}</a> `).run();
      }
    }
  }, [editor]);

  const handleLinkPopoverClose = useCallback(() => {
    setLinkPopover({ active: false, href: '', rect: null });
  }, []);

  const handleImagePopoverClose = useCallback(() => {
    setImagePopover({ active: false, src: '', alt: '', rect: null, pos: null });
  }, []);

  return (
    <div
      ref={editorContainerRef}
      className="pl-2 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <NoteToolbar editor={editor} onImageUpload={handleImageUpload} />
      <div className="relative">
        <EditorContent editor={editor} />
        <EditorDropZone isDragOver={isDragOver} />
      </div>

      {editor && linkPopover.active && (
        <LinkPopover
          editor={editor}
          href={linkPopover.href}
          rect={linkPopover.rect}
          onClose={handleLinkPopoverClose}
        />
      )}

      {editor && imagePopover.active && (
        <ImagePopover
          editor={editor}
          state={imagePopover}
          onClose={handleImagePopoverClose}
        />
      )}

      {editor && floatingToolbar.active && !linkPopover.active && !imagePopover.active && (
        <FloatingToolbar
          editor={editor}
          rect={floatingToolbar.rect}
        />
      )}
    </div>
  );
};
