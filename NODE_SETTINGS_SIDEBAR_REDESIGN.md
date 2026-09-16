# NodeSettingsSidebar — Redesign & Readability Overhaul

> Clean up the sidebar chrome, remove visual noise, improve spacing/typography, and modernize form fields for better readability.

---

## Current Problems

1. **1px color bar at top** — a thin colored strip that serves no purpose and looks like a rendering artifact
2. **Header is dense** — icon + label + node ID + close button are crammed into one row with a heavy `border-b`
3. **"Node Label" section wastes space** — full-width input with label+border-b for a single field
4. **"Configuration" row is redundant** — the label says "Configuration" but adds no value; the JSON toggle is buried
5. **Hard divider lines everywhere** — `border-b` on every section creates visual chop; the eye bounces between dividers instead of reading content
6. **Form fields lack breathing room** — `space-y-3` (12px) is tight for dense forms like AgentNodeConfig
7. **Footer hint is noise** — "Type {{ for variable autocomplete" is always visible but rarely needed
8. **Close button is small and far** — `p-1` with an X icon at the far right; easy to miss

---

## Redesign Principles

- **Remove all section dividers** (`border-b`, `border-t`) between header/label/config/footer — use spacing + background tones instead
- **One visual accent** — the node color appears only as a subtle header background tint, not a1px bar
- **Inline the label** into the header — editable node label replaces the separate "Node Label" section
- **Collapse the JSON toggle** into a small icon button in the header
- **Section headers** use uppercase micro-labels with generous top padding instead of divider lines
- **Form fields** get consistent `space-y-4` (16px) spacing and slightly larger padding
- **Footer hint** becomes a subtle one-liner that only shows when the textarea is focused

---

## Implementation Plan

### Part 1: Redesign `NodeSettingsPanel.tsx` (the shell)

**File:** `components/agent-builder/NodeSettingsPanel.tsx`

#### 1.1 — Remove the1px color bar

Delete:
```tsx
<div className="h-1 w-full" style={{ backgroundColor: color }} />
```

Replace with a subtle header background that uses the node color at very low opacity:

```tsx
<div
  className="flex items-center justify-between px-4 py-3"
  style={{ backgroundColor: `${color}08` }}
>
```

This tints the entire header area with the node color at5% opacity — barely visible but gives each node type a unique feel.

#### 1.2 — Redesign the header

**Before** (current):
```
[icon] [Label Settings / node.id] [X]
```

**After** (redesigned):
```
[icon] [editable label input] [JSON toggle] [X]
```

The header becomes:
- A colored icon badge (same as now, but slightly larger: `w-7 h-7`)
- An inline editable `<input>` for the node label — styled to look like plain text until focused
- A compact `{ }` icon button for JSON toggle (replaces the separate "Configuration" row)
- The close button stays at the far right

The node ID moves to a subtle monospace line below the label (only shown if the label differs from the ID).

```tsx
<div
  className="flex items-center gap-2 px-4 py-3"
  style={{ backgroundColor: `${color}08` }}
>
  <div
    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
    style={{ backgroundColor: `${color}18` }}
  >
    <IconComponent size={14} style={{ color }} />
  </div>
  <input
    value={label}
    onChange={e => handleUpdate({ label: e.target.value })}
    className="flex-1 min-w-0 text-sm font-semibold bg-transparent border-none outline-none px-1 py-0.5 rounded hover:bg-[var(--bg-200)] focus:bg-[var(--bg-200)] transition-colors"
    style={{ color: 'var(--text-100)' }}
  />
  <button
    onClick={() => setShowJson(!showJson)}
    className="p-1.5 rounded transition-colors cursor-pointer flex-shrink-0"
    style={{
      backgroundColor: showJson ? `${color}20` : 'transparent',
      color: showJson ? color : 'var(--text-500)',
    }}
    title={showJson ? 'Switch to visual' : 'Switch to JSON'}
  >
    <Code size={13} />
  </button>
  <button
    onClick={onClose}
    className="p-1.5 rounded hover:bg-[var(--bg-300)] transition-colors cursor-pointer flex-shrink-0"
    style={{ color: 'var(--text-500)' }}
  >
    <X size={14} />
  </button>
</div>
```

