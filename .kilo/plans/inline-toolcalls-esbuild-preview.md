# Plan: Inline Tool Calls + Server-Side TSX Compilation

## Problem 1: Tool Calls Rendered Below Text

**Current behavior:** The agent streams text content, then tool calls arrive as separate events and are appended to `msg.toolCalls[]`. The UI renders text first, then ALL tool call cards below it. The user sees a wall of text, then a wall of tool cards.

**Root cause:** The SSE stream works in iterations:
1. LLM streams content (text + embedded ```tool blocks)
2. Server parses tool calls AFTER content stream finishes
3. Server sends `tool_call` → `tool_progress` → `tool_result` events
4. Loop back for next LLM response

On the client, `content` is a string and `toolCalls` is a separate array. They're rendered in separate blocks.

**Fix:** Change the message model from `{ content, toolCalls[], toolResults[] }` to `{ blocks[] }` where each block is ordered by arrival time. This makes tool calls appear inline in the chat flow where they naturally occurred.

---

## Problem 2: TSX Preview Uses Babel Standalone (Fragile)

**Current behavior:** The preview generates an HTML page that loads Babel standalone, React UMD, Tailwind CDN, and motion from esm.sh. Babel transpiles TSX in-browser inside a `try/catch` wrapper. This causes:
- `type`/`interface` parse failures inside `try` blocks
- Dual React instances (UMD vs esm.sh)
- Slow CDN loading (Babel is 1.5MB)
- Incomplete TypeScript support

**User insight:** "Our codebase can also run .tsx files too right?" — Yes! The project already has Vite + esbuild (0.25.12, transitive dep). We can compile TSX on the server and serve it as a pre-compiled module.

**Fix:** Replace Babel standalone with server-side esbuild compilation. The server compiles all component files into a single bundled JS module, and the frontend loads it in an iframe with a simple HTML shell using import maps.

---

## Implementation

### A. Inline Tool Calls — Data Model Change

**File: `components/library/AgentSidebar.tsx`**

Change the message state from separate fields to an ordered `blocks` array:

```ts
// Old model
{ content: string, toolCalls: [], toolResults: [] }

// New model
{ blocks: Array<
    | { type: 'text'; content: string }
    | { type: 'tool_call'; name: string; arguments: any; result?: { output: string; error?: string }; collapsed?: boolean }
    | { type: 'ask_user'; question: string }
  >
}
```

In `handleAgentSend`, process SSE events sequentially:
1. `parsed.content` → append to the last text block (or create new one)
2. `parsed.tool_call` → push a new tool_call block
3. `parsed.tool_result` → find matching tool_call block, attach result
4. `parsed.ask_user` → push an ask_user block

This preserves the natural order: text → tool call → text → tool call → ...

**File: `components/AgentDock.tsx`**

Update `AgentDockMessage` interface to use `blocks` instead of separate fields.

Update rendering to iterate over `blocks` in order:
- Text block → markdown render
- Tool call block → collapsible card with status
- Ask user block → question prompt

Remove the separate `msg.toolCalls` and `msg.toolResults` rendering sections.

**File: `components/AgentDock.tsx` — `stripToolBlocks`**

Keep stripping ```tool blocks from text content (they're still embedded in the LLM response text). The tool call cards are rendered from the `blocks` array, not from the text.

### B. Server-Side TSX Compilation

**File: `server/routes/library.ts` — New endpoint**

Add `GET /api/library/components/:id/compiled`:

1. Fetch component files from DB
2. Create a virtual entry point that:
   - Imports internal files (resolves cross-file references)
   - Auto-detects the entry component and renders it
3. Bundle with esbuild:
   ```
   format: 'esm'
   bundle: true
   jsx: 'automatic'  (uses React 18 JSX transform)
   target: 'esnext'
   external: ['react', 'react-dom', 'react-dom/client', 'motion/react', 'framer-motion', '@phosphor-icons/react']
   ```
4. Return compiled JS with `Content-Type: application/javascript`

**File: `components/library/constants.ts` — Replace `buildTsxPreview`**

Replace the current Babel-based HTML generation with a simple iframe shell:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>* { margin: 0; padding: 0; box-sizing: border-box; }</style>
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18",
      "react/jsx-runtime": "https://esm.sh/react@18/jsx-runtime",
      "react-dom": "https://esm.sh/react-dom@18",
      "react-dom/client": "https://esm.sh/react-dom@18/client",
      "motion/react": "https://esm.sh/motion@11/react",
      "@phosphor-icons/react": "https://esm.sh/@phosphor-icons/react"
    }
  }
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    
    window.__renderErrors = [];
    window.addEventListener('error', e => window.__renderErrors.push(e.message));
    
    try {
      const mod = await import('/api/library/components/COMPONENT_ID/compiled');
      const Component = mod.default || Object.values(mod).find(v => typeof v === 'function');
      if (Component) {
        createRoot(document.getElementById('root')).render(React.createElement(Component));
      } else {
        window.__renderErrors.push('No valid component found in module exports');
      }
      window.__renderComplete = true;
    } catch(e) {
      window.__renderErrors.push('Import/render error: ' + e.message);
      window.__renderComplete = true;
    }
    
    window.__reportErrors = function() {
      try {
        window.parent.postMessage({
          type: 'preview-errors',
          errors: window.__renderErrors.slice(),
          complete: !!window.__renderComplete
        }, '*');
      } catch(e) {}
    };
    setInterval(() => window.__reportErrors(), 1000);
  </script>
