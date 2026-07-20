# Plan: Chat Document Attachments (PDF, DOCX, XLSX)

## Goal
Allow users to attach `.pdf`, `.doc/.docx`, and `.xlsx` files in the `/chat` input, extract their text content server-side, and include it as context when sending to the AI model.

## Current State
- **PromptInputBox.tsx**: Only accepts images (`accept="image/*"`, `isImageFile()` guard)
- **Attachment type** (`types.ts`): Stores `data` (base64 data URL), `mimeType`, `name`
- **ChatMessage.tsx**: Renders attachments as `<img>` tags only
- **server/routes/chat.ts**: Sends attachments as `image_url` content parts to the AI API
- **server/routes/rag.ts**: Already parses PDFs via `pdf-parse`; supports txt/md/html/csv/log
- **Packages**: `pdf-parse` installed; no `mammoth` (docx) or `xlsx` (SheetJS)

## Design

### Approach
Parse documents server-side via a new `POST /api/chat/parse-document` endpoint. On the client, when the user sends a message with non-image attachments, upload them to this endpoint first, receive extracted text, then include it in the message content sent to the AI. This keeps the AI message format clean (text-only) while supporting binary file types.

### New npm packages
- `mammoth` — .docx → text extraction (pure JS, no native deps)
- `xlsx` (SheetJS) — .xlsx → text/CSV extraction (pure JS)

---

## Implementation Steps

### 1. Install dependencies
```bash
npm install mammoth xlsx
```

### 2. Server: Add document parsing endpoint
**File: `server/routes/chat.ts`**

Add a new `POST /api/chat/parse-document` route:
- Uses `multer` (already imported) for file upload
- Accepts: `.pdf`, `.doc`, `.docx`, `.xlsx`
- Parses based on extension:
  - `.pdf` → `pdf-parse` (already in rag.ts, reuse same pattern)
  - `.docx` → `mammoth.extractRawText()`
  - `.doc` → return error (binary .doc is unsupported by mammoth; suggest converting to .docx)
  - `.xlsx` → `xlsx.read()` → sheet-to-csv or sheet-to-text
- Returns `{ text: string, filename: string }`
- 20MB file size limit

### 3. Client: Add document parsing service function
**File: `services/apiService.ts`**

Add `parseDocument(file: File): Promise<{ text: string; filename: string }>`:
- Creates a `FormData`, appends the file
- POSTs to `/api/chat/parse-document`
- Returns the extracted text

### 4. Client: Extend PromptInputBox to accept documents
**File: `components/PromptInputBox.tsx`**

Changes:
- Add `isDocumentFile(file)` helper: checks for `.pdf`, `.docx`, `.xlsx` extensions
- Add `isAllowedFile(file)`: returns true if image OR document
- Update `accept` attribute on `<input>`: `"image/*,.pdf,.doc,.docx,.xlsx"`
- Update `processFile`/`processFiles`: accept non-image files, store them in `files` state
- For non-image files: show a document icon + filename badge instead of image preview
- Remove the `isImageFile` filter in `handleDrop` — use `isAllowedFile`
- Update `handlePaste` to also handle non-image clipboard files
- Add a `fileIcons` map: `{ pdf: FileText, docx: FileText, xlsx: Table }` from lucide-react
- The `supportsVision` prop should not block document uploads — separate the image-only restriction from document support

### 5. Client: Parse documents before sending
**File: `App.tsx`**

In `handleSendMessage`:
- After `fileToAttachment` for images, identify non-image files
- Upload non-image files to `parseDocument()` in parallel
- For each parsed document, prepend extracted text to the user message content as:
  ```
  [Document: filename.pdf]
  <extracted text>
  [/Document]
  
  <user's actual message>
  ```
- Store the attachment metadata (name, mimeType) in `attachments` array with a `textContent` field

### 6. Extend Attachment type
**File: `types.ts`**

Add optional `textContent` field to `Attachment`:
```typescript
export interface Attachment {
  data: string;        // base64 data URL (images) or empty string (docs)
  mimeType: string;
  name: string;
  textContent?: string; // extracted text for document attachments
}
```

### 7. Update ChatMessage to render document attachments
**File: `components/ChatMessage.tsx`**

- For image attachments (`mimeType.startsWith('image/')`): render as before (img tag)
- For document attachments: render a file card with icon, filename, and file type badge
- Use `FileText` icon for PDF/DOCX, `Table` icon for XLSX
- Remove the reattach button for document attachments (doesn't make sense to reattach a parsed doc)

### 8. Update server chat completions to handle textContent attachments
**File: `server/routes/chat.ts`**

In the `/completions` route, when building message content:
- If attachment has `textContent`, append it to the text content part instead of sending as `image_url`
- Only send `image_url` for attachments that are actual images (check mimeType)

---

## Files Modified (summary)
| File | Change |
|------|--------|
| `package.json` | Add `mammoth`, `xlsx` |
| `server/routes/chat.ts` | New `/parse-document` route; update completions to handle textContent |
| `services/apiService.ts` | Add `parseDocument()` function |
| `components/PromptInputBox.tsx` | Accept doc files, show file badges, remove image-only restriction |
| `App.tsx` | Parse docs before sending, prepend text to message |
| `types.ts` | Add `textContent?` to `Attachment` |
| `components/ChatMessage.tsx` | Render document attachments as file cards |

## Risks & Considerations
- **Large files**: 20MB limit; large PDFs may produce very long text. Consider truncating extracted text to ~50k chars.
- **.doc (legacy)**: `mammoth` only supports `.docx`, not old `.doc` binary format. We'll show an error for `.doc` files suggesting conversion.
- **Token budget**: Document text added to the message will consume context window tokens. The UI should indicate the total extracted text length.
- **.env.example**: No new env vars needed — parsing is self-contained.
