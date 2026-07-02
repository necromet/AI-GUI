# Plan: Source Editor UX + Incremental Agent Edits

## Problem 1: Source editor needs Cancel/Undo/Redo instead of Save

### Current behavior
- "Save Changes" button appears when `editedHtml !== generatedHtml`
- `onBlur` auto-saves edits to `generatedHtml` (lossy — can't revert)
- No undo/redo UI buttons (Ace has Ctrl+Z/Ctrl+Shift+Z but no visible buttons)

### Changes

**`components/ui/code-editor-sheet.tsx` — expose editor instance**
- Add `onLoad?: (editor: any) => void` to `CodeEditorProps`
- Pass it as AceEditor's `onLoad` prop so callers can access `editor.undo()` / `editor.redo()`

**`components/StitchEditor.tsx` — rework source toolbar**
- Add state: `sourceOriginalHtml` to snapshot HTML when entering source mode
- Add ref: `editorRef` to hold Ace editor instance (from `CodeEditor` `onLoad`)
- Remove `onBlur={handleSaveEdits}` from `<CodeEditor>` — no auto-save
- Remove `handleSaveEdits` callback (no longer needed)
- Replace "Save Changes" button with a toolbar containing:
  - **Undo** button (calls `editorRef.current.undo()`) — icon: `Undo2` from lucide
  - **Redo** button (calls `editorRef.current.redo()`) — icon: `Redo2` from lucide
  - **Cancel** button (reverts `editedHtml` back to `sourceOriginalHtml`) — icon: `X` from lucide
- Show toolbar always when in source mode (not just when dirty), with undo/redo disabled when stack is empty
- Remove `editedHtml !== generatedHtml` condition for showing toolbar
- `useEffect`: when switching to source mode, snapshot `generatedHtml` into `sourceOriginalHtml`
- Cancel: set `editedHtml = sourceOriginalHtml`, which also reverts the Ace editor since `value` prop updates
- Since there's no auto-save, edits only persist when the user makes further changes in preview mode or generates new HTML

## Problem 2: Agent rewrites entire HTML instead of editing surgically

### Root cause
`buildStitchSystemPrompt` in `server/services/agentService.ts` tells the model:
> "Output the COMPLETE modified HTML file (not just the changed parts)."

This encourages full rewrites. The `edit_html` tool exists and works (uses cheerio CSS selectors), but the prompt doesn't steer the model toward it.

### Changes

**`server/services/agentService.ts` — rewrite `buildStitchSystemPrompt`**
When `hasExistingHtml` is true, change the prompt to:
1. **Strongly prefer `edit_html`** for modifications — "ALWAYS use the edit_html tool for modifications to existing HTML. Do NOT output the full HTML yourself."
2. Remove "Output the COMPLETE modified HTML file" instruction
3. Add guidance on writing good CSS selectors (use id, class, element hierarchy)
4. Keep `generate_html` as fallback only for full redesigns
5. Tell the model to NOT output raw HTML when using tools — just the tool call JSON

This means the model will output a `tool` JSON block → server executes `edit_html` via cheerio → returns modified HTML → streamed back to client as `tool_result`.

## Files to modify

| File | Change |
|------|--------|
| `components/ui/code-editor-sheet.tsx` | Add `onLoad` prop to `CodeEditor` |
| `components/StitchEditor.tsx` | Replace Save with Cancel/Undo/Redo toolbar, remove auto-save on blur |
| `server/services/agentService.ts` | Rewrite `buildStitchSystemPrompt` to prefer `edit_html` |

## Verification
1. Switch to source mode → edit code → verify Undo/Redo buttons work
2. Click Cancel → verify HTML reverts to what it was when source mode was entered
3. Send a modification request in the Stitch chat (e.g., "change the heading color to blue") → verify the agent uses `edit_html` tool instead of rewriting all HTML
4. Verify the "Applying edits..." status appears in the sidebar during `edit_html` tool calls