</body>
</html>
```

This replaces:
- Babel standalone (1.5MB CDN load)
- React UMD scripts
- The complex try/catch + waitForDeps flow
- The `stripTsDeclarations` preprocessing (esbuild handles TypeScript natively)

**Keep:** The `postMessage` error bridge and the `agent-verify-component` handler in `ComponentEditor.tsx`. These still work with the new approach.

**Remove:** `stripTsDeclarations`, `stripExports` (for TSX files), the `buildTsxPreview` function's Babel/UMD/template code. The `resolveFileRecursive` function is no longer needed for preview (esbuild handles bundling).

### C. esbuild Integration

**File: `server/services/tsxCompiler.ts` (new)**

A dedicated module for TSX compilation:

```ts
import * as esbuild from 'esbuild';

export async function compileComponent(files: LibraryComponentFile[]): Promise<string> {
  // Create virtual filesystem for esbuild
  // Build entry point that imports all files and re-exports the main component
  // Bundle with esbuild
  // Return compiled JS string
}
```

Key esbuild config:
- `bundle: true` — resolve internal imports between component files
- `format: 'esm'` — output ES modules (works with import maps)
- `jsx: 'automatic'` — use React 18 JSX transform (no need for `import React`)
- `external: [...]` — don't bundle React, motion, etc. (resolved by import map)
- `write: false` — return in-memory, don't write to disk
- `platform: 'browser'` — target browser environment

---

## Files to Modify

| File | Changes |
|------|---------|
| `components/library/AgentSidebar.tsx` | Change message model to `blocks[]`, update SSE handler |
| `components/AgentDock.tsx` | Update `AgentDockMessage`, render blocks in order |
| `server/services/tsxCompiler.ts` | **New** — esbuild compilation service |
| `server/routes/library.ts` | Add `/compiled` endpoint, update prompt (remove Babel refs) |
| `components/library/constants.ts` | Replace `buildTsxPreview` with simple iframe + import map HTML |
| `components/library/ComponentEditor.tsx` | Minor: previewHtml now uses new format |

## What Gets Removed

- Babel standalone loading in preview
- React UMD scripts in preview
- `stripTsDeclarations()` preprocessing
- `resolveFileRecursive()` for preview bundling (esbuild does this)
- The complex `waitForDeps` / `deps-ready` flow
- `stripExports()` for TSX preview (esbuild handles exports)

## Verification

1. Open a TSX component in Library → Preview should render via esbuild module (check Network tab for `/compiled` request)
2. Send agent message → tool calls should appear inline between text segments
3. Check console → `[Library Agent]` logs should still appear
4. Verify component with agent → postMessage errors should still report correctly
5. `npm run build` → no compilation errors
