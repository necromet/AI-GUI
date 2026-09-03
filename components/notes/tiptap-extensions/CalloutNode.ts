import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CalloutNodeView } from './CalloutNodeView';

export interface CalloutOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (emoji?: string) => ReturnType;
    };
  }
}

export const CalloutNode = Node.create<CalloutOptions>({
  name: 'callout',

  group: 'block',

  content: 'block+',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      emoji: {
        default: '💡',
        parseHTML: (element) => element.getAttribute('data-emoji') || '💡',
        renderHTML: (attributes) => ({
          'data-emoji': attributes.emoji,
        }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="callout"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': 'callout' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },

  addCommands() {
    return {
      setCallout:
        (emoji?: string) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, { emoji: emoji || '💡' });
        },
    };
  },
});
