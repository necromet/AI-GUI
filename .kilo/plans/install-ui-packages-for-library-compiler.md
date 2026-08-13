# Plan: Install Radix UI & Common UI Packages for Library Compiler

## Problem

The library agent prompt explicitly tells the AI that Radix UI / shadcn/ui are **not available** (line 69 of `server/routes/libraryAgent.ts`). When the AI generates components anyway (or when users paste shadcn/ui code), compilation either fails or falls back to unreliable esm.sh resolution for packages that aren't in the `EXTERNAL_PACKAGES` list.

## Goal

Make Radix UI primitives and other common UI packages first-class citizens in the library component compiler — installable as npm deps, externalized by esbuild, and loaded in the preview iframe via import maps.

---

## Step 1: Install npm packages

```bash
npm install @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-checkbox @radix-ui/react-context-menu @radix-ui/react-hover-card @radix-ui/react-icons @radix-ui/react-menubar @radix-ui/react-navigation-menu @radix-ui/react-radio-group @radix-ui/react-slider @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-toggle @radix-ui/react-toggle-group cmdk vaul embla-carousel-react recharts date-fns react-day-picker react-hook-form @hookform/resolvers
```

This adds the remaining Radix UI primitives (the ones not already in `package.json`), plus commonly paired packages from the shadcn/ui ecosystem.

