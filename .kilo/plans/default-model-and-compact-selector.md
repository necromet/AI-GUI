# Plan: Default Model Setting + Compact Model Selector

## Context

The app has no way to persist a default model — `currentModelId` always initializes to `DEFAULT_MODELS[0].id` (`mimo-v2.5`). The model selector dropdown is too large (w-80, icon blocks, full descriptions). The user wants:

1. A way to set and persist a default model across sessions
2. A more compact model selector

## Changes

### 1. Add "Default Model" setting to Settings (`components/Settings.tsx`)

In the **General** tab, add a new section above "Output Token Limit":

- Section header: "Default Model"
- A `<select>` dropdown listing all available models (id + name)
- A "Set Default" button that saves the selected model ID to `localStorage` under key `edward:labs_defaultModel`
- Show current default model name in the UI
- Accept new props: `defaultModelId: string`, `onChangeDefaultModel: (id: string) => void`

### 2. Wire up default model in `App.tsx`

- Add `defaultModelId` state, initialized from `localStorage.getItem('edward:labs_defaultModel')` (fallback to `DEFAULT_MODELS[0].id`)
- Change `currentModelId` init: `useState<string>(() => localStorage.getItem('edward:labs_defaultModel') || DEFAULT_MODELS[0].id)`
- Pass `defaultModelId` and `onChangeDefaultModel` to `<Settings>`
- `onChangeDefaultModel` saves to localStorage **and immediately switches `currentModelId`** to the new default

### 3. Make `ModelSelect` more compact (`components/ModelSelect.tsx`)

- Reduce dropdown width from `w-80` → `w-56` (224px)
- Remove description text from dropdown items (show only model name + custom badge)
- Reduce padding: `py-3` → `py-2`, `px-4` → `px-3`
- Reduce icon container from `w-8 h-8` → `w-6 h-6`
- Trigger button: `text-lg font-semibold` → `text-sm font-medium`, reduce padding
- Keep active indicator dot and hover effects (just smaller)

## Files Modified

| File | Action |
|------|--------|
| `components/Settings.tsx` | Add default model selector in General tab |
| `App.tsx` | Init `currentModelId` from localStorage, pass default model props to Settings |
| `components/ModelSelect.tsx` | Compact styling (smaller dropdown, no descriptions, reduced padding) |

## Verification

1. `npm run dev` → app loads with default model
2. Open Settings → General → see "Default Model" section with dropdown
3. Select a different model → saved to localStorage, current model switches immediately
4. Refresh page → app starts with the saved default model
5. Model selector in header is visually compact — small button, narrow dropdown, no descriptions
