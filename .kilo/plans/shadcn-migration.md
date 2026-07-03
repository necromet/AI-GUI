# Plan: Migrate All Components to shadcn/ui

## Overview

Migrate the entire edward:labs codebase from hand-rolled UI components to **shadcn/ui** components. This involves switching from CDN Tailwind to npm Tailwind, installing all required Radix UI primitives, creating shadcn base components, and migrating every application component.

---

## Phase 1: Switch from CDN Tailwind to npm Tailwind

### 1.1 Install npm packages

```bash
npm install tailwindcss @tailwindcss/vite tailwindcss-animate
```

> Note: Vite 6 + Tailwind 4 uses `@tailwindcss/vite` plugin instead of PostCSS. Since the project uses Vite, this is the cleanest path.

### 1.2 Create CSS entry file `src/globals.css`

Migrate all CSS from `index.html` `<style>` block into a proper CSS file:
- shadcn CSS variables (`:root` and `html.dark`)
- Custom scrollbar styles
- Code block styles (`.prose pre`, `.prose code`)
- Neon utility classes (`.neon-text`, `.neon-border`, etc.)
- Glass panel styles
- Square loader keyframes
- Focus ring overrides
- Math/selection styles

Import Tailwind directives at top:
```css
@import "tailwindcss";
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Add `@layer base` for CSS variable definitions and `@layer utilities` for custom utilities.

### 1.3 Update `vite.config.ts`

Add the Tailwind Vite plugin:
```ts
import tailwindcss from '@tailwindcss/vite';
// ...
plugins: [react(), tailwindcss()],
```

### 1.4 Update `index.html`

- Remove the `<script src="https://cdn.tailwindcss.com">` tag
- Remove the entire inline `<script>tailwind.config = {...}</script>` block
- Remove the `<style>` block (moved to globals.css)
- Add `<link rel="stylesheet" href="/src/globals.css">` or import in entry point

### 1.5 Create `tailwind.config.ts`

Port the existing Tailwind config from `index.html`:
- `darkMode: 'class'`
- Extended colors (sidebar, main, hover, user, neon, background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring)
- Font families (Fredoka, Comfortaa, Google Sans)
- All custom keyframes and animations
- Add `tailwindcss-animate` plugin

### 1.6 Import globals.css in entry point

In `index.tsx`, add: `import './src/globals.css'`

---

## Phase 2: Install Radix UI Dependencies

```bash
npm install @radix-ui/react-popover @radix-ui/react-tabs @radix-ui/react-scroll-area @radix-ui/react-separator @radix-ui/react-avatar @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-switch @radix-ui/react-progress @radix-ui/react-slider @radix-ui/react-collapsible @radix-ui/react-toggle @radix-ui/react-toggle-group @radix-ui/react-toast
```

Already installed (keep):
- `@radix-ui/react-dialog`
- `@radix-ui/react-select`
- `@radix-ui/react-slot`
- `@radix-ui/react-tooltip`

---

## Phase 3: Create shadcn/ui Base Components

Create/update files in `components/ui/`. Each follows standard shadcn patterns with `cn()`, `forwardRef`, and Radix primitives.

### New components to create:

| Component | File | Radix Package |
|-----------|------|---------------|
| Dialog | `components/ui/dialog.tsx` | `@radix-ui/react-dialog` |
| Popover | `components/ui/popover.tsx` | `@radix-ui/react-popover` |
| Tabs | `components/ui/tabs.tsx` | `@radix-ui/react-tabs` |
| Input | `components/ui/input.tsx` | native `<input>` |
| Textarea | `components/ui/textarea.tsx` | native `<textarea>` |
| Tooltip | `components/ui/tooltip.tsx` | `@radix-ui/react-tooltip` |
| Sheet | `components/ui/sheet.tsx` | `@radix-ui/react-dialog` |
| ScrollArea | `components/ui/scroll-area.tsx` | `@radix-ui/react-scroll-area` |
| Separator | `components/ui/separator.tsx` | `@radix-ui/react-separator` |
| Avatar | `components/ui/avatar.tsx` | `@radix-ui/react-avatar` |
| DropdownMenu | `components/ui/dropdown-menu.tsx` | `@radix-ui/react-dropdown-menu` |
| Label | `components/ui/label.tsx` | `@radix-ui/react-label` |
| Switch | `components/ui/switch.tsx` | `@radix-ui/react-switch` |
| Progress | `components/ui/progress.tsx` | `@radix-ui/react-progress` |
| Collapsible | `components/ui/collapsible.tsx` | `@radix-ui/react-collapsible` |
| Toggle | `components/ui/toggle.tsx` | `@radix-ui/react-toggle` |
| ToggleGroup | `components/ui/toggle-group.tsx` | `@radix-ui/react-toggle-group` |
| Sonner (toast) | `components/ui/sonner.tsx` | `sonner` library |

### Existing components to update:

| Component | Changes |
|-----------|---------|
| `button.tsx` | Already correct shadcn — no changes |
| `card.tsx` | Already correct shadcn — no changes |
| `select.tsx` | Already correct shadcn — no changes |
| `badge.tsx` | Already correct shadcn — no changes |
| `code-editor-sheet.tsx` | Refactor to use new `sheet.tsx` primitives instead of inline Radix Dialog |
| `loader-2.tsx` | Keep as-is (custom loader) |
| `demo.tsx` | Keep as-is (demo page) |

---

## Phase 4: Migrate Application Components

### 4.1 `components/Settings.tsx`
**Current:** Custom modal with `fixed inset-0` overlay, custom tabs sidebar, custom inputs
**Migration:**
- Modal → `Dialog` + `DialogContent`
- Tabs sidebar → `Tabs` with `TabsList` + `TabsTrigger`
- Theme toggle → `Switch`
- Model select → `Select` (shadcn)
- Font size buttons → `ToggleGroup`
- Inputs → `Input`
- Labels → `Label`
- Lock Screen button → `Button` (destructive variant)

### 4.2 `components/ModelSelect.tsx`
**Current:** Custom dropdown with manual click-outside detection
**Migration:**
- Dropdown → `Popover` + `PopoverContent` + `PopoverTrigger`
- Model items → styled buttons inside PopoverContent
- Keep sections (Token Plan / API Key) as styled dividers

### 4.3 `components/Sidebar.tsx`
**Current:** All custom HTML with inline `style={{}}` on every element
**Migration:**
- Sidebar container → `Sheet` (for mobile), fixed aside (for desktop)
- Buttons → `Button` (ghost variant)
- Section labels → `Label` or styled div
- Conversation items → `Button` (ghost variant) with hover states via Tailwind
- Separator → `Separator`
- User avatar → `Avatar` + `AvatarFallback`
- Replace ALL inline `style={{}}` with Tailwind utility classes
- Theme toggle button → `Button` (ghost)

### 4.4 `components/ModeSelector.tsx`
**Current:** Custom password modal overlay with form
**Migration:**
- Password modal → `Dialog` + `DialogContent`
- Password input → `Input`
- Unlock button → `Button`
- Close button → `DialogClose` or `Button` (ghost)
- Mode cards → `Card` + `CardContent`

### 4.5 `components/TokenUsageStats.tsx`
**Current:** Custom full-screen modal with tabs and charts
**Migration:**
- Modal → `Dialog` + `DialogContent` (large)
- Tabs → `Tabs` + `TabsList` + `TabsTrigger`
- Select (time range) → `Select` (shadcn)
- Metric cards → `Card`
- Close button → `Button` (ghost)

### 4.6 `components/ChatMessage.tsx`
**Current:** Custom code blocks, copy buttons, collapsible reasoning, image lightbox
**Migration:**
- Copy/regenerate/feedback buttons → `Button` (ghost variant)
- Collapsible reasoning → `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent`
- Image lightbox → `Dialog` + `DialogContent`
- Source cards → `Card`
- Replace inline styles with Tailwind

### 4.7 `components/PromptInputBox.tsx`
**Current:** Already uses Radix Tooltip and Dialog internally
**Migration:**
- Inline Tooltip/Dialog definitions → import from `components/ui/tooltip.tsx` and `components/ui/dialog.tsx`
- Inline Button → import from `components/ui/button.tsx`
- Inline Textarea → import from `components/ui/textarea.tsx`
- Search/Think toggle buttons → `Toggle` or `ToggleGroup`
- File preview → keep custom (works well)

### 4.8 `components/Notification.tsx`
**Current:** Custom toast with progress bar
**Migration:**
- Replace with `sonner` toast library (shadcn recommended)
- Install: `npm install sonner`
- Create `components/ui/sonner.tsx` wrapper
- Update `App.tsx` to use `toast()` from sonner instead of custom Notification state
- OR keep as custom but use `Card` + `Progress` components

### 4.9 `components/TTSPanel.tsx`
**Current:** Custom textarea, select, input, button
**Migration:**
- Textarea → `Textarea`
- Voice select → `Select` (shadcn)
- Style input → `Input`
- Generate button → `Button`
- Labels → `Label`

### 4.10 `components/VoiceDesignPanel.tsx`
**Current:** Custom textarea, input, button (same pattern as TTS)
**Migration:** Same as TTSPanel

### 4.11 `components/VoiceClonePanel.tsx`
**Current:** Custom textarea, input, file upload, button
**Migration:**
- Textarea → `Textarea`
- Style input → `Input`
- File upload → `Input` (type=file) styled as drop zone
- Buttons → `Button`

### 4.12 `components/ASRPanel.tsx`
**Current:** Custom file upload, recording UI, transcription display
**Migration:**
- Mode toggle → `ToggleGroup`
- File upload → styled `Input` (type=file)
- Copy button → `Button` (ghost)
- Transcription display → `Card`

### 4.13 `components/StitchPanel.tsx`
**Current:** Custom project grid, create form, layout selector
**Migration:**
- Project cards → `Card` + `CardContent`
- New Project button → `Button`
- Project name input → `Input`
- Layout/type buttons → `Button` (outline variants)
- Cancel button → `Button` (ghost)
- Delete button → `Button` (ghost, destructive)

### 4.14 `components/StitchExportModal.tsx`
**Current:** Custom modal
**Migration:**
- Modal → `Dialog` + `DialogContent`
- Export buttons → `Button`
- Progress → `Progress` component
- Close → `DialogClose`

### 4.15 `components/StitchEditor.tsx`
**Current:** Complex editor with inline styles
**Migration:**
- Toolbar buttons → `Button` (ghost/outline variants)
- Board tabs → `Tabs` or `ToggleGroup`
- Status indicators → `Badge`
- Splitter/layout → keep custom (complex layout logic)

### 4.16 `components/StitchPromptBar.tsx`
**Current:** Custom prompt input with chips
**Migration:**
- Text input → `Input`
- Generate button → `Button`
- Chips → `Toggle` or `Badge` (clickable)
- Model select → `Select` (shadcn)

### 4.17 `components/StitchImageManager.tsx`
**Current:** Custom image management
**Migration:**
- URL input → `Input`
- Label input → `Input`
- Add button → `Button`
- Remove button → `Button` (ghost, destructive)

### 4.18 `components/StitchLibrary.tsx`
**Current:** Custom library panel
**Migration:**
- Search → `Input`
- Category tabs → `Tabs` or `ToggleGroup`
- Component cards → `Card`
- Action buttons → `Button`

### 4.19 `components/RAGChatPanel.tsx`
**Current:** Custom panels with inline styles
**Migration:**
- Document list → `Card` items
- Upload button → `Button`
- File input → styled
- Chat messages → already uses `ChatMessage` component
- Input → already uses `PromptInputBox`

### 4.20 `components/AgentChatPanel.tsx`
**Current:** Custom tool result display
**Migration:**
- Tool toggles → `ToggleGroup`
- Tool results → `Card` with `Collapsible`
- Status badges → `Badge`
- Chat → already uses `PromptInputBox` + `ChatMessage`

### 4.21 `components/LibraryPanel.tsx`
**Current:** Custom library with search, categories, AI agent
**Migration:**
- Search → `Input`
- Category tabs → `Tabs` or `ToggleGroup`
- Component cards → `Card`
- Action buttons → `Button`
- AI agent chat → `Input` + `Button`

### 4.22 `components/PluginAgentPanel.tsx`
**Current:** Simple feature list
**Migration:**
- Feature cards → `Card` + `CardContent`
- Icons → keep Lucide icons

### 4.23 `components/AIVoiceInput.tsx`
**Current:** Custom voice recording UI
**Migration:**
- Record button → `Button` (round)
- Visualizer → keep custom (no shadcn equivalent)
- Status text → keep styled span

### 4.24 `components/NeuralBackground.tsx`
**Current:** Canvas-based background animation
**Migration:** Keep as-is (no UI components to migrate)

### 4.25 `components/TextGlitch.tsx`
**Current:** Text animation effect
**Migration:** Keep as-is (no UI components to migrate)

### 4.26 `App.tsx`
**Current:** Custom inline buttons, layout, suggestion cards
**Migration:**
- Sidebar toggle button → `Button` (ghost)
- New chat button → `Button` (ghost)
- Suggestion cards → `Card`
- Top bar buttons → `Button` (ghost/outline variants)
- Stitch controls bar → `Button` variants + `Badge`
- Replace ALL inline `style={{}}` with Tailwind utility classes

---

## Phase 5: Cleanup

### 5.1 Remove unused code
- Remove duplicate Button/Dialog/Tooltip definitions from `PromptInputBox.tsx`
- Remove inline style patterns that are replaced by Tailwind

### 5.2 Install sonner (if using toast approach)
```bash
npm install sonner
```
Add `<Toaster />` to `App.tsx` root.

### 5.3 Verify
- Run `npm run build` to check for build errors
- Run `npm run dev` and manually test each component
- Verify dark/light mode still works
- Verify neon color system still works
- Test mobile responsiveness

---

## Component Dependency Map

```
App.tsx
├── ModeSelector.tsx        → Dialog, Input, Button, Card
├── Sidebar.tsx             → Sheet, Button, Separator, Avatar, ScrollArea
├── ModelSelect.tsx         → Popover, Button, Badge
├── Settings.tsx            → Dialog, Tabs, Input, Switch, Select, Label, Button
├── TokenUsageStats.tsx     → Dialog, Tabs, Select, Card, Button, Badge
├── ChatMessage.tsx         → Button, Collapsible, Dialog, Card, Badge
├── PromptInputBox.tsx      → Button, Textarea, Tooltip, Dialog, Toggle
├── Notification.tsx        → Sonner/Toast
├── TTSPanel.tsx            → Input, Textarea, Select, Button, Label
├── VoiceDesignPanel.tsx    → Input, Textarea, Button, Label
├── VoiceClonePanel.tsx     → Input, Textarea, Button, Label
├── ASRPanel.tsx            → Input, Button, ToggleGroup, Card
├── StitchPanel.tsx         → Input, Button, Card
├── StitchEditor.tsx        → Button, Badge, ToggleGroup, Card
├── StitchExportModal.tsx   → Dialog, Button, Progress
├── StitchPromptBar.tsx     → Input, Button, Toggle, Select
├── StitchImageManager.tsx  → Input, Button
├── StitchLibrary.tsx       → Input, Button, Card, Tabs
├── RAGChatPanel.tsx        → Button, Input, Card
├── AgentChatPanel.tsx      → ToggleGroup, Card, Badge, Collapsible
├── LibraryPanel.tsx        → Input, Button, Card, Tabs
└── PluginAgentPanel.tsx    → Card
```

---

## Execution Order

1. **Phase 1** (Foundation) — Must be done first, everything depends on it
2. **Phase 2** (Dependencies) — Install all Radix packages
3. **Phase 3** (Base Components) — Create shadcn primitives
4. **Phase 4** (Migration) — Can be done component by component:
   - Start with leaf components (Notification, PluginAgentPanel)
   - Then shared components (ChatMessage, PromptInputBox)
   - Then panels (TTSPanel, ASRPanel, etc.)
   - Then complex components (Settings, Sidebar, App)
5. **Phase 5** (Cleanup) — Final pass