Import `Code` from `lucide-react` (already available in the project).

#### 1.3 — Remove the "Node Label" section

Delete the entire block:
```tsx
<div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-300)' }}>
  <label className="text-xs font-medium block mb-1" ...>Node Label</label>
  <input ... />
</div>
```

The label is now inline in the header (step1.2).

#### 1.4 — Remove the "Configuration" header row

Delete:
```tsx
<div className="flex items-center justify-between px-4 py-2 border-b" ...>
  <span ...>Configuration</span>
  <button ...>JSON</button>
</div>
```

The JSON toggle is now in the header (step1.2).

#### 1.5 — Remove the footer hint

Delete:
```tsx
<div className="px-4 py-2 border-t text-[10px]" ...>
  Type {{ for variable autocomplete
</div>
```

Replace with a context-aware hint that only appears when a textarea/VariableAutocomplete is focused. This will be handled in Part2 (the config panels).

#### 1.6 — Update the scrollable content area

Change the content wrapper from:
```tsx
<div className="flex-1 px-4 py-3 overflow-y-auto">
```

To:
```tsx
<div className="flex-1 px-4 pt-4 pb-6 overflow-y-auto">
```

- `pt-4` instead of `py-3` — more top breathing room since there's no divider
- `pb-6` — extra bottom padding so content doesn't sit flush against the viewport edge

#### 1.7 — JSON view styling update

When JSON mode is active, the `<pre>` block should span the full content area with no extra wrapper padding:

```tsx
{showJson ? (
  <div className="flex-1 overflow-y-auto">
    <pre
      className="text-[11px] font-mono p-4 h-full"
      style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)' }}
    >
      {JSON.stringify(node.data, null, 2)}
    </pre>
  </div>
) : (
  <div className="flex-1 px-4 pt-4 pb-6 overflow-y-auto">
    {/* config panel */}
  </div>
)}
```

#### 1.8 — Resize handle refinement

Keep the1px neon strip at `opacity: 0.15` (already done). Add a wider hover target:

```tsx
<div
  className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 group"
  onMouseDown={handleResizeStart}
>
  <div
    className="absolute left-0 top-0 bottom-0 w-0.5 transition-colors group-hover:bg-[var(--neon-color)]"
    style={{ opacity: isResizing ? 1 : 0.15, backgroundColor: isResizing ? 'var(--neon-color)' : undefined }}
  />
</div>
```

This gives a8px hover target (w-2) with a2px visible strip (w-0.5) — easier to grab without being visually heavy.

---

### Part 2: Update all12 Node Config Panels

Every config panel shares the same form field patterns. Apply these readability improvements uniformly.

#### 2.1 — Increase field spacing

In every config panel, change `space-y-3` to `space-y-4`:

| File | Before | After |
|------|--------|-------|
| `AgentNodeConfig.tsx` | `space-y-3` | `space-y-4` |
| `MCPNodeConfig.tsx` | `space-y-3` | `space-y-4` |
| `TransformNodeConfig.tsx` | `space-y-3` | `space-y-4` |
| `IfElseNodeConfig.tsx` | `space-y-3` | `space-y-4` |
| `WhileNodeConfig.tsx` | `space-y-3` | `space-y-4` |
| `ApprovalNodeConfig.tsx` | `space-y-3` | `space-y-4` |
| `EndNodeConfig.tsx` | `space-y-3` | `space-y-4` |
| `NoteNodeConfig.tsx` | `space-y-3` | `space-y-4` |
| `HTTPNodeConfig.tsx` | `space-y-3` | `space-y-4` |
| `ExtractNodeConfig.tsx` | `space-y-3` | `space-y-4` |
| `SetStateNodeConfig.tsx` | `space-y-3` | `space-y-4` |
| `StartNodeConfig.tsx` | `space-y-3` | `space-y-4` |

