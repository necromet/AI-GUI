# Library Agent: Tool Call Streaming Fix

## Problem

When the library agent calls a tool (e.g. `write_component_file`), the raw JSON tool call block is visible in the chat as streamed text:

```
<tool_call> {"name": "write_component_file", "arguments": {"componentId": "...", ...}} 
```

The user sees this raw syntax in the message bubble *before* the structured tool call card appears. This is ugly and confusing.

## Root Cause

The server accumulates the full AI response before checking for tool calls. It sends the **entire response** (including raw tool call syntax) as a single `content` SSE event. The client receives it and renders it as markdown, which includes the raw `<tool_call>` or ````tool` blocks.

**Server flow** (`server/routes/library.ts:659-693`):
1. Stream from MiMo, accumulate `fullResponse`
2. After stream ends → `parseToolCalls(fullResponse)`
3. If tool calls found → split text at first tool block marker
4. Send `preToolText` as `content` event (but this includes the tool call syntax if the AI started with a tool call)
5. Send `tool_call` event separately

**Client flow** (`components/library/AgentSidebar.tsx:620-668`):
1. Receives `content` chunks during streaming
2. Appends to `fullText` and renders immediately via `extractToolBlocks()`
3. `extractToolBlocks()` regex-replaces ````tool` blocks with placeholder, but:
   - During streaming, partial tool blocks are visible before they're fully received
   - The regex only matches complete ````tool...``` ` blocks
   - `<tool_call>` XML format is NOT handled by `extractToolBlocks()`

## Key Issues

1. **Server sends content AFTER stream ends** — not during streaming. So there's no "progressive text" issue; the entire text arrives at once.
2. **The `content` event includes raw tool call syntax** — because the server sends `preToolText` which is everything before the first tool block marker, but if the AI's response starts with a tool call, the pre-tool text is empty yet the full response (including tool call) may still get sent.
3. **`extractToolBlocks()` only handles ````tool` and ````json` blocks** — not `<tool_call>` XML format.
4. **The tool call JSON is shown as rendered markdown** — the raw JSON gets syntax-highlighted and displayed as a code block.

## Two Fix Approaches

### Option A: Server-Side (recommended)

**Strip tool call syntax from content before sending to client.**

In `server/routes/library.ts`, after parsing tool calls:

```typescript
// Current (broken):
if (preToolText) {
  res.write(`data: ${JSON.stringify({ content: preToolText })}\n\n`);
}

// Fix: Also strip tool call blocks from the content sent to client
let cleanContent = fullResponse;
// Remove ```tool blocks
cleanContent = cleanContent.replace(/```tool\s*\n?[\s\S]*?```/g, '');
// Remove ```json blocks that are tool calls
cleanContent = cleanContent.replace(/```json\s*\n?(\{[\s\S]*?"name"[\s\S]*?"arguments"[\s\S]*?\})\s*```/g, '');
// Remove <tool_call> XML blocks
cleanContent = cleanContent.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '');
cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n').trim();

if (cleanContent) {
  res.write(`data: ${JSON.stringify({ content: cleanContent })}\n\n`);
}
```

**Pros**: Clean client, no raw tool syntax ever reaches the UI
**Cons**: Server needs to be updated; if regex misses a format, syntax leaks through

### Option B: Client-Side

**Buffer streamed text and only render after tool blocks are extracted.**

In `components/library/AgentSidebar.tsx`, modify the streaming handler to:
1. Accumulate `fullText` during streaming (already done)
2. Only update the displayed message *content* after stripping tool blocks
3. Extend `extractToolBlocks()` to also handle `<tool_call>` XML format

```typescript
// In the content handler:
if (parsed.content) {
  fullText += parsed.content;
  const { cleanText, toolBlocks } = extractToolBlocks(fullText);
  // Only show cleanText, not fullText
  setMessages(prev => prev.map(m => {
    if (m.id !== aiMsgId) return m;
    const blocks = m.blocks ? [...m.blocks] : [];
    const lastBlock = blocks[blocks.length - 1];
    if (lastBlock && lastBlock.type === 'text') {
      lastBlock.content = cleanText;  // ← already does this
      lastBlock.toolBlocks = toolBlocks.length > 0 ? toolBlocks : undefined;
    }
    // ...
  }));
}
```

The client-side `extractToolBlocks()` already strips tool blocks. The issue is that the server sends the content in one shot (not chunked), so the client gets the full text with tool syntax included.

**Pros**: No server changes needed
**Cons**: The raw syntax still arrives at the client; regex-based stripping can be fragile

### Option C: Hybrid (best)

1. **Server**: Strip tool call syntax from the `content` SSE event (Option A)
2. **Client**: Extend `extractToolBlocks()` to handle `<tool_call>` XML format as a safety net
3. **Server**: Stream content progressively during the AI response (not just at the end), so the agent *feels* responsive even when it's about to call a tool

## Implementation Plan

### Step 1: Fix `extractToolBlocks()` in AgentSidebar.tsx
- Add regex for `<tool_call>` XML format
- Add regex for bare JSON tool calls: `{"name": "...", "arguments": {...}}`

### Step 2: Fix server content stripping in library.ts
- After `parseToolCalls(fullResponse)`, strip all tool call formats from `cleanContent`
- Send only clean text as `content` event

### Step 3: (Optional) Progressive streaming
- During the MiMo stream, send `content` events for non-tool-call text as it arrives
- Buffer potential tool block starts (``` or <tool_call>) until the block is complete
- If the buffered text turns out to be a tool call, don't send it as content
- This gives the user real-time text feedback while the AI is "thinking"

### Step 4: Test
- Verify tool calls appear ONLY as structured cards (not raw text)
- Verify normal AI text responses still stream correctly
- Verify multi-tool-call responses work (e.g. read → write → verify)

## Files to Modify

| File | Change |
|------|--------|
| `server/routes/library.ts` | Strip tool call syntax from content events |
| `components/library/AgentSidebar.tsx` | Extend `extractToolBlocks()` for XML/bare JSON formats |
