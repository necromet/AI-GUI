import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface FloatingToolbarState {
  active: boolean;
  rect: DOMRect | null;
}

export const floatingToolbarPluginKey = new PluginKey('floatingToolbar');

export function createFloatingToolbarPlugin(onUpdate: (state: FloatingToolbarState) => void) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  return new Plugin({
    key: floatingToolbarPluginKey,
    state: {
      init(): FloatingToolbarState {
        return { active: false, rect: null };
      },
      apply(tr, value): FloatingToolbarState {
        const meta = tr.getMeta(floatingToolbarPluginKey);
        if (meta) return meta;
        return value;
      },
    },
    view(editorView) {
      const handleSelectionUpdate = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const { selection } = editorView.state;
          const { empty } = selection;

          if (empty) {
            const current = floatingToolbarPluginKey.getState(editorView.state) as FloatingToolbarState;
            if (current?.active) {
              const state: FloatingToolbarState = { active: false, rect: null };
              editorView.dispatch(
                editorView.state.tr.setMeta(floatingToolbarPluginKey, state)
              );
              onUpdate(state);
            }
            return;
          }

          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) return;

          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          if (rect.width === 0 && rect.height === 0) return;

          const state: FloatingToolbarState = { active: true, rect };
          editorView.dispatch(
            editorView.state.tr.setMeta(floatingToolbarPluginKey, state)
          );
          onUpdate(state);
        }, 150);
      };

      const handleMouseDown = (event: MouseEvent) => {
        setTimeout(handleSelectionUpdate, 10);
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.shiftKey || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          setTimeout(handleSelectionUpdate, 50);
        }
      };

      const handleBlur = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        setTimeout(() => {
          const current = floatingToolbarPluginKey.getState(editorView.state) as FloatingToolbarState;
          if (current?.active) {
            const state: FloatingToolbarState = { active: false, rect: null };
            editorView.dispatch(
              editorView.state.tr.setMeta(floatingToolbarPluginKey, state)
            );
            onUpdate(state);
          }
        }, 200);
      };

      editorView.dom.addEventListener('mouseup', handleMouseDown);
      editorView.dom.addEventListener('keyup', handleKeyDown);
      editorView.dom.addEventListener('blur', handleBlur);

      return {
        destroy() {
          if (debounceTimer) clearTimeout(debounceTimer);
          editorView.dom.removeEventListener('mouseup', handleMouseDown);
          editorView.dom.removeEventListener('keyup', handleKeyDown);
          editorView.dom.removeEventListener('blur', handleBlur);
        },
      };
    },
  });
}
