# Fix: `dims` temporal dead zone in StitchEditor.tsx

## Problem

`const dims = getLayoutDimensions(layout)` is declared at line 261, but the `ResizeObserver` useEffect at line 111–120 references `dims.width` both inside the callback and in its dependency array. Since `const` declarations are hoisted but not initialized (temporal dead zone), evaluating the dependency array at line 120 throws `ReferenceError: Cannot access 'dims' before initialization`.

## Fix

Move the `dims` declaration from line 261 up to the state/variable block (after line 62, near the other computed values like `hasGenerated`). This places it before all useEffects that reference it.

**File**: `components/StitchEditor.tsx`

Move:
```ts
const dims = getLayoutDimensions(layout);
```

From line 261 (after the useEffects) to right after line 62 (after `activeChips` state), alongside `hasGenerated`.

Also remove the now-redundant line 261 declaration.