#### 2.2 — Improve form field styling

Create a shared style constant to avoid repetition. Add to `components/agent-builder/shared/formStyles.ts`:

```ts
export const FIELD_STYLES = {
  label: { color: 'var(--text-300)' },
  input: {
    borderColor: 'var(--border-300)',
    color: 'var(--text-100)',
    backgroundColor: 'transparent',
  },
  helperText: { color: 'var(--text-500)' },
  sectionBg: 'var(--bg-200)',
} as const;

export const fieldClasses = {
  input: 'w-full px-2.5 py-2 text-xs rounded-lg border bg-transparent transition-colors focus:ring-1 focus:ring-[var(--neon-color)] focus:border-[var(--neon-color)] outline-none',
  textarea: 'w-full px-2.5 py-2 text-xs rounded-lg border bg-transparent resize-none font-mono transition-colors focus:ring-1 focus:ring-[var(--neon-color)] focus:border-[var(--neon-color)] outline-none',
  select: 'w-full px-2.5 py-2 text-xs rounded-lg border bg-transparent transition-colors focus:ring-1 focus:ring-[var(--neon-color)] focus:border-[var(--neon-color)] outline-none',
  label: 'text-xs font-medium block mb-1.5',
} as const;
```

Key changes from current styling:
- `rounded` → `rounded-lg` — softer corners
- `px-2 py-1.5` → `px-2.5 py-2` — more internal padding
- Add `focus:ring-1 focus:ring-[var(--neon-color)]` — visible focus state
- Add `transition-colors` — smooth state changes
- `mb-1` → `mb-1.5` — slightly more gap between label and field

#### 2.3 — Update `AgentNodeConfig.tsx` specifically

This is the most complex panel. Improvements:

1. **Model selector** — add provider badge next to each option
2. **System/User Prompt** — add a collapsible "Advanced" section for max tokens, temperature, output format
3. **Prompt template selector** — move to a dropdown button with preview instead of a separate `<select>`
4. **Token estimate** — move inline with the footer or make it a subtle badge

Proposed new structure:
```
┌─────────────────────────────────┐
│ Model                    [badge]│
│ [select with provider labels]   │
│                                 │
│ System Prompt    [template ▾]   │
│ [textarea with line numbers]    │
│                                 │
│ User Prompt                     │
│ [textarea with line numbers]    │
│                                 │
│ ── Advanced ─────────── [▸] ── │
│ (collapsed by default)          │
│   Max Tokens     Temperature    │
│   [input]        [input]        │
│   Output Format                 │
│   [select]                      │
│   ☑ Include chat history        │
│                                 │
│ ~10 tokens                      │
└─────────────────────────────────┘
```

#### 2.4 — Add section labels for grouped fields

For panels with multiple logical groups, add subtle uppercase section labels:

```tsx
<div className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-500)' }}>
  Prompt
</div>
```

Apply to:
- `AgentNodeConfig.tsx` — "Model", "Prompt", "Advanced"
- `HTTPNodeConfig.tsx` — "Request", "Headers", "Body"
- `StartNodeConfig.tsx` — "Input Variables"
- `SetStateNodeConfig.tsx` — "Variables"

#### 2.5 — Improve the `VariableAutocomplete` hint

Instead of the permanent footer hint, show a contextual hint only when a `VariableAutocomplete` textarea is focused.

In `VariableAutocomplete.tsx`, add a subtle floating hint below the textarea when focused:

```tsx
{isFocused && (
  <div className="text-[9px] mt-1 flex items-center gap-1" style={{ color: 'var(--text-500)' }}>
    <kbd className="px-1 py-0.5 rounded text-[8px]" style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-500)' }}>
      {'{{'}
    </kbd>
    <span>for variables</span>
  </div>
)}
```

This requires adding an `isFocused` state tracked via `onFocus`/`onBlur` on the textarea/input.

---

