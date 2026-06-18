# Plan: Add Xiaomi MiMo Provider Alongside Google Gemini

## Context

The app currently only supports Google Gemini via `@google/genai` SDK. The user wants to add Xiaomi MiMo (`mimo-v2.5-pro`) as a second provider using its OpenAI-compatible API (`https://token-plan-sgp.xiaomimimo.com/v1`). Both providers should be available as default models with automatic routing based on the model's `provider` field.

## Changes

### 1. Update `.env` — Add MiMo credentials

Add `MIMO_API_KEY` and `MIMO_BASE_URL` alongside the existing `GEMINI_API_KEY`.

```env
GEMINI_API_KEY=your-gemini-api-key-here
MIMO_API_KEY=your-mimo-api-key-here
MIMO_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1
```

### 2. Update `.env.example` — Document new vars

```
GEMINI_API_KEY='YOUR-GEMINI-API-KEY'
MIMO_API_KEY='YOUR-MIMO-API-KEY'
MIMO_BASE_URL='https://token-plan-sgp.xiaomimimo.com/v1'
```

### 3. Update `vite.config.ts` — Expose MiMo env vars to renderer

Add to the `define` block:

```ts
'process.env.MIMO_API_KEY': JSON.stringify(env.MIMO_API_KEY),
'process.env.MIMO_BASE_URL': JSON.stringify(env.MIMO_BASE_URL),
```

### 4. Create `services/mimoService.ts` — MiMo API service

Uses native `fetch` to call the OpenAI-compatible `/v1/chat/completions` endpoint with streaming (`stream: true`). Parses SSE chunks. Returns an async generator that yields `{ text: string }` chunks — matching the interface the App.tsx streaming loop expects.

Key functions:
- `generateResponseStream(modelId, prompt, history, systemInstruction?)` — async generator yielding text chunks
- `generateChatTitle(userMessage, assistantResponse)` — non-streaming title generation

Uses `process.env.MIMO_API_KEY` and `process.env.MIMO_BASE_URL` injected by Vite.

### 5. Update `types.ts` — Add MiMo enum & provider field usage

- Add a `MiMoModel` enum: `{ V2Pro = 'mimo-v2.5-pro' }`
- The `ModelConfig.provider` field already exists — will use `'gemini'` and `'mimo'` as values.

### 6. Update `constants.tsx` — Add MiMo default model

Add to `DEFAULT_MODELS` array:

```ts
{
  id: MiMoModel.V2Pro,
  name: "MiMo V2.5 Pro",
  description: "Xiaomi's reasoning model via OpenAI-compatible API",
  isReasoning: true,
  contextWindowSize: 32768,
  provider: 'mimo',
}
```

Also set `provider: 'gemini'` on the existing Gemini models for explicit routing.

### 7. Update `App.tsx` — Provider routing in `handleSendMessage` and `handleRegenerate`

Import `generateResponseStream as generateMiMoResponseStream` from `mimoService`.

In `handleSendMessage` (and `handleRegenerate`), before calling the stream function, check `selectedModelConfig.provider`:
- If `provider === 'mimo'` → call `generateMiMoResponseStream()`
- Otherwise (default) → call existing `generateResponseStream()` (Gemini)

Similarly update `generateChatTitle` import logic to route to the MiMo title generator when the current model is a MiMo model.

### 8. Update `ModelSelect.tsx` — MiMo model icon

Add a case in `getModelIcon` for MiMo models (e.g., use a distinct icon or a generic one).

## Files Modified

| File | Action |
|------|--------|
| `.env` | Edit — add MiMo vars |
| `.env.example` | Edit — add MiMo vars |
| `vite.config.ts` | Edit — define MiMo env vars |
| `services/mimoService.ts` | **Create** — new service |
| `types.ts` | Edit — add `MiMoModel` enum |
| `constants.tsx` | Edit — add MiMo default model, set providers |
| `App.tsx` | Edit — provider routing logic |
| `components/ModelSelect.tsx` | Edit — add MiMo icon |

## Verification

1. Run `npm run dev` (or `npm run electron:dev`)
2. Verify MiMo V2.5 Pro appears in the model selector dropdown
3. Select MiMo V2.5 Pro, send a message — confirm streaming response works
4. Switch back to a Gemini model, send a message — confirm Gemini still works
5. Verify chat title generation works for both providers
