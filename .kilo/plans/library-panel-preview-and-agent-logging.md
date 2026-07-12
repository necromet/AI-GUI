# Plan: Library Panel — Fix TSX Preview Errors & Add Agent Console Logging

## Problems Identified

### Bug 1: Dual React Instance Causes TSX Preview Failures

**File:** `components/library/constants.ts:302-318`

The TSX preview HTML has **two separate React instances**:

1. **UMD global** — `<script src="https://unpkg.com/react@18/umd/react.production.min.js">` sets `window.React`
2. **ESM via import map** — `<script type="importmap">` maps `react` → `https://esm.sh/react@18`

The Babel-transpiled component code uses `window.React` (UMD). But `motion/react` loaded via `import('https://esm.sh/motion@11/react?external=react,react-dom')` resolves `react` through the import map to a **different** React instance from esm.sh.

**Result:** Any component using `motion` (framer-motion) triggers React Error #310 ("Invalid Hook Call") because hooks run across two different React instances.

### Bug 2: Verify Timeout Too Short (1500ms)

**File:** `components/library/ComponentEditor.tsx:176`

The `agent-verify-component` handler waits only 1500ms before reading `iframe.contentWindow.__renderErrors`. But:
- Babel standalone transpilation takes 2-5s
- esm.sh package fetching (motion, third-party) adds more latency
- The preview's `waitForDeps()` can take up to 15s (the timeout in the generated HTML)

The verify almost always reads **before** the component finishes rendering, so errors are silently missed.

### Bug 3: Sandbox Prevents Reliable Error Reading

**File:** `components/library/ComponentEditor.tsx:445-446`

The preview iframe uses `sandbox="allow-scripts"` without `allow-same-origin`. While direct `contentWindow` property access usually works in Chromium, it's not reliable cross-browser and can fail with `SecurityError`. The catch block at line 187 swallows this and reports a generic message instead of actual render errors.

### Bug 4: No Console Logging of Library Agent Responses

**File:** `components/library/AgentSidebar.tsx:251-396`

The SSE streaming handler processes tool calls, content chunks, and tool results — but none of this is logged to the browser console. This makes debugging agent behavior impossible.

---

## Implementation Plan

### Fix 1: Eliminate Dual React Instance in TSX Preview

**File:** `components/library/constants.ts`

**Change:** Remove the UMD scripts (lines 317-318) and the import map (lines 316, 302-309). Instead, load React + ReactDOM from esm.sh as the **single source** via a `<script type="module">` bootstrap that assigns them to globals.

In `buildTsxPreview()`:

1. Remove the `<script type="importmap">` block
2. Remove the two UMD `<script>` tags for react and react-dom
3. Move React + ReactDOM loading into the existing `<script type="module">` block:
   ```js
   const R = await import('https://esm.sh/react@18');
   const RD = await import('https://esm.sh/react-dom@18');
   const RDC = await import('https://esm.sh/react-dom@18/client');
   window.React = R.default || R;
   window.ReactDOM = RD.default || RD;
   window.ReactDOM.createRoot = RDC.createRoot;
   ```
4. Load motion/react **without** `?external=react,react-dom` (so it bundles its own React from esm.sh, which is the same instance since it's the same CDN URL):
   ```js
   const m = await import('https://esm.sh/motion@11/react');
   ```
5. Same for third-party packages — remove `?external=react,react-dom` from esm.sh URLs
6. Keep Babel standalone and Tailwind CDN as-is (loaded as classic scripts)

The key insight: esm.sh caches modules by URL, so `import('https://esm.sh/react@18')` always returns the same module instance regardless of where it's imported from. By loading React this way in the module bootstrap, and having motion also import from esm.sh (without `?external`), they share the same React instance.

### Fix 2: Improve Verify Mechanism

**File:** `components/library/constants.ts`

Add a `postMessage` bridge in the generated preview HTML so errors are sent to the parent reliably:

1. Add a `reportErrors()` function that posts `preview-errors` messages to the parent
2. Call it after render completion, after errors, and on a periodic interval (every 1s for 10s)

**File:** `components/library/ComponentEditor.tsx`

1. Add a `useEffect` listening for `message` events with `type: 'preview-errors'`, storing latest errors in state
2. In the `agent-verify-component` handler, read from that state instead of `iframe.contentWindow`
3. Increase verify timeout from 1500ms to 8000ms
4. Auto-switch to preview mode when verify is triggered in code mode

### Fix 3: Console Logging of Library Agent Responses

**File:** `components/library/AgentSidebar.tsx`

**Change:** Add `console.log` calls at key points in `handleAgentSend`:

1. **Before streaming starts:** Log the request (messages, model, componentId)
   ```js
   console.log('[Library Agent] Sending:', { messages: history, model, componentId });
   ```
2. **After each SSE content chunk:** Log full accumulated text at milestones (e.g., every 500 chars) or on completion
3. **When streaming completes:** Log the final full response
   ```js
   console.log('[Library Agent] Response complete:', fullText);
   ```
4. **On tool calls:** Log each tool call and its result
   ```js
   console.log('[Library Agent] Tool call:', parsed.tool_call);
   console.log('[Library Agent] Tool result:', parsed.tool_result);
   ```
5. **On errors:** Log errors
   ```js
   console.error('[Library Agent] Error:', err);
   ```

---

## Files to Modify

| File | Changes |
|------|---------|
| `components/library/constants.ts` | Fix dual React instance, add `postMessage` error bridge |
| `components/library/ComponentEditor.tsx` | Listen for `postMessage` errors, increase verify timeout, auto-switch to preview mode, surface errors via notification |
| `components/library/AgentSidebar.tsx` | Add console.log for agent requests, responses, tool calls, and errors |

## Verification

1. Open the app, navigate to Library, select a TSX component (e.g. a ui-widget)
2. Click "Preview" — the component should render without "Invalid Hook Call" errors
3. Open the Library Agent sidebar, send a message — check browser console for `[Library Agent]` log entries
4. Trigger a `verify_component` from the agent — verify errors (if any) are reported back correctly and visible in the UI
