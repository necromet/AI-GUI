import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { SlashMenuView } from './SlashMenuView';
import type { Instance, Props } from 'tippy.js';

const suggestionConfig: Omit<SuggestionOptions, 'editor'> = {
  char: '/',
  allowSpaces: false,
  startOfLine: false,

  items: ({ query }: { query: string }) => {
    const items = [
      { title: 'Text', description: 'Plain text block', icon: 'Type', command: 'setParagraph' },
      { title: 'Heading 1', description: 'Large heading', icon: 'Heading1', command: 'toggleHeading', attrs: { level: 1 } },
      { title: 'Heading 2', description: 'Medium heading', icon: 'Heading2', command: 'toggleHeading', attrs: { level: 2 } },
      { title: 'Heading 3', description: 'Small heading', icon: 'Heading3', command: 'toggleHeading', attrs: { level: 3 } },
      { title: 'Bullet List', description: 'Unordered list', icon: 'List', command: 'toggleBulletList' },
      { title: 'Numbered List', description: 'Ordered list', icon: 'ListOrdered', command: 'toggleOrderedList' },
      { title: 'To-do', description: 'Checkbox item', icon: 'CheckSquare', command: 'toggleTaskList' },
      { title: 'Toggle', description: 'Collapsible section', icon: 'ChevronRight', command: 'setToggle' },
      { title: 'Code', description: 'Code block', icon: 'Code2', command: 'toggleCodeBlock' },
      { title: 'Callout', description: 'Highlighted note', icon: 'Lightbulb', command: 'setCallout' },
      { title: 'Quote', description: 'Blockquote', icon: 'Quote', command: 'toggleBlockquote' },
      { title: 'Divider', description: 'Horizontal line', icon: 'Minus', command: 'setHorizontalRule' },
      { title: 'Image', description: 'Upload or embed', icon: 'Image', command: 'setImage' },
    ];

    if (!query) return items;
    const lower = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        item.description.toLowerCase().includes(lower)
    );
  },

  render: () => {
    let component: ReactRenderer | null = null;
    let popup: Instance[] | null = null;

    return {
      onStart: (props: Props) => {
        component = new ReactRenderer(SlashMenuView, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = [
          {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          },
        ] as unknown as Instance[];
      },

      onUpdate(props: Props) {
        component?.updateProps(props);
        if (!props.clientRect) return;
      },

      onKeyDown(props: { event: KeyboardEvent }) {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide();
          return true;
        }
        return (component?.ref as any)?.onKeyDown?.(props) ?? false;
      },

      onExit() {
        popup?.[0]?.destroy();
        component?.destroy();
      },
    };
  },

  command: ({ editor, range, props }: { editor: any; range: any; props: any }) => {
    const { command, attrs } = props;

    editor.chain().focus().deleteRange(range).run();

    switch (command) {
      case 'setParagraph':
        editor.chain().focus().setParagraph().run();
        break;
      case 'toggleHeading':
        editor.chain().focus().toggleHeading(attrs).run();
        break;
      case 'toggleBulletList':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'toggleOrderedList':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'toggleTaskList':
        editor.chain().focus().toggleTaskList().run();
        break;
      case 'setToggle':
        editor.chain().focus().setToggle().run();
        break;
      case 'toggleCodeBlock':
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case 'setCallout':
        editor.chain().focus().setCallout().run();
        break;
      case 'toggleBlockquote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'setHorizontalRule':
        editor.chain().focus().setHorizontalRule().run();
        break;
      case 'setImage':
        const url = window.prompt('Enter image URL:');
        if (url) {
          editor.chain().focus().setImage({ src: url }).run();
        }
        break;
    }
  },
};

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: suggestionConfig,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
