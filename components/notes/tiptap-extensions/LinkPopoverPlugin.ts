import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';

export interface LinkPopoverState {
  active: boolean;
  href: string;
  rect: DOMRect | null;
}

export const linkPopoverPluginKey = new PluginKey('linkPopover');

export function createLinkPopoverPlugin(onUpdate: (state: LinkPopoverState) => void) {
  return new Plugin({
    key: linkPopoverPluginKey,
    state: {
      init(): LinkPopoverState {
        return { active: false, href: '', rect: null };
      },
      apply(tr, value): LinkPopoverState {
        const meta = tr.getMeta(linkPopoverPluginKey);
        if (meta) return meta;
        return value;
      },
    },
    view(editorView) {
      const handleClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const link = target.closest('a');
        if (link && editorView.dom.contains(link)) {
          const rect = link.getBoundingClientRect();
          const href = link.getAttribute('href') || '';
          const state: LinkPopoverState = { active: true, href, rect };
          editorView.dispatch(
            editorView.state.tr.setMeta(linkPopoverPluginKey, state)
          );
          onUpdate(state);
          return;
        }
        const current = linkPopoverPluginKey.getState(editorView.state) as LinkPopoverState;
        if (current?.active) {
          const state: LinkPopoverState = { active: false, href: '', rect: null };
          editorView.dispatch(
            editorView.state.tr.setMeta(linkPopoverPluginKey, state)
          );
          onUpdate(state);
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          const current = linkPopoverPluginKey.getState(editorView.state) as LinkPopoverState;
          if (current?.active) {
            const state: LinkPopoverState = { active: false, href: '', rect: null };
            editorView.dispatch(
              editorView.state.tr.setMeta(linkPopoverPluginKey, state)
            );
            onUpdate(state);
          }
        }
      };

      editorView.dom.addEventListener('click', handleClick);
      document.addEventListener('keydown', handleKeyDown);

      return {
        destroy() {
          editorView.dom.removeEventListener('click', handleClick);
          document.removeEventListener('keydown', handleKeyDown);
        },
      };
    },
  });
}

export function closeLinkPopover(editor: Editor) {
  const state: LinkPopoverState = { active: false, href: '', rect: null };
  editor.view.dispatch(
    editor.view.state.tr.setMeta(linkPopoverPluginKey, state)
  );
}
