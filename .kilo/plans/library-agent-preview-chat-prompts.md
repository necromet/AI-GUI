# Plan: Library Agent — Fix Preview Parsing, Chat Rendering, and Prompts

## Problems Identified

### 1. Babel Fails on `type` / `interface` Inside `try` Block

**Root cause:** `buildTsxPreview()` wraps all user code in `try { ... } catch { ... }`. Babel standalone cannot parse TypeScript declaration statements (`type Foo = ...`, `interface Foo { ... }`) inside block-scoped positions. The TypeScript parser plugin expects these at the module top-level, not inside a `try` block.

**Evidence:** Console shows `SyntaxError: Unexpected reserved word 'interface'. (14:4)` and `Missing semicolon` on `type` declarations.

**Fix:** Add a `stripTsDeclarations()` function to `constants.ts` that removes `type` aliases and `interface` declarations from the combined code before Babel processes it. These produce no runtime code — they're purely compile-time type annotations.

### 2. Chat Renders Bottom-Heavy (Tool Calls Before Text)

**Root cause:** In `AgentDock.tsx`, each assistant message renders in this fixed order:
1. Thinking indicator (line 293)
2. Tool calls list (line 312)
3. Tool results list (line 423)
4. Text content (line 504)

This means tool call cards always appear **above** the text content. For the library agent, which emits tool calls followed by explanatory text, the user sees a wall of tool cards first, then the actual response text at the bottom.

**Fix:** Reorder the rendering so text content appears **first**, followed by tool calls/results. This makes the flow: "Here's what I'm doing" (text) → tool execution details (collapsible cards) → results. Much more natural for reading.

### 3. Agent Prompt Allows Tool Call XML to Leak Into File Content

**Root cause:** The prompt tells the agent to use ````tool` blocks for tool calls, but doesn't explicitly warn against including tool call syntax in `write_component_file` content. The agent sometimes writes XML-like artifacts (`<invoke>`, `<parameter>`, `<t>`) into component files.

**Evidence:** Console shows `The tag <invoke> is unrecognized in this browser`, `The tag <parameter> is unrecognized`, `The tag <t> is unrecognized`.

**Fix:** Rewrite the system prompt with clear guardrails:
- Explicit "NEVER" rules for file content
- Clarified sandbox capabilities (no `type`/`interface` declarations)
- Tighter workflow instructions
- Better error diagnosis guidance

---

## Files to Modify

| File | Changes |
|------|---------|
| `components/library/constants.ts` | Add `stripTsDeclarations()`, apply in `resolveFileRecursive()` |
| `components/AgentDock.tsx` | Reorder rendering: text content before tool calls/results |
| `server/routes/library.ts` | Rewrite `LIBRARY_AGENT_BASE_PROMPT` and `buildLibraryToolSystemPrompt()` |

---

## Detailed Changes

### A. `components/library/constants.ts`

Add after `stripUseClient()` (~line 92):

```ts
function stripTsDeclarations(code: string): string {
  const lines = code.split('\n');
  const output: string[] = [];
  let skipping = false;
  let braceDepth = 0;

  for (const line of lines) {
    if (skipping) {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
      if (braceDepth <= 0) { skipping = false; braceDepth = 0; }
      continue;
    }

    const trimmed = line.trimStart();

    // Strip: type Foo = ...;
    if (/^type\s+\w+/.test(trimmed)) {
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      if (opens > closes) { skipping = true; braceDepth = opens - closes; }
      continue;
    }

    // Strip: interface Foo { ... }
    if (/^interface\s+\w+/.test(trimmed)) {
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      if (opens > closes) { skipping = true; braceDepth = opens - closes; }
      continue;
    }

    output.push(line);
  }
  return output.join('\n');
}
```

Apply in `resolveFileRecursive()` after `stripExports(code)`:

```ts
result += stripTsDeclarations(stripExports(code)) + '\n';
```

### B. `components/AgentDock.tsx`

Reorder the rendering sections inside each assistant message bubble. Move the text content block (currently at line 504) to render **before** the tool calls block (currently at line 312). New order:

1. Thinking indicator (unchanged)
2. **Text content** (moved up — the agent's reasoning/explanation)
3. Tool calls list (moved down — execution details)
4. Tool results list (moved down — execution results)
5. Ask user prompt (unchanged)

### C. `server/routes/library.ts` — Prompt Rewrite

Replace `LIBRARY_AGENT_BASE_PROMPT` with a rewritten version that:

1. **Sandbox section**: Accurately states that `type` and `interface` declarations are stripped at runtime. Instructs the agent to use inline type annotations or skip them entirely.

2. **CRITICAL RULES section** (new, top of prompt):
   - File content must be PURE code — no XML, no markdown, no tool syntax
   - Never include `<invoke>`, `<parameter>`, `<t>`, or any non-HTML/JSX tags
   - Never include ```tool blocks inside file content
   - Always use TypeScript `as` casts instead of `interface`/`type` declarations
   - All component code must be self-contained within the sandbox

3. **Workflow section**: Tighten to be more prescriptive:
   - Step 1: read_component (mandatory before any edit)
   - Step 2: Analyze in 2-3 sentences (thinking text, not a tool call)
   - Step 3: create_todo_list (mandatory)
   - Step 4: write_component_file (complete file content, not diffs)
   - Step 5: verify_component (mandatory)
   - Step 6: Report summary (text only, no tools)

4. **Error diagnosis section**: Update to mention that `type`/`interface` SyntaxErrors are caused by the sandbox stripping mechanism, not by the user's code.

Replace `buildLibraryToolSystemPrompt()` to tighten the tool description format and add the file-content purity constraint directly in the `write_component_file` description.

---

## Verification

1. Create/edit a ui-widget component with TypeScript interfaces → preview should render without SyntaxError
2. Send a message to the Library Agent → chat should show text reasoning first, then tool call cards below
3. Agent writes component files → verify no `<invoke>`, `<parameter>`, `<t>` tags appear in preview
4. Run `npm run build` → no compilation errors
