# Chat Input Redesign Plan

## Goal
Replace the current plain textarea chat input in `App.tsx` with a modern `PromptInputBox` component featuring Search (web search), Think (deep thinking), and Attachment (image upload) toggles, with neon theming and dark/light mode support. Wire Search and Think to actual MiMo API features.

## Current State
- Chat input is a raw `<textarea>` at `App.tsx:627-717` with send/stop button
- No toggle features, no tooltips, no file attachment, no voice recording in chat input
- Neon theming via CSS variables `--neon-rgb` and `--neon-color`
- Tailwind CDN-only (config in `index.html:12-97`)
- No `framer-motion` or `@radix-ui` packages
- Has `clsx` + `tailwind-merge`, `lucide-react`
- `mimoService.ts:36-82` — `parseSSEStream` already reads `reasoning_content` from stream deltas
- `mimoService.ts:84-156` — `generateResponseStream` constructs request body but doesn't pass `tools` or `thinking` params

## Dependencies to Install
```bash
npm install framer-motion @radix-ui/react-tooltip @radix-ui/react-dialog
```

## MiMo API Integration

### Web Search (toggle: Search / Globe icon)
From [MiMo docs](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/text-generation/tool-calling/web-search):
- Add to request body:
  ```json
  "tools": [{
    "type": "web_search",
    "max_keyword": 3,
    "force_search": true
  }]
  ```
- Response `message.annotations` contains URL citations to display
- Supported models: `mimo-v2.5-pro`, `mimo-v2.5`, `mimo-v2-pro`, `mimo-v2-omni`, `mimo-v2-flash`

### Deep Thinking (toggle: Think / BrainCog icon)
From [MiMo docs](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/text-generation/deep-thinking):
- Add to request body:
  ```json
  "thinking": { "type": "enabled" }
  ```
- Streaming: `delta.reasoning_content` arrives before `delta.content` (already parsed in `parseSSEStream`)
- App already renders `thinkingContent` in `ChatMessage.tsx`
- Supported models: `mimo-v2.5-pro`, `mimo-v2.5`, `mimo-v2-pro`, `mimo-v2-omni`, `mimo-v2-flash`

## Files to Create/Modify

### 1. Create `components/PromptInputBox.tsx`
New component with adapted subcomponents from the reference:

**Subcomponents:**
- `Textarea` — auto-resizing, themed for dark/light
- `TooltipProvider/Tooltip/TooltipTrigger/TooltipContent` — Radix Tooltip wrappers
- `Dialog/DialogContent/DialogTitle` — Radix Dialog for image preview
- `Button` — variant/size based button
- `VoiceRecorder` — audio visualizer with timer, records via MediaRecorder API
- `ImageViewDialog` — full-size image preview modal
- `PromptInput` — context provider, rounded container with border/shadow
- `PromptInputTextarea` — auto-resize textarea with Enter-to-submit
- `PromptInputActions` — action bar layout
- `PromptInputAction` — tooltip-wrapped action button
- `PromptInputBox` — main exported component

**PromptInputBox props:**
```ts
interface PromptInputBoxProps {
  onSend: (message: string, options?: { files?: File[]; search?: boolean; think?: boolean }) => void;
  isLoading: boolean;
  onStop?: () => void;
  placeholder?: string;
  theme: 'dark' | 'light';
  neonColor?: string;
  className?: string;
}
```

**Theming adjustments from reference:**
- Replace hardcoded `#1F2023`, `#444444`, `#333333` with dark/light variants using Tailwind `dark:` prefix
- Send button: use `var(--neon-color)` when active (matching existing `App.tsx:661-664`)
- Focus border glow: `rgba(var(--neon-rgb), 0.3)` (matching existing `App.tsx:632`)
- Container background: match existing glass style (`App.tsx:629-634`)

**Feature buttons (left side of action bar):**
1. **Paperclip** — image upload, shows thumbnail preview with remove button
2. **Globe** — Search toggle (cyan `#1EAEDB` when active)
3. **BrainCog** — Think toggle (purple `#8B5CF6` when active)
4. **CustomDivider** — gradient separator between toggle groups

**Right side:**
- **Send/Stop/Mic** button — contextual based on state

**Voice recording:**
- Uses `MediaRecorder` API to capture audio
- On stop, creates a `File` from the recording blob
- Calls `onSend` with the audio file (or a flag for ASR processing)

### 2. Modify `services/mimoService.ts`
Update `generateResponseStream` signature and body construction:

```ts
export const generateResponseStream = async (
  modelId: string,
  prompt: string,
  history: { role: string; content: string }[],
  systemInstruction?: string,
  provider?: string,
  retries = 3,
  maxTokens?: number,
  signal?: AbortSignal,
  options?: { search?: boolean; think?: boolean },  // NEW
)
```

Body construction additions:
```ts
if (options?.search) {
  body.tools = [{ type: "web_search", max_keyword: 3, force_search: true }];
}
if (options?.think !== undefined) {
  body.thinking = { type: options.think ? "enabled" : "disabled" };
}
```

Update `parseSSEStream` to also extract `annotations` from the final chunk for search citations.

### 3. Modify `App.tsx`
- Import `PromptInputBox`
- Replace input area block (lines ~624-724) with `<PromptInputBox>` for `modelType === 'chat'`
- Keep TTS/ASR/VoiceDesign/VoiceClone panels as-is (separate model types)
- Add state: `const [searchEnabled, setSearchEnabled] = useState(false)` and `const [thinkEnabled, setThinkEnabled] = useState(false)`
- Update `handleSendMessage` → `handlePromptSend(message, options)`:
  - Pass `options.search` and `options.think` to `generateResponseStream`
  - Handle file attachments (image files for future multimodal)
- Remove unused `textareaRef` and `handleInputResize`
- Remove the duplicate textarea blocks (chat vs fallback are identical currently)

### 4. Modify `types.ts` (optional)
Add search annotations type:
```ts
export interface SearchAnnotation {
  type: 'url_citation';
  url: string;
  title: string;
  summary: string;
  site_name: string;
  publish_time: string;
  logo_url?: string;
}
```

Extend `Message` interface:
```ts
export interface Message {
  // ...existing fields
  annotations?: SearchAnnotation[];
}
```

### 5. Modify `components/ChatMessage.tsx`
If search is enabled and message has `annotations`, render citation cards below the message content showing source URLs with titles and site names.

## Implementation Order
1. Install dependencies
2. Update `types.ts` with `SearchAnnotation` and extend `Message`
3. Update `services/mimoService.ts` — add `options` param, extract annotations
4. Create `components/PromptInputBox.tsx`
5. Integrate into `App.tsx` — replace input area, wire handlers
6. Update `components/ChatMessage.tsx` — render search citations
7. `npm run build` to verify