### Part 3: Visual Polish

#### 3.1 — Header background transitions

When switching between nodes, the header tint should transition smoothly:

```tsx
style={{
  backgroundColor: `${color}08`,
  transition: 'background-color 0.2s ease',
}}
```

#### 3.2 — Scrollbar styling

Add a thin custom scrollbar to the content area via CSS in `globals.css`:

```css
.node-settings-scroll::-webkit-scrollbar {
  width: 4px;
}
.node-settings-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.node-settings-scroll::-webkit-scrollbar-thumb {
  background: var(--border-300);
  border-radius: 2px;
}
.node-settings-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--text-500);
}
```

Apply class `node-settings-scroll` to the scrollable content div.

#### 3.3 — Focus ring color matching

When a field is focused, the ring color should match the node's accent color. This requires passing `color` down to config panels.

Update the config panel interface:

```ts
interface ConfigPanelProps {
  data: Record<string, any>;
  onUpdate: (data: Record<string, any>) => void;
  upstreamNodes?: { id: string; label: string }[];
  accentColor?: string;
}
```

Pass `color` as `accentColor` from `NodeSettingsPanel.tsx`:

```tsx
<ConfigPanel
  data={node.data}
  onUpdate={handleUpdate}
  upstreamNodes={upstreamNodes}
  accentColor={color}
/>
```

Config panels can then use it for focus rings:

```tsx
style={{
  '--accent': accentColor || 'var(--neon-color)',
} as React.CSSProperties}
```

```css
/* In the field classes */
focus:ring-[var(--accent)]
```

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `NodeSettingsPanel.tsx` | Remove color bar, redesign header (inline label, JSON toggle, icon), remove "Node Label" section, remove "Configuration" row, remove footer hint, update content padding, update JSON view, refine resize handle |
| `shared/formStyles.ts` | **NEW** — shared field classes and style constants |
| `AgentNodeConfig.tsx` | Use shared styles, add section labels, add collapsible "Advanced" group, increase spacing |
| `MCPNodeConfig.tsx` | Use shared styles, increase spacing |
| `TransformNodeConfig.tsx` | Use shared styles, increase spacing |
| `IfElseNodeConfig.tsx` | Use shared styles, increase spacing |
| `WhileNodeConfig.tsx` | Use shared styles, increase spacing |
| `ApprovalNodeConfig.tsx` | Use shared styles, increase spacing |
| `EndNodeConfig.tsx` | Use shared styles, increase spacing |
| `NoteNodeConfig.tsx` | Use shared styles, increase spacing |
| `HTTPNodeConfig.tsx` | Use shared styles, add section labels, increase spacing |
| `ExtractNodeConfig.tsx` | Use shared styles, increase spacing |
| `SetStateNodeConfig.tsx` | Use shared styles, add section labels, increase spacing |
| `StartNodeConfig.tsx` | Use shared styles, add section labels, increase spacing |
| `VariableAutocomplete.tsx` | Add focus-aware contextual hint, add `isFocused` state |
| `globals.css` | Add `.node-settings-scroll` scrollbar styles |

**Total: 16 files (15 modified +1 new)**

---

## Implementation Order

| Step | Task | Files | Effort |
|------|------|-------|--------|
| 1 | Create `shared/formStyles.ts` with shared constants | 1 new file | 3 min |
| 2 | Redesign `NodeSettingsPanel.tsx` shell | `NodeSettingsPanel.tsx` | 10 min |
| 3 | Update `AgentNodeConfig.tsx` (most complex) | `AgentNodeConfig.tsx` | 10 min |
| 4 | Update remaining11 config panels with shared styles | 11 files | 15 min |
| 5 | Add focus-aware hint to `VariableAutocomplete.tsx` | `VariableAutocomplete.tsx` | 5 min |
| 6 | Add scrollbar CSS to `globals.css` | `globals.css` | 2 min |
| 7 | Build verification | `npm run build` | 2 min |

**Total estimated effort: ~47 minutes**
