# Snackbar Position & Button Animations

## Task 1: Move Toaster to bottom-center

**File**: `App.tsx:1774`

The `<Toaster />` component (sonner) defaults to `bottom-right`. Add `position="bottom-center"` prop:

```tsx
<Toaster position="bottom-center" />
```

Sonner supports this natively — no CSS overrides needed.

---

## Task 2: Add hover/press animations to Agent Builder buttons

**Scope**: All interactive buttons within `.ab-container` (the agent-builder page root). This keeps changes scoped to `/experiments/plugin-agent` without affecting the rest of the app.

### Approach: CSS in `styles.css`

Add a single scoped rule block at the end of `components/agent-builder/styles.css` that targets all buttons within the agent builder container. This covers:

- **AgentSidebar**: Canvas/Chat tab buttons, `+` create buttons, `Add` confirmation buttons, sidebar item `<button>` elements, workflow delete button
- **AgentNode / ToolNode**: Info buttons (`.ab-node-info`)
- **AgentDetailPanel / ToolDetailPanel**: Close (`X`), Save, Delete, Attach/Detach tool buttons
- **AgentChatView**: Send/Stop button

### Animation spec

| State | Transform | Duration | Easing |
|-------|-----------|----------|--------|
| Default | `scale(1)` | — | — |
| Hover | `scale(1.05)` | 150ms | ease-out |
| Active (press) | `scale(0.95)` | 100ms | ease-in |

### CSS to add (end of `styles.css`)

```css
.ab-container button,
.ab-container [role="button"] {
  transition: transform 0.15s ease-out, background-color 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s;
}

.ab-container button:hover,
.ab-container [role="button"]:hover {
  transform: scale(1.05);
}

.ab-container button:active,
.ab-container [role="button"]:active {
  transform: scale(0.95);
  transition-duration: 0.1s;
  transition-timing-function: ease-in;
}
```

### Exclusions

- `.ab-handle` (React Flow connection handles) — already styled separately, and scaling them would break the canvas interaction
- Buttons that already have explicit `transition` or `transform` inline (e.g., the `animate-spin` loader buttons) — the CSS specificity is low enough that Tailwind utility classes will override when needed

### Risk: sidebar item hover conflict

The `.ab-sidebar-item` already has `transition: background 0.15s, border-color 0.15s`. The new rule adds `transform` to that transition. Since `.ab-sidebar-item` is a `<button>`, it will pick up the scale animation automatically. This is desirable — it gives the sidebar agent/tool items a subtle bounce on click.

---

## Files to change

| File | Change |
|------|--------|
| `App.tsx` | Add `position="bottom-center"` to `<Toaster />` |
| `components/agent-builder/styles.css` | Add scoped button animation rules |

## Verification

1. `npm run build` — must pass clean
2. Visual: toast notifications appear bottom-center instead of bottom-right
3. Visual: all buttons in `/experiments/plugin-agent` have hover scale-up and active press-down animations
