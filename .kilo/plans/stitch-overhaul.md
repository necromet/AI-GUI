# Stitch Overhaul: Fix Back Button + Sidebar Streaming Visibility

## Root Cause Analysis

### Issue 1 & 3: Back button doesn't navigate / resets sidebar instead of routing

**Root cause** (`App.tsx:882`): The back button handler calls `setStitchControls(null)` *synchronouslyously* alongside `navigate('/experiments/stitch')`. This immediately nullifies `stitchControls`, which flips the header conditional at line 879 (`stitchControls ? stitch-header : regular-header`). The stitch header disappears on the *current* render — before navigation takes effect. The user sees the regular header appear, and depending on timing, the StitchPanel remounts with `stitchResetKey` increment but may briefly re-trigger the auto-select effect in `StitchPanel.tsx:44-52` before the URL updates.

**Fix**: Remove `setStitchControls(null)` from the back button handler. StitchEditor's cleanup effect (`StitchEditor.tsx:261-263`) already calls `onControlsChange?.(null)` when it unmounts, which handles nullifying `stitchControls` at the correct time.

### Issue 2: Thinking process + HTML generation not visible in sidebar during first generation

**Root cause** (`StitchEditor.tsx:279`): The sidebar content is a hard conditional:
```
chatMessages.length === 0 && !isGenerating → StitchPromptBar (chips)
else → chat messages + streaming indicator
```

During the **first generation**, `chatMessages` is empty (not yet saved) and `isGenerating` is true. The condition evaluates to `false`, so the sidebar switches to the `else` branch which shows chat messages + streaming indicator. This IS correct — the streaming indicator with thinking (lines 372-393) should appear.

However, there are two sub-issues:
1. The streaming indicator only shows when `thinkingText` is non-empty. If the model doesn't produce reasoning content (or takes a moment to start), the user sees "Generating..." with no thinking — feels empty.
2. The thinking text during streaming (`max-h-24`) may be too small or the styling too subtle to notice.

**Fix**: Make the streaming indicator always visible during generation (not gated by `thinkingText`). Show "Waiting for AI response..." when generating but no thinking yet, then transition to thinking display when content arrives.

---

## Implementation Plan

### Fix 1: Back button navigation (`App.tsx:882`)

**File**: `App.tsx`

Change line 882 from:
```tsx
onClick={() => { setStitchActiveProject(null); setStitchControls(null); setStitchResetKey(k => k + 1); navigate('/experiments/stitch'); }}
```
To:
```tsx
onClick={() => { setStitchActiveProject(null); setStitchResetKey(k => k + 1); navigate('/experiments/stitch'); }}
```

Remove only `setStitchControls(null)`. The cleanup effect in `StitchEditor.tsx:261-263` handles this when the editor unmounts due to the route change.

### Fix 2: Sidebar streaming visibility (`StitchEditor.tsx:372-393`)

**File**: `components/StitchEditor.tsx`

Update the streaming indicator in the sidebar to always show during generation, not just when `thinkingText` is present:

```tsx
{/* Streaming indicator — always visible during generation */}
{isGenerating && (
  <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: 'var(--bg-300)', border: '1px solid var(--border-300)' }}>
    <div className="flex items-center gap-2 mb-1">
      <Loader2 size={12} className="animate-spin" style={{ color: 'var(--neon-color)' }} />
      <span className="text-[11px] font-medium" style={{ color: 'var(--text-300)' }}>
        {streamingHtml ? 'Generating HTML...' : 'Waiting for AI response...'}
      </span>
    </div>
    {thinkingText && (
      <div className="mt-2" style={{ borderTop: '1px solid var(--border-300)', paddingTop: '6px' }}>
        <div className="flex items-center gap-1.5 mb-1">
          <Brain size={10} style={{ color: 'var(--neon-color)' }} />
          <span className="text-[10px] font-semibold" style={{ color: 'var(--text-500)' }}>Thinking</span>
        </div>
        <div className="max-h-24 overflow-y-auto text-[10px] font-mono leading-relaxed"
          style={{ color: 'var(--text-500)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {thinkingText}
        </div>
      </div>
    )}
    {streamingHtml && (
      <div className="mt-2" style={{ borderTop: '1px solid var(--border-300)', paddingTop: '6px' }}>
        <div className="flex items-center gap-1.5 mb-1">
          <Eye size={10} style={{ color: 'var(--neon-color)' }} />
          <span className="text-[10px] font-semibold" style={{ color: 'var(--text-500)' }}>HTML Preview</span>
        </div>
        <p className="text-[10px]" style={{ color: 'var(--text-500)' }}>
          {streamingHtml.length.toLocaleString()} characters received
        </p>
      </div>
    )}
  </div>
)}
```

This ensures:
- "Waiting for AI response..." shows immediately when generation starts (before any chunks arrive)
- "Generating HTML..." shows once HTML chunks start arriving
- Thinking section appears when reasoning content arrives
- HTML progress indicator shows character count of streaming HTML

---

## Files Changed

| File | Change |
|------|--------|
| `App.tsx:882` | Remove `setStitchControls(null)` from back button handler |
| `StitchEditor.tsx:372-393` | Always show streaming indicator during generation; add HTML progress counter |

---

## Testing Checklist

- [ ] Back button navigates to `/experiments/stitch` (project list)
- [ ] Back button doesn't flash regular header before navigation completes
- [ ] During first generation, sidebar shows streaming indicator (not just chips)
- [ ] "Waiting for AI response..." appears immediately when generation starts
- [ ] Thinking text appears in sidebar when reasoning content arrives
- [ ] HTML character count updates during streaming
- [ ] After generation completes, sidebar shows chat messages with thinking bubble
