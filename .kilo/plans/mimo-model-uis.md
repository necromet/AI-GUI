# Plan: MiMo Model UIs + Remove Gemini Buttons

## Context

The app currently only has a chat interface. The user wants dedicated UIs for the 6 MiMo models (chat, TTS, VoiceDesign, VoiceClone, ASR) and wants the "Ground with Google Search" and "Generate Image Mode" buttons removed.

## Key API Findings

All MiMo TTS models use `POST /v1/chat/completions` with an `audio` parameter:
- Text to speak → `assistant` role message
- Style/instructions → `user` role message (optional for TTS, required for VoiceDesign)
- Built-in voices for TTS: `mimo_default`, `default_zh`, `default_en`, `Mia`, `Chloe`, `Milo`, `Dean`
- VoiceDesign: no preset voice, generates from text description
- VoiceClone: needs audio sample upload
- ASR: speech-to-text (audio upload → text)

## Changes

### 1. Remove Gemini-specific UI components

**Delete files:**
- `components/GroundingOptions.tsx`
- `components/ImageGenerationOptions.tsx`

**App.tsx cleanup:**
- Remove imports for `ImageGenerationOptions`, `GroundingOptions`
- Remove `imageGenOptions`, `groundingOptions` state
- Remove `handleImageGenOptionsChange` handler
- Remove `<ImageGenerationOptions>` and `<GroundingOptions>` from JSX
- Remove image gen status handling from streaming loop
- Remove grounding metadata handling from streaming loop
- Remove unused `previousModelId` state
- Remove `fileToBase64` helper (no longer needed without image gen)
- Clean up `imageParts` logic in `handleSendMessage`
- Remove `window.electron?.saveGeneratedImage` calls

### 2. Add model type helper

Add to `types.ts`:
```ts
export type ModelType = 'chat' | 'tts' | 'tts-voicedesign' | 'tts-voiceclone' | 'asr';

export function getModelType(modelId: string): ModelType {
  if (modelId === 'mimo-v2.5-tts') return 'tts';
  if (modelId === 'mimo-v2.5-tts-voicedesign') return 'tts-voicedesign';
  if (modelId === 'mimo-v2.5-tts-voiceclone') return 'tts-voiceclone';
  if (modelId === 'mimo-v2.5-asr') return 'asr';
  return 'chat';
}
```

### 3. Create new UI components

**`components/TTSPanel.tsx`** — For `mimo-v2.5-tts`
- Text input (textarea) for the text to synthesize
- Voice selector dropdown (built-in voices)
- Optional style instruction input
- "Generate Speech" button
- Audio player (`<audio>`) for playback
- Calls `generateSpeech()` from mimoService

**`components/VoiceDesignPanel.tsx`** — For `mimo-v2.5-tts-voicedesign`
- Text input for voice description (user message, required)
- Text input for text to synthesize (assistant message)
- "Generate Speech" button
- Audio player for playback

**`components/VoiceClonePanel.tsx`** — For `mimo-v2.5-tts-voiceclone`
- Audio file upload (reference voice sample)
- Text input for text to synthesize
- Optional style instruction
- "Generate Speech" button
- Audio player for playback

**`components/ASRPanel.tsx`** — For `mimo-v2.5-asr`
- Audio file upload
- "Transcribe" button
- Text display area for transcription result

### 4. Add TTS/ASR service functions

**`services/mimoService.ts`** — add:

```ts
// TTS: returns audio blob URL
export async function generateSpeech(params: {
  model: string;
  text: string;
  voice?: string;
  style?: string;
}): Promise<string>

// ASR: returns transcribed text
export async function transcribeAudio(params: {
  model: string;
  audioFile: File;
}): Promise<string>
```

TTS request body:
```json
{
  "model": "mimo-v2.5-tts",
  "messages": [
    {"role": "user", "content": "<style instruction>"},
    {"role": "assistant", "content": "<text to speak>"}
  ],
  "audio": {"voice": "mimo_default", "format": "mp3"}
}
```

ASR: Uses `POST /v1/audio/transcriptions` with multipart form data (OpenAI-compatible).

### 5. Update App.tsx input area

The bottom input area switches based on `getModelType(currentModelId)`:
- **chat**: Show existing textarea + send button (as-is)
- **tts / tts-voicedesign / tts-voiceclone**: Show `<TTSPanel>` / `<VoiceDesignPanel>` / `<VoiceClonePanel>` instead of the textarea
- **asr**: Show `<ASRPanel>` instead of the textarea

The chat area still shows messages for chat models. For TTS/ASR models, the chat area shows a history of generated audio/transcriptions.

### 6. Update constants.tsx model descriptions

Make descriptions more specific for each model.

## Files Modified

| File | Action |
|------|--------|
| `types.ts` | Add `ModelType`, `getModelType()` |
| `constants.tsx` | Update descriptions |
| `App.tsx` | Remove Gemini UI, add model-type switching |
| `services/mimoService.ts` | Add `generateSpeech()`, `transcribeAudio()` |
| `components/TTSPanel.tsx` | **Create** |
| `components/VoiceDesignPanel.tsx` | **Create** |
| `components/VoiceClonePanel.tsx` | **Create** |
| `components/ASRPanel.tsx` | **Create** |
| `components/GroundingOptions.tsx` | **Delete** |
| `components/ImageGenerationOptions.tsx` | **Delete** |

## Verification

1. `npm run dev` → opens on localhost
2. Select "MiMo V2.5" or "MiMo V2.5 Pro" → chat interface works as before
3. Select "MiMo V2.5 TTS" → TTS panel appears, generate speech plays audio
4. Select "MiMo V2.5 TTS VoiceDesign" → voice description + text → generates audio
5. Select "MiMo V2.5 TTS VoiceClone" → upload audio + text → generates cloned audio
6. Select "MiMo V2.5 ASR" → upload audio → shows transcription
7. "Ground with Google Search" and "Generate Image Mode" buttons are gone
