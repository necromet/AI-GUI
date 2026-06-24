# Plan: Dedicated UI/UX for Voice/Audio Models + AIVoiceInput

## Goal
1. TTS, ASR, Voice Clone, Voice Design models get their own full-page UI, separated from the text chat interface
2. Selecting a non-chat model always creates a new session
3. Integrate the `AIVoiceInput` component for voice input in both voice sessions and text chat

## Files to Create

### 1. `components/AIVoiceInput.tsx` (new)
Adapt the provided AIVoiceInput component:
- Import `Mic` from `lucide-react`, `cn` from `../lib/utils`
- Remove `"use client"` directive (not needed in Vite)
- Same props interface: `onStart`, `onStop`, `visualizerBars`, `demoMode`, `demoInterval`, `className`
- Same visual: mic button, spinning square when active, timer, visualizer bars, "Listening..." / "Click to speak" label

## Files to Modify

### 2. `App.tsx` — Auto-new-chat on model switch + full-page panel rendering

**Auto new-chat on non-chat model selection:**
- Create `handleSelectModel(id)` that wraps `setCurrentModelId`:
  - If the new model's `getModelType(id)` is NOT `'chat'`, call `handleNewChat()` first
  - Then set `currentModelId`
- Pass `handleSelectModel` to `ModelSelect` instead of `setCurrentModelId`

**Full-page panel rendering (replace scroll area content):**
- For non-chat `modelType`, render a dedicated full-page centered panel in the scroll area instead of chat messages:
  - `tts` → `<TTSPanel>` (full-page version)
  - `asr` → `<ASRPanel>` (full-page version with AIVoiceInput)
  - `tts-voiceclone` → `<VoiceClonePanel>` (full-page version)
  - `tts-voicedesign` → `<VoiceDesignPanel>` (full-page version)
- These panels replace BOTH the message area and the bottom input area — they get the full `flex-1` space
- Remove the bottom-bar panel rendering for non-chat models (lines 720-767 in current App.tsx)
- Keep the "MiMo can make mistakes" footer only for chat mode

**Rendering structure change:**
```
{modelType === 'chat' ? (
  <>
    {/* messages area */}
    {/* bottom PromptInputBox */}
  </>
) : (
  <div className="flex-1 flex items-center justify-center p-6">
    {/* full-page dedicated panel */}
  </div>
)}
```

### 3. `components/TTSPanel.tsx` — Full-page redesign
Redesign as a full-page centered panel:
- Header with Volume2 icon + "Text-to-Speech" title + model name
- Large textarea for text input
- Voice dropdown + Style input side by side
- Neon-styled Generate Speech button
- Audio player for output
- Props: same interface, no changes needed to props

### 4. `components/ASRPanel.tsx` — Full-page redesign + AIVoiceInput
Redesign as a full-page centered panel:
- Header with FileText icon + "Speech Recognition" title
- **Two input modes** (tab toggle):
  - **Upload**: drag-drop audio file upload (existing)
  - **Record**: `AIVoiceInput` component for live recording
- Transcription result displayed in a styled box
- Copy button for transcription text
- Import and use `AIVoiceInput` for the record mode

### 5. `components/VoiceClonePanel.tsx` — Full-page redesign
Redesign as a full-page centered panel:
- Header with Mic icon + "Voice Clone" title
- Reference voice upload section (drag-drop, existing)
- Textarea for text to synthesize
- Style input (optional)
- Generate button
- Audio player for cloned output

### 6. `components/VoiceDesignPanel.tsx` — Full-page redesign
Redesign as a full-page centered panel:
- Header with Wand2 icon + "Voice Design" title
- Voice description input (required)
- Textarea for text to synthesize
- Generate button
- Audio player for output

### 7. `components/PromptInputBox.tsx` — Replace VoiceRecorder with AIVoiceInput
- Import `AIVoiceInput` from `./AIVoiceInput`
- Replace the `<VoiceRecorder>` component (lines 135-193) usage at line 565 with `<AIVoiceInput>`
- Keep the existing `handleStartRecording` / `handleStopRecording` logic in PromptInputBox
- Wire `AIVoiceInput.onStart` → `handleStartRecording`, `AIVoiceInput.onStop` → `handleStopRecording`
- Remove the old `VoiceRecorder` component definition (lines 129-193) — it's replaced by AIVoiceInput

## Implementation Order
1. Create `components/AIVoiceInput.tsx`
2. Update `components/PromptInputBox.tsx` (replace VoiceRecorder with AIVoiceInput)
3. Redesign `components/TTSPanel.tsx` (full-page)
4. Redesign `components/ASRPanel.tsx` (full-page + AIVoiceInput)
5. Redesign `components/VoiceClonePanel.tsx` (full-page)
6. Redesign `components/VoiceDesignPanel.tsx` (full-page)
7. Update `App.tsx` (auto-new-chat + full-page rendering logic)

## UI Design Notes
- Full-page panels use the same neon theme (`var(--neon-color)`, `var(--neon-rgb)`)
- Centered layout with `max-w-2xl` for form content
- Same rounded-xl inputs, same button styling as existing panels
- Panels should feel like standalone tools, not embedded widgets
- The header bar (model selector, sidebar toggle) remains visible above
