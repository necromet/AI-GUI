# Plan: Model Selector Enhancements

## Goals
1. Add pay-as-you-go (API Key) variants for TTS, ASR, VoiceClone, and VoiceDesign models
2. Categorize models into "Token Plan" and "API Key" groups in the selector
3. Limit model selector dropdown to 3-5 visible items (scroll), with distinct icons per model type

---

## 1. Add `modelType` field to `ModelConfig` (`types.ts`)

Add an optional `modelType: ModelType` field to `ModelConfig` so we can identify model types without relying on string matching. Update `getModelType()` to check this field first, then fall back to the current string-based logic.

```ts
export interface ModelConfig {
  // ... existing fields
  modelType?: ModelType;  // NEW: explicit type for UI routing
}
```

Update `getModelType` to accept `ModelConfig` or check the field:
- Keep existing string-based fallback for backward compatibility

---

## 2. Add new API Key model entries (`constants.tsx`)

Add 4 new entries to `DEFAULT_MODELS` for the direct/API Key variants of TTS, ASR, VoiceClone, VoiceDesign:

| id | name | provider | modelType |
|----|------|----------|-----------|
| `mimo-v2.5-tts-direct` | MiMo V2.5 TTS (API Key) | `mimo-direct` | `tts` |
| `mimo-v2.5-asr-direct` | MiMo V2.5 ASR (API Key) | `mimo-direct` | `asr` |
| `mimo-v2.5-tts-voiceclone-direct` | MiMo V2.5 TTS VoiceClone (API Key) | `mimo-direct` | `tts-voiceclone` |
| `mimo-v2.5-tts-voicedesign-direct` | MiMo V2.5 TTS VoiceDesign (API Key) | `mimo-direct` | `tts-voicedesign` |

Each will set `apiModelId` to the base model ID (e.g., `mimo-v2.5-tts`) so the API call uses the correct model name.

Also add `modelType` to existing entries (both current token-plan TTS/ASR/voice models and the new direct ones).

---

## 3. Update `getModelType` in `types.ts`

Update the function to also check `ModelConfig.modelType` when available, and also handle the new `-direct` suffixed IDs:

```ts
export function getModelType(modelId: string): ModelType {
  // Handle direct variants
  if (modelId.includes('tts-voicedesign')) return 'tts-voicedesign';
  if (modelId.includes('tts-voiceclone')) return 'tts-voiceclone';
  if (modelId.includes('tts')) return 'tts';
  if (modelId.includes('asr')) return 'asr';
  return 'chat';
}
```

---

## 4. Update panels to use `provider` from selected model

Currently the TTS/ASR/VoiceClone/VoiceDesign panels hardcode the model ID and don't pass `provider`. Update them to accept the current model config and forward `provider`:

- **`TTSPanel.tsx`**: Accept `modelConfig: ModelConfig` prop. Use `modelConfig.id` (or `modelConfig.apiModelId`) for the model param and `modelConfig.provider` for the provider.
- **`ASRPanel.tsx`**: Same pattern.
- **`VoiceClonePanel.tsx`**: Same pattern.
- **`VoiceDesignPanel.tsx`**: Same pattern.

Update `App.tsx` to pass the current model config to each panel.

---

## 5. Redesign `ModelSelect` component (`components/ModelSelect.tsx`)

### 5a. Add icons per model type

Import icons from lucide-react and map model types to icons:
- `chat` → `MessageSquare`
- `tts` → `Volume2`
- `asr` → `Mic`
- `tts-voiceclone` → `Copy`
- `tts-voicedesign` → `Wand2`

### 5b. Group models by provider category

Split models into two groups:
- **Token Plan** (`provider: 'mimo'` or no provider)
- **API Key** (`provider: 'mimo-direct'`)

Render section headers between groups (small uppercase label, not clickable).

### 5c. Max-height scroll (3-5 items)

Set `max-height` on the dropdown to show ~4 items (based on item height ~40px), with `overflow-y: auto`. Use a CSS variable or hardcoded calc.

### 5d. Wider dropdown

Increase width from `w-56` to `w-72` or `w-80` to accommodate category headers and longer names.

---

## Files to modify

| File | Changes |
|------|---------|
| `types.ts` | Add `modelType` to `ModelConfig`, update `getModelType()` |
| `constants.tsx` | Add 4 new direct model entries, add `modelType` to all entries |
| `components/ModelSelect.tsx` | Icons, grouping, max-height scroll |
| `components/TTSPanel.tsx` | Accept `modelConfig` prop, use provider |
| `components/ASRPanel.tsx` | Accept `modelConfig` prop, use provider |
| `components/VoiceClonePanel.tsx` | Accept `modelConfig` prop, use provider |
| `components/VoiceDesignPanel.tsx` | Accept `modelConfig` prop, use provider |
| `App.tsx` | Pass model config to panels |

---

## Verification
- Run `npm run build` to check for TypeScript/build errors
- Verify in browser: model selector shows grouped models with icons, scroll at 4 items
- Switch between token-plan and API Key TTS/ASR models; panels should use correct provider
