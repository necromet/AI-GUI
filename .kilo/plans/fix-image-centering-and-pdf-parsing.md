# Fix: Image View Centering + PDF Parsing

## Issue 1: Image view not centered on screen in /chat

**Root cause:** Both image preview dialogs (`PromptInputBox.tsx:17` and `ChatMessage.tsx:215`) use the shadcn `DialogContent` which inherits `grid w-full` from the base class. The `w-full` makes the dialog always stretch to `max-w-[90vw]` (viewport-wide), and `grid` without `place-items-center` causes the image to stretch to fill the grid cell. The dialog container itself is positioned correctly via `left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]`, but the image inside is stretched across the full 90vw grid cell rather than being tightly sized and centered.

### Fix

**File: `components/PromptInputBox.tsx` (lines 17-35)** — `ImageViewDialog`
- Add `place-items-center` to `DialogContent` className so the grid centers its child instead of stretching it.

**File: `components/ChatMessage.tsx` (lines 215-220)** — Image attachment preview dialog
- Add `place-items-center` to `DialogContent` className for the same reason.

Both changes are single-class additions on the existing `DialogContent` className string.

---

## Issue 2: PDF parsing broken — `pdf-parse` v2 API mismatch

**Root cause:** `pdf-parse` v2.4.5 is installed in `node_modules` and the code dynamically imports it. However, `pdf-parse` v2.x has a completely different API from v1.x:

- **v1 API** (what the code expects): `const data = await pdfParse(buffer)` → `{ text: string }`
- **v2 API** (what's installed): Class-based — `new PDFParse({ data: buffer })` then `.getText()` → `TextResult` with `.text`

The code in `server/routes/chat.ts:220-221` and `server/routes/rag.ts:29-30` uses the old v1 calling pattern, which will fail at runtime because `pdf-parse` v2 does not export a default callable function.

### Fix

**File: `server/routes/chat.ts` (lines 218-226)** — `/api/chat/parse-document` route

Replace:
```ts
const pdfParse = (await import('pdf-parse')).default;
const data = await pdfParse(file.buffer);
content = data.text;
```

With:
```ts
const { PDFParse } = await import('pdf-parse');
const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
const textResult = await parser.getText();
content = textResult.text;
await parser.destroy();
```

**File: `server/routes/rag.ts` (lines 27-35)** — `/api/rag/documents` route

Same replacement pattern as above.

**Key details:**
- `file.buffer` is a Node.js `Buffer`; `PDFParse` accepts `Uint8Array`/`ArrayBuffer`, so wrap with `new Uint8Array(file.buffer)`
- Call `parser.destroy()` after use to clean up the internal PDF.js document
- `getText()` returns a `TextResult` with a `.text` property (concatenated page text)

---

## Verification

Run `npm run build` (the only build/verification command available) to confirm no compile errors. Manual testing:
1. Start dev server (`npm run dev:all`)
2. Upload a PDF in chat — should parse and attach text content
3. Upload a PDF in RAG — should parse and add document
4. Click an image thumbnail in chat — dialog should appear centered on screen
5. Click an image attachment in a message — dialog should appear centered on screen
