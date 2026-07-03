# Plan: Enhanced Stitch Library — Images, Palettes & Layouts

## Problem

Image references are per-project only (`StitchImageManager` → `project.images`). There's no way to reuse images across projects, save color palettes, or store reusable layout templates. The library (`StitchLibrary`) already supports sections/components/icons/SVGs/templates but lacks image, palette, and layout categories.

## Goal

Add three new library categories — **image**, **palette**, **layout** — to the server-side component library. Integrate them into the StitchLibrary UI with specialized rendering, and wire them into the AI generation context.

---

## Architecture Overview

### Current Flow
```
StitchEditor sidebar → Library tab
  ├── StitchImageManager (per-project images, client-only)
  └── StitchLibrary (server-side components: section, component, icon, svg, template)
```

### Target Flow
```
StitchEditor sidebar → Library tab
  ├── StitchLibrary (unified, server-side)
  │   ├── Category: All / Sections / Components / Icons / SVGs / Templates
  │   ├── Category: Images (NEW — reusable across projects)
  │   ├── Category: Palettes (NEW — color schemes)
  │   └── Category: Layouts (NEW — reusable slide structures)
  └── Quick image bar (compact per-project image chips, optional)
```

---

## File Changes

### 1. `types/stitchSpec.ts` — Add new categories

Update `StitchComponent.category` union:
```ts
category: 'section' | 'component' | 'icon' | 'svg' | 'template' | 'widget' | 'image' | 'palette' | 'layout';
```

Add new content types:
```ts
contentType: 'html' | 'svg' | 'json' | 'js' | 'image-url' | 'image-base64' | 'colors';
```

### 2. `server/services/stitchLibraryService.ts` — Update type

Mirror the category/contentType union changes from the client type.

### 3. `components/StitchLibrary.tsx` — Major UI enhancement

#### 3a. Update CATEGORIES array
```ts
const CATEGORIES = [
  { key: 'all', label: 'All', icon: <Package /> },
  { key: 'section', label: 'Sections', icon: <Layers /> },
  { key: 'component', label: 'Components', icon: <LayoutGrid /> },
  { key: 'image', label: 'Images', icon: <ImageIcon /> },       // NEW
  { key: 'palette', label: 'Palettes', icon: <Palette /> },     // NEW
  { key: 'layout', label: 'Layouts', icon: <Layout /> },        // NEW
  { key: 'icon', label: 'Icons', icon: <ImageIcon /> },
  { key: 'svg', label: 'SVGs', icon: <Code /> },
  { key: 'template', label: 'Templates', icon: <Layers /> },
];
```

#### 3b. Specialized card rendering per category

- **Image cards**: Show thumbnail preview (from `thumbnail` or `content`), label, tags. Click to select for project.
- **Palette cards**: Render color swatches from `content` (JSON array of hex values), palette name, tags.
- **Layout cards**: Show layout name, spec snippet preview, tags.
- **Other cards**: Keep existing text-based rendering.

#### 3c. Enhanced Add dialog

Add category-specific input fields:
- **Image**: File upload button, URL paste input, label input, tags. Store URL/data-URI in `content`, thumbnail in `thumbnail`.
- **Palette**: Color picker with add/remove, palette name. Store as JSON array in `content` with `contentType: 'colors'`.
- **Layout**: JSON spec textarea (reuse existing content textarea), layout name, description.

#### 3d. "Add to Project" action

For image category: Add a button on each image card to add it to `project.images` (calls `onImageAddToProject` callback).

For palette category: Add a button to apply palette to the current project's theme context.

For layout category: Add a button to use as generation starting point.

#### 3e. Props update

Add new props:
```ts
interface StitchLibraryProps {
  // ... existing
  onImageAddToProject?: (image: StitchImageRef) => void;
  onPaletteSelect?: (palette: { name: string; colors: string[] }) => void;
  onLayoutSelect?: (layout: StitchComponent) => void;
  projectImages?: StitchImageRef[];
}
```

### 4. `components/StitchEditor.tsx` — Wire new library features

#### 4a. Pass new props to StitchLibrary
```tsx
<StitchLibrary
  projectType={project.projectType}
  theme={theme}
  onComponentsSelected={setSelectedLibraryComponents}
  onNotification={onNotification}
  onImageAddToProject={handleLibraryImageAdd}    // NEW
  onPaletteSelect={handlePaletteSelect}           // NEW
  onLayoutSelect={handleLayoutSelect}             // NEW
  projectImages={project.images}                  // NEW
/>
```