Already installed (no action): `@radix-ui/react-avatar`, `@radix-ui/react-collapsible`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slot`, `@radix-ui/react-switch`, `@radix-ui/react-tooltip`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `zod`, `sonner`.

---

## Step 2: Update `EXTERNAL_PACKAGES` in `server/services/tsxCompiler.ts`

Replace the flat list with a function that also matches package prefixes. This avoids listing every single `@radix-ui/*` sub-package individually and automatically covers transitive imports like `@radix-ui/react-primitive`.

**File:** `server/services/tsxCompiler.ts` (lines 4-13)

Current:
```ts
const EXTERNAL_PACKAGES = [
  'react', 'react-dom', 'react-dom/client', 'react/jsx-runtime',
  'motion/react', 'framer-motion',
  '@phosphor-icons/react', 'lucide-react',
];
```

New — add `EXTERNAL_PREFIXES` for namespace matching:
```ts
const EXTERNAL_PACKAGES = [
  'react', 'react-dom', 'react-dom/client', 'react/jsx-runtime',
  'motion/react', 'framer-motion',
  '@phosphor-icons/react', 'lucide-react',
  'class-variance-authority', 'clsx', 'tailwind-merge', 'zod',
  'date-fns', 'sonner',
];

const EXTERNAL_PREFIXES = [
  '@radix-ui/',
  'cmdk', 'vaul', 'embla-carousel-react',
  'recharts', 'react-day-picker',
  'react-hook-form', '@hookform/',
];
```

Then in the `onResolve` catch-all handler (line 210), change:
```ts
if (EXTERNAL_PACKAGES.includes(args.path)) return undefined;
```
to:
```ts
if (EXTERNAL_PACKAGES.includes(args.path) || EXTERNAL_PREFIXES.some(p => args.path.startsWith(p))) return undefined;
```

This way esbuild leaves these as bare `import` statements in the compiled output, and the browser resolves them via the preview iframe's import map.

---

## Step 3: Update the preview iframe import map in `components/library/constants.ts`

**File:** `components/library/constants.ts`, function `buildTsxPreview` (line 676)

Add entries for the new packages to the import map JSON object. Each entry points to esm.sh with `?external=react,react-dom` to share the same React instance:

```ts
imports: {
  // existing entries...
  'react': 'https://esm.sh/react@19',
  'react/jsx-runtime': 'https://esm.sh/react@19/jsx-runtime',
  'react-dom': 'https://esm.sh/react-dom@19',
  'react-dom/client': 'https://esm.sh/react-dom@19/client',
  'motion/react': 'https://esm.sh/motion@11/react?external=react,react-dom',
  'framer-motion': 'https://esm.sh/framer-motion@11?external=react,react-dom',
  '@phosphor-icons/react': 'https://esm.sh/@phosphor-icons/react?external=react,react-dom',
  'lucide-react': 'https://esm.sh/lucide-react@0.554.0?external=react,react-dom',

  // NEW — Radix UI primitives
  '@radix-ui/react-accordion': 'https://esm.sh/@radix-ui/react-accordion?external=react,react-dom',
  '@radix-ui/react-alert-dialog': 'https://esm.sh/@radix-ui/react-alert-dialog?external=react,react-dom',
  '@radix-ui/react-avatar': 'https://esm.sh/@radix-ui/react-avatar?external=react,react-dom',
  '@radix-ui/react-checkbox': 'https://esm.sh/@radix-ui/react-checkbox?external=react,react-dom',
  '@radix-ui/react-collapsible': 'https://esm.sh/@radix-ui/react-collapsible?external=react,react-dom',
  '@radix-ui/react-context-menu': 'https://esm.sh/@radix-ui/react-context-menu?external=react,react-dom',
  '@radix-ui/react-dialog': 'https://esm.sh/@radix-ui/react-dialog?external=react,react-dom',
  '@radix-ui/react-dropdown-menu': 'https://esm.sh/@radix-ui/react-dropdown-menu?external=react,react-dom',
  '@radix-ui/react-hover-card': 'https://esm.sh/@radix-ui/react-hover-card?external=react,react-dom',
  '@radix-ui/react-icons': 'https://esm.sh/@radix-ui/react-icons?external=react,react-dom',
  '@radix-ui/react-label': 'https://esm.sh/@radix-ui/react-label?external=react,react-dom',
  '@radix-ui/react-menubar': 'https://esm.sh/@radix-ui/react-menubar?external=react,react-dom',
  '@radix-ui/react-navigation-menu': 'https://esm.sh/@radix-ui/react-navigation-menu?external=react,react-dom',
  '@radix-ui/react-popover': 'https://esm.sh/@radix-ui/react-popover?external=react,react-dom',
  '@radix-ui/react-progress': 'https://esm.sh/@radix-ui/react-progress?external=react,react-dom',
  '@radix-ui/react-radio-group': 'https://esm.sh/@radix-ui/react-radio-group?external=react,react-dom',
  '@radix-ui/react-scroll-area': 'https://esm.sh/@radix-ui/react-scroll-area?external=react,react-dom',
  '@radix-ui/react-select': 'https://esm.sh/@radix-ui/react-select?external=react,react-dom',
  '@radix-ui/react-separator': 'https://esm.sh/@radix-ui/react-separator?external=react,react-dom',
  '@radix-ui/react-slider': 'https://esm.sh/@radix-ui/react-slider?external=react,react-dom',
  '@radix-ui/react-slot': 'https://esm.sh/@radix-ui/react-slot?external=react,react-dom',
  '@radix-ui/react-switch': 'https://esm.sh/@radix-ui/react-switch?external=react,react-dom',
  '@radix-ui/react-tabs': 'https://esm.sh/@radix-ui/react-tabs?external=react,react-dom',
  '@radix-ui/react-toast': 'https://esm.sh/@radix-ui/react-toast?external=react,react-dom',
  '@radix-ui/react-toggle': 'https://esm.sh/@radix-ui/react-toggle?external=react,react-dom',
  '@radix-ui/react-toggle-group': 'https://esm.sh/@radix-ui/react-toggle-group?external=react,react-dom',
  '@radix-ui/react-tooltip': 'https://esm.sh/@radix-ui/react-tooltip?external=react,react-dom',

  // NEW — Other UI packages
  'cmdk': 'https://esm.sh/cmdk?external=react,react-dom',
  'vaul': 'https://esm.sh/vaul?external=react,react-dom',
  'embla-carousel-react': 'https://esm.sh/embla-carousel-react?external=react,react-dom',
  'recharts': 'https://esm.sh/recharts?external=react,react-dom',
  'date-fns': 'https://esm.sh/date-fns?external=react,react-dom',
  'react-day-picker': 'https://esm.sh/react-day-picker?external=react,react-dom',
  'react-hook-form': 'https://esm.sh/react-hook-form?external=react,react-dom',
  '@hookform/resolvers': 'https://esm.sh/@hookform/resolvers?external=react,react-dom',
  'class-variance-authority': 'https://esm.sh/class-variance-authority?external=react,react-dom',
  'clsx': 'https://esm.sh/clsx?external=react,react-dom',
  'tailwind-merge': 'https://esm.sh/tailwind-merge?external=react,react-dom',
  'zod': 'https://esm.sh/zod?external=react,react-dom',
  'sonner': 'https://esm.sh/sonner?external=react,react-dom',
}
```

Also update the `buildThemePreviewHtml` function if it uses a similar import map.

---

## Step 4: Update the library agent prompt in `server/routes/libraryAgent.ts`

**File:** `server/routes/libraryAgent.ts`, `LIBRARY_AGENT_BASE_PROMPT` (lines 12-164)

### 4a. Update "Auto-Resolved Imports" section (line 45-51)

Add Radix UI and other packages to the list of auto-resolved imports:

```
- \`import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@radix-ui/react-accordion"\` → from esm.sh
- \`import { ChevronDownIcon } from "@radix-ui/react-icons"\` → from esm.sh
- \`import { Dialog, DialogContent, DialogTrigger } from "@radix-ui/react-dialog"\` → from esm.sh
- \`import { Command } from "cmdk"\` → from esm.sh
- \`import { Drawer } from "vaul"\` → from esm.sh
```

### 4b. Update "What Works in the Sandbox" section (line 59-66)

Add:
```
- Radix UI primitives (Accordion, Dialog, Dropdown Menu, Select, Tabs, Tooltip, Toast, etc.)
- shadcn/ui component patterns built on Radix UI + Tailwind CSS
- cmdk (command palette), vaul (drawer), recharts (charts)
- react-hook-form + zod for form validation
- react-day-picker for date selection
- class-variance-authority (cva) for component variants
```

### 4c. Update "What Does NOT Work" section (line 68-79)

Replace line 69:
```
- shadcn/ui, Radix UI, Headless UI — not available. Use raw HTML + Tailwind.
```
with:
```
- Headless UI — not available. Use Radix UI instead.
- @headlessui/react — not available.
```

Remove from the "not available" list:
- `react-hook-form, Formik` (now available via react-hook-form)

---

## Files Modified (summary)

| File | Change |
|------|--------|
| `package.json` | New npm dependencies added by `npm install` |
| `server/services/tsxCompiler.ts` | `EXTERNAL_PREFIXES` array + prefix matching in `onResolve` |
| `components/library/constants.ts` | Import map entries for Radix UI + other UI packages in `buildTsxPreview` |
| `server/routes/libraryAgent.ts` | Agent prompt updated: Radix UI now available, updated package lists |

---

## Verification

1. `npm run build` passes
2. Start dev server (`npm run dev:all`), open Library mode
3. Create a test component that imports from `@radix-ui/react-accordion` — verify it compiles and renders in preview
4. Ask the library agent to "create an accordion component using Radix UI" — verify it generates valid code that renders
