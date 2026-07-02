# Stitch Editor Improvements (v2)

## Changes

### 1. Fix scroll sync in the editable code editor (StitchEditor.tsx)

**Problem**: The syntax highlighter layer doesn't scroll when the textarea scrolls. `react-syntax-highlighter` wraps its output in a `<div>` → `<pre>` → `<code>` structure. The ref lands on the outer `<div>`, not the `<pre>`. The `onScroll` handler tries `pre.querySelector('pre')` which is unreliable, and `overflow: hidden` on `customStyle` only affects the outer wrapper, not the inner `<pre>`.

**Fix**: 
- Wrap both `SyntaxHighlighter` and `<textarea>` in a new `<div className="code-editor-scroll-container">` that has `position: relative; overflow: hidden; height: 100%`.
- `SyntaxHighlighter`: set `customStyle.overflow` to `'hidden'`, and set `overflow` on the inner `<pre>` via a CSS rule in `index.html` or via `codeTagProps` (though `codeTagProps` targets `<code>`, not `<pre>` — need a CSS approach).
- Add a global CSS rule in `index.html` `<style>`: `.code-editor-scroll-container pre { overflow: hidden !important; }`.
- The `<textarea>` remains `position: absolute; inset: 0; overflow: auto` — it drives all scrolling.
- Update the `onScroll` handler to find the `<pre>` inside the wrapper div:
  ```tsx
  onScroll={(e) => {
    const wrapper = e.currentTarget.parentElement;
    const pre = wrapper?.querySelector('pre');
    if (pre) {
      pre.scrollTop = e.currentTarget.scrollTop;
      pre.scrollLeft = e.currentTarget.scrollLeft;
    }
  }}
  ```
- Remove the `syntaxPreRef` ref (no longer needed).

### 2. Move model selection into the StitchEditor sidebar (StitchEditor.tsx)

**Problem**: The model selector only appears in the initial `StitchPromptBar` (empty state, no generated HTML). Once a design exists, the sidebar chat input has no model selector — the user can't change the model for follow-up edits.

**Fix**:
- In the sidebar's chat input area (the `<div>` containing the text input + send button, around line 530-570), add a model selector row above the input.
- Render a horizontal scrollable row of model chips (same pattern as `StitchPromptBar`'s model chips) filtered to chat models.
- Show this model selector only when `chatModels.length > 1`.
- Reuse the same styling: small chip buttons, active state with neon highlight.

### 3. Add more layout presets (types.ts, stitchService.ts, StitchPanel.tsx, agentService.ts)

**New layouts to add**:

| Layout key | Label | Category | Dimensions | Use case |
|---|---|---|---|---|
| `4:5` | 4:5 | Social | 1080×1350 | Instagram feed post (optimal) |
| `1.91:1` | 1.91:1 | Social | 1200×628 | Facebook/LinkedIn link preview |
| `4:3` | 4:3 | Web | 1440×1080 | Tablet / iPad |
| `3:4` | 3:4 | Web | 1080×1440 | Mobile portrait web |
| `32:9` | 32:9 | Web | 2560×1080 | Ultrawide hero |

Existing layouts stay: `16:9` (landscape/web), `1:1` (square/IG), `9:16` (reels/stories/portrait).

**Files to modify**:

1. **`types.ts:90`** — Extend `StitchLayout` union:
   ```ts
   export type StitchLayout = '16:9' | '1:1' | '9:16' | '4:5' | '1.91:1' | '4:3' | '3:4' | '32:9';
   ```

2. **`services/stitchService.ts:120-127`** — Add cases to `getLayoutDimensions()`:
   ```ts
   case '4:5': return { width: 1080, height: 1350 };
   case '1.91:1': return { width: 1200, height: 628 };
   case '4:3': return { width: 1440, height: 1080 };
   case '3:4': return { width: 1080, height: 1440 };
   case '32:9': return { width: 2560, height: 1080 };
   ```

3. **`server/services/agentService.ts:251-255`** — Add to `LAYOUT_DIMS`:
   ```ts
   '4:5': '1080x1350',
   '1.91:1': '1200x628',
   '4:3': '1440x1080',
   '3:4': '1080x1440',
   '32:9': '2560x1080',
   ```

4. **`components/StitchPanel.tsx:18-22`** — Expand `LAYOUT_OPTIONS` with grouped categories:
   ```ts
   const LAYOUT_OPTIONS: { value: StitchLayout; label: string; desc: string; category: string }[] = [
     { value: '1:1', label: '1:1', desc: 'Square', category: 'Social' },
     { value: '4:5', label: '4:5', desc: 'IG Feed', category: 'Social' },
     { value: '9:16', label: '9:16', desc: 'Reels/Story', category: 'Social' },
     { value: '1.91:1', label: '1.91:1', desc: 'FB/LinkedIn', category: 'Social' },
     { value: '16:9', label: '16:9', desc: 'Landscape', category: 'Web' },
     { value: '4:3', label: '4:3', desc: 'Tablet', category: 'Web' },
     { value: '3:4', label: '3:4', desc: 'Mobile', category: 'Web' },
     { value: '32:9', label: '32:9', desc: 'Ultrawide', category: 'Web' },
   ];
   ```
   Update the layout picker UI to group buttons by category with category labels.

## Files Modified

1. `index.html` — Add CSS rule for `.code-editor-scroll-container pre { overflow: hidden !important; }`
2. `components/StitchEditor.tsx` — Fix scroll sync, add model selector to sidebar
3. `types.ts` — Extend `StitchLayout` type
4. `services/stitchService.ts` — Add layout dimensions
5. `server/services/agentService.ts` — Add layout dimensions
6. `components/StitchPanel.tsx` — Expand layout options with categories