#### 4b. Add handler for library image → project
```ts
const handleLibraryImageAdd = useCallback((image: StitchImageRef) => {
  const exists = project.images?.some(i => i.url === image.url);
  if (exists) { onNotification?.('Image already in project', 'error'); return; }
  const updated = [...(project.images || []), image];
  handleImagesChange(updated);
  onNotification?.('Image added to project', 'success');
}, [project.images, handleImagesChange, onNotification]);
```

#### 4c. Add handler for palette → AI context
```ts
const handlePaletteSelect = useCallback((palette: { name: string; colors: string[] }) => {
  setSelectedPalette(palette);
}, []);
```

Pass `selectedPalette` into the generation context:
```ts
if (selectedPalette) {
  context.colorPalette = selectedPalette;
}
```

#### 4d. Add handler for layout → generation context
Pass selected layout component as a template reference in the generation context.

### 5. `components/StitchImageManager.tsx` — Add "Save to Library" button

Add a button on each image to save it to the server-side library:
```ts
const handleSaveToLibrary = async (img: StitchImageRef) => {
  await fetch('/api/stitch/components', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: img.label,
      category: 'image',
      contentType: img.url.startsWith('data:') ? 'image-base64' : 'image-url',
      projectType: 'all',
      description: `Image: ${img.label}`,
      tags: ['image', img.label],
      content: img.url,
      thumbnail: img.url.startsWith('data:') ? img.url.substring(0, 200) : img.url,
      isGlobal: true,
    }),
  });
};
```

### 6. `server/data/seedComponents.ts` — Add seed data

Add 3-5 seed palettes:
```ts
{
  name: 'Neon Dark',
  category: 'palette',
  contentType: 'colors',
  projectType: 'all',
  description: 'Dark theme with neon accent colors',
  tags: ['dark', 'neon', 'vibrant'],
  content: JSON.stringify(['#0f0f23', '#6366f1', '#a5b4fc', '#f59e0b', '#10b981']),
}
```

Add 3-5 seed layouts:
```ts
{
  name: 'Hero + CTA',
  category: 'layout',
  contentType: 'json',
  projectType: 'website',
  description: 'Hero section with headline, subtitle, and CTA button',
  tags: ['hero', 'cta', 'landing'],
  content: JSON.stringify({ layout: 'hero', elements: [...] }),
  specSnippet: '{"layout":"hero","elements":[...]}',
}
```

### 7. `server/db/schema.ts` — No changes needed

The `stitch_components` table already uses freeform TEXT for `category` and `content_type`. No schema migration required.

### 8. `server/routes/stitch.ts` — No changes needed

The existing CRUD endpoints (`GET/POST/DELETE /components`, `POST /components/search`) already handle arbitrary categories. No route changes needed.

---

## Generation Context Integration

When library items are selected, they're passed to the AI via `context.componentContext` (already exists at `StitchEditor.tsx:243-248`). The current format:
```
### Name (category)
Description
```contentType
content
```
```

For new categories, the same format works:
- **Image**: `### Hero Photo (image)\nImage URL for hero section\n```image-url\nhttps://...\n````
- **Palette**: `### Neon Dark (palette)\nDark theme palette\n```colors\n["#0f0f23","#6366f1",...]\n````
- **Layout**: `### Hero + CTA (layout)\nHero section layout\n```json\n{"layout":"hero",...}\n````

The AI already receives this context and uses it. No server-side prompt changes needed — the existing component context injection handles all categories uniformly.

For palettes specifically, also pass as structured data:
```ts
if (selectedPalette) {
  context.colorPalette = selectedPalette.colors;
  context.colorPaletteName = selectedPalette.name;
}
```

---

## Implementation Order

1. **Types** (`types/stitchSpec.ts`) — Add new categories
2. **Server type** (`server/services/stitchLibraryService.ts`) — Mirror type changes
3. **Seed data** (`server/data/seedComponents.ts`) — Add palette & layout seeds
4. **StitchLibrary UI** (`components/StitchLibrary.tsx`) — Main UI work
5. **StitchImageManager** (`components/StitchImageManager.tsx`) — Add "Save to Library"
6. **StitchEditor integration** (`components/StitchEditor.tsx`) — Wire callbacks
7. **Build & verify** — `npm run build`

---

## Testing

- [ ] Library shows new categories (Image, Palette, Layout) in tab bar
- [ ] Adding an image via URL stores it in the library and shows thumbnail
- [ ] Adding an image via file upload stores it as base64
- [ ] Adding a palette shows color swatches in the card
- [ ] Adding a layout shows spec preview
- [ ] Selecting an image from library offers "Add to Project" action
- [ ] "Save to Library" button on StitchImageManager items works
- [ ] Selected palette colors appear in generation context
- [ ] Selected layout appears in generation context
- [ ] Search works across all new categories
- [ ] Category filtering works for new types
- [ ] `npm run build` passes
