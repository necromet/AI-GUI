# Auto-load + Change Highlighting for Library Agent Edits

## Problem
When the library agent writes/updates files via `write_component_file` or `update_component`, the ComponentEditor doesn't reflect the changes. The `component_updated` SSE event fires but isn't connected to the editor.

## Current Data Flow (broken)
```
Agent tool → server SSE → AgentSidebar.onComponentUpdated() → (not connected)
                         → AgentSidebar.onComponentsReload() → window event → LibraryPanel.loadComponents()
                                                                              ↑ refreshes list, NOT the editor
```

## Target Data Flow
```
Agent tool → server SSE → AgentSidebar dispatches CustomEvent('agent-file-changed', { componentId, files })
                         → ComponentEditor listens → updates editFiles → diffs changed lines → highlights
```

## Changes

### 1. AgentSidebar — dispatch custom event on file changes
**File:** `components/library/AgentSidebar.tsx`

In the `parsed.component_updated` handler (line ~321), dispatch a custom event:
```ts
if (parsed.component_updated) {
  const updated = parsed.component_updated;
  onComponentUpdated?.(updated);
  onComponentsReload?.();
  // NEW: notify ComponentEditor directly
  window.dispatchEvent(new CustomEvent('agent-file-changed', {
    detail: { componentId: updated.id, files: updated.files }
  }));
}
```

Also dispatch on `parsed.component_created` for the case where the agent creates files in the current component.

### 2. ComponentEditor — listen for agent changes + auto-load
**File:** `components/library/ComponentEditor.tsx`

Add a new state to track which files were recently changed by the agent:
```ts
const [agentChangedFileIds, setAgentChangedFileIds] = useState<Set<string>>(new Set());
```

Add an effect that listens for `agent-file-changed`:
```ts
useEffect(() => {
  const handler = (e: CustomEvent) => {
    if (e.detail.componentId !== selectedComponent?.id) return;
    const newFiles = e.detail.files as LibraryComponentFile[];
    if (!newFiles) return;

    // Diff: find which files changed content
    const changedIds = new Set<string>();
    for (const newFile of newFiles) {
      const oldFile = editFiles.find(f => f.id === newFile.id);
      if (!oldFile || oldFile.content !== newFile.content) {
        changedIds.add(newFile.id);
      }
    }

    // Update files
    setEditFiles(newFiles);
    setOpenFileIds(prev => {
      const newIds = newFiles.map(f => f.id);
      const merged = [...new Set([...prev, ...newIds])];
      return merged;
    });
    setIsDirty(false);

    // If new files were added, switch to the first new one
    const addedFiles = newFiles.filter(f => !editFiles.find(ef => ef.id === f.id));
    if (addedFiles.length > 0) {
      setActiveFileId(addedFiles[0].id);
    }

    // Mark changed files for highlighting
    setAgentChangedFileIds(changedIds);

    // Clear highlight after 3s
    setTimeout(() => setAgentChangedFileIds(new Set()), 3000);
  };

  window.addEventListener('agent-file-changed', handler as EventListener);
  return () => window.removeEventListener('agent-file-changed', handler as EventListener);
}, [selectedComponent?.id, editFiles]);
```

### 3. File tab — visual flash on agent-changed files
**File:** `components/library/ComponentEditor.tsx`

In the file tab rendering (line ~200), add a glow animation when the file was changed by the agent:
```tsx
style={{
  ...existing styles,
  // Add neon glow for agent-changed files
  boxShadow: agentChangedFileIds.has(file.id)
    ? '0 0 12px rgba(var(--neon-rgb), 0.4), inset 0 0 8px rgba(var(--neon-rgb), 0.1)'
    : 'none',
  transition: 'box-shadow 0.3s ease',
}}
```

### 4. Monaco editor — highlight changed lines
**File:** `components/library/ComponentEditor.tsx`

After the editor loads (in the `onLoad` callback), store the Monaco instance. When `agentChangedFileIds` changes and includes the active file, use `deltaDecorations` to highlight all lines briefly:

```ts
// In the onLoad callback, also store monaco ref
onLoad={(editor) => { editorRef.current = editor; }}
```

Add an effect that decorates changed lines:
```ts
useEffect(() => {
  if (!editorRef.current || !activeFileId || !agentChangedFileIds.has(activeFileId)) return;
  const editor = editorRef.current;
  const model = editor.getModel?.();
  if (!model) return;

  const lineCount = model.getLineCount?.() || 0;
  const decorations = Array.from({ length: lineCount }, (_, i) => ({
    range: new (window as any).monaco.Range(i + 1, 1, i + 1, 1),
    options: {
      isWholeLine: true,
      className: 'agent-changed-line',
      overviewRuler: { color: 'rgba(var(--neon-rgb), 0.5)', position: 1 },
    },
  }));

  const decIds = editor.deltaDecorations?.([], decorations) || [];

  // Clear after 3s
  const timer = setTimeout(() => {
    editor.deltaDecorations?.(decIds, []);
  }, 3000);

  return () => clearTimeout(timer);
}, [agentChangedFileIds, activeFileId]);
```

Add CSS for the line highlight in `globals.css`:
```css
.agent-changed-line {
  background-color: rgba(var(--neon-rgb), 0.08) !important;
  transition: background-color 2s ease-out;
}
```

### 5. globals.css — add the agent-changed-line class
**File:** `src/globals.css`

Add the Monaco decoration class.

## Files Modified
1. `components/library/AgentSidebar.tsx` — dispatch `agent-file-changed` event
2. `components/library/ComponentEditor.tsx` — listen for event, auto-load files, highlight tabs + lines
3. `src/globals.css` — add `.agent-changed-line` CSS class
