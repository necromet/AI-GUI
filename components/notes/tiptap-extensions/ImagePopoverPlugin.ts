import { Plugin, PluginKey } from '@tiptap/pm/state';
import { NodeSelection } from '@tiptap/pm/state';

export interface ImagePopoverState {
  active: boolean;
  src: string;
  alt: string;
  rect: DOMRect | null;
  pos: number | null;
}

export const imagePopoverPluginKey = new PluginKey('imagePopover');

export function createImagePopoverPlugin(onUpdate: (state: ImagePopoverState) => void) {
  return new Plugin({
    key: imagePopoverPluginKey,
    state: {
      init(): ImagePopoverState {
        return { active: false, src: '', alt: '', rect: null, pos: null };
      },
      apply(tr, value): ImagePopoverState {
        const meta = tr.getMeta(imagePopoverPluginKey);
        if (meta) return meta;

        const selection = tr.selection;
        if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
          const node = selection.node;
          try {
            const dom = tr.doc && selection.from !== undefined
              ? document.querySelector(`.tiptap-editor [data-type="image"]`) ||
                document.querySelector(`.tiptap-editor img[src="${node.attrs.src}"]`)
              : null;
            const rect = dom ? dom.getBoundingClientRect() : null;
            return {
              active: true,
              src: node.attrs.src || '',
              alt: node.attrs.alt || '',
              rect,
              pos: selection.from,
            };
          } catch {
            return { active: true, src: node.attrs.src || '', alt: node.attrs.alt || '', rect: null, pos: selection.from };
          }
        }

        if (tr.selectionSet || tr.docChanged) {
          if (value.active) {
            return { active: false, src: '', alt: '', rect: null, pos: null };
          }
        }
        return value;
      },
    },
    view(editorView) {
      const updateFromSelection = () => {
        const { selection } = editorView.state;
        if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
          const node = selection.node;
          const dom = editorView.nodeDOM(selection.from) as HTMLElement | null;
          const rect = dom ? dom.getBoundingClientRect() : null;
          const state: ImagePopoverState = {
            active: true,
            src: node.attrs.src || '',
            alt: node.attrs.alt || '',
            rect,
            pos: selection.from,
          };
          onUpdate(state);
        }
      };

      editorView.dom.addEventListener('click', (e) => {
        setTimeout(updateFromSelection, 10);
      });

      return {
        update(view) {
          const { selection } = view.state;
          if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
            const node = selection.node;
            const dom = view.nodeDOM(selection.from) as HTMLElement | null;
            const rect = dom ? dom.getBoundingClientRect() : null;
            onUpdate({
              active: true,
              src: node.attrs.src || '',
              alt: node.attrs.alt || '',
              rect,
              pos: selection.from,
            });
          }
        },
      };
    },
  });
}
