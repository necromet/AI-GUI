# Remove Instagram Carousel & Story/Reel from Skema

## Goal
Remove the `ig-carousel` and `ig-story` project types from the Skema feature, leaving only the `canvas` project type.

## Files to Modify

### 1. `types.ts` (line 140)
- Change `SkemaProjectType` from `'canvas' | 'ig-carousel' | 'ig-story'` to just `'canvas'`

### 2. `components/SkemaPanel.tsx`
- **Lines 37-38**: Remove the two IG entries from `PROJECT_TYPES` array (keep only `canvas`)
- **Lines 83-93**: Remove the `ig-carousel` multi-board creation branch in `handleCreateProject`; simplify the else branch to remove the `ig-story` title override
- **Lines 341-399**: Remove the `ig-carousel` slide count UI and the `ig-story` layout badge + create button sections
- **Lines 488-505**: Remove the IG-specific badges ("X slides", "Story") in the project card grid
- **Imports**: Remove unused `Images` and `Smartphone` icon imports if they become unused

### 3. `components/SkemaEditor.tsx`
- **Lines 52-54**: Remove `isCarousel`, `isIgContent`, `isIgStory` variables
- **Lines 58-63**: Remove IG-specific `designSpec` initialization logic
- **Lines 110-113**: Remove IG-specific board-switch `designSpec` restore
- **Lines 253, 267, 276-278, 284**: Simplify prompt construction — remove IG spec-based prompt branches
- **Lines 317, 405, 415, 424**: Remove IG-specific generation logic (spec generation, multi-slide spec handling)
- **Lines 567-593**: Remove `addSlide`/`removeSlide` functions (carousel-only)
- **Lines 639-670**: Remove carousel multi-slide spec application logic
- **Lines 809+**: Remove carousel slide tab bar UI
- **Lines 931-950**: Remove IG-specific placeholder/generating text
- **Lines 1006-1010**: Remove IG-specific agent sidebar props (`currentSpec`, `onSpecGenerated`)
- Clean up any now-unused state: `designSpec`, `activeBoardIdx` (if only used for carousels), etc.

### 4. `components/SkemaExportModal.tsx`
- **Line 23**: Remove `isIgContent` variable
- **Lines 175, 180+**: Remove IG-specific export UI branch; keep only the HTML export path

## Approach
1. Start with `types.ts` to narrow the type
2. Clean up `SkemaPanel.tsx` (project creation UI)
3. Clean up `SkemaEditor.tsx` (the largest change — remove all IG branching logic)
4. Clean up `SkemaExportModal.tsx`
5. Run `npm run build` to verify no errors
