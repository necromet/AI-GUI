# Plan: Stitch Image Vision Analysis Before HTML Generation

## Problem

When generating HTML for IG carousels (or any Stitch design) with image references, the model returns empty responses (0 length, 0 tool calls). Root cause: images are passed as **text URLs** in the system prompt — the model can't "see" them and has no visual context to generate meaningful HTML from.

Current flow:
```
Image URLs → text bullet list in system prompt → model tries to generate HTML blindly → empty response
```

## Solution

Add a **vision pre-analysis step**: before generating HTML, send the reference images to the model as multimodal `image_url` content parts so it can "see" and describe them. Inject the resulting visual analysis into the system prompt so the `generate_html` tool has rich context.

New flow:
```
Image URLs → fetch as base64 → vision analysis call → text description → injected into system prompt → model generates HTML with full visual context
```

## Changes

### 1. `server/services/agentService.ts` — Add `analyzeImages()` function

- New exported async function `analyzeImages(images, model?, provider?): Promise<string>`
- For each image:
  - If `url` starts with `data:` → use directly as base64
  - If `url` is an external URL → fetch it, convert to base64 data URI
- Send a single multimodal `chatCompletion` call with all images as `image_url` content parts
- System prompt: "Describe these images in detail for use in an HTML design. Focus on: colors, composition, subjects, text, style, mood, layout elements."
- Return the combined analysis text
- Wrap in try/catch — if analysis fails, return empty string (graceful degradation)

### 2. `server/routes/agent.ts` — Pre-analyze images before agent loop

- After building `apiMessages` but before entering the streaming/iteration loop:
  - If `context.images` exists and has items, call `analyzeImages(context.images, model, provider)`
  - Store result in `context.imageAnalysis` (so tools can access it)
  - Emit a streaming status event: `{ status: "Analyzing reference images..." }` so the UI shows progress

### 3. `server/services/agentService.ts` — Update `buildStitchSystemPrompt()`

- When `context.imageAnalysis` is present, include it in the image prompt section:
  ```
  Available images:
  - "label" → url

  Image Analysis (from vision):
  <analysis text>

  Rules: Use <img> tags with provided URLs. Use object-fit: cover. Match the visual style described above.
  ```

### 4. `server/services/agentService.ts` — Update `toolGenerateHtml()`

- Accept `imageAnalysis` parameter
- When present, append to the system prompt after the image URLs:
  ```
  Image Analysis: <analysis>
  Use this analysis to inform your design choices (colors, layout, typography).
  ```

### 5. `server/routes/stitch.ts` — Pre-analyze for direct generate-html route

- Same pre-analysis logic for the `/generate-html` route (non-agent path)
- Before building the system prompt, analyze images if present
- Inject analysis into the prompt

### 6. `server/services/agentService.ts` — Update `executeTool()` pass-through

- Pass `context.imageAnalysis` through to `toolGenerateHtml()`

## Files Modified

| File | Change |
|------|--------|
| `server/services/agentService.ts` | Add `analyzeImages()`, update `buildStitchSystemPrompt()`, update `toolGenerateHtml()`, update `executeTool()` |
| `server/routes/agent.ts` | Pre-analyze images before agent loop, emit status event |
| `server/routes/stitch.ts` | Pre-analyze images before HTML generation |

## Edge Cases

- **No images**: Skip analysis entirely (no change in behavior)
- **Analysis fails**: Graceful fallback — `imageAnalysis` is empty string, existing text-URL prompt still works
- **Large base64 images**: The fetch-to-base64 conversion handles this; analysis prompt limits detail to key design-relevant observations
- **External URLs that fail to fetch**: Skip that image in analysis, continue with others
- **Mixed base64 + external URLs**: Both handled by the same logic

## Testing

1. Create an IG carousel project with 2-3 image references (mix of URLs and uploaded files)
2. Generate slide 1 — verify the model produces HTML that uses the images meaningfully
3. Generate slide 2 — verify reference consistency from slide 1 + image analysis
4. Check server logs for `[image-analysis]` entries showing successful analysis
5. Test with no images — verify no regression
6. Test with broken image URLs — verify graceful fallback
