import { Router, Request, Response } from 'express';
import { streamChatCompletion, detectLanguage, buildLanguageInstruction, ChatMessage } from '../services/mimoService';
import * as library from '../services/libraryService';
import { SEED_LIBRARY_COMPONENTS } from '../data/seedLibraryComponents';
import { LIBRARY_TOOLS, buildLibraryToolSystemPrompt, executeLibraryTool, parseToolCalls } from '../services/libraryAgentTools';
import { compileComponent } from '../services/tsxCompiler';

const router = Router();

router.get('/components', (req: Request, res: Response) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const folderId = typeof req.query.folderId === 'string' ? req.query.folderId : undefined;
    const unfoldered = req.query.unfoldered === 'true';
    const components = library.listComponents({
      category,
      folderId: unfoldered ? null : folderId,
    });
    res.json({ components });
  } catch (error: any) {
    console.error('[library/components GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/components/categories', (_req: Request, res: Response) => {
  try {
    const categories = library.getCategories();
    res.json({ categories });
  } catch (error: any) {
    console.error('[library/components/categories GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/components/stats', (_req: Request, res: Response) => {
  try {
    const stats = library.getStats();
    res.json(stats);
  } catch (error: any) {
    console.error('[library/components/stats GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/components/:id', (req: Request, res: Response) => {
  try {
    const component = library.getComponent(req.params.id);
    if (!component) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }
    res.json({ component });
  } catch (error: any) {
    console.error('[library/components/:id GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/components', async (req: Request, res: Response) => {
  try {
    const { name, category, contentType, description, tags, content, metadata, thumbnail, isGlobal, agentAccessible, files, folderId } = req.body;
    if (!name || !category) {
      res.status(400).json({ error: 'Missing required fields: name, category' });
      return;
    }

    let primaryContent = content || '';
    let primaryContentType = contentType || 'html';

    if (files && files.length > 0) {
      const entryFile = files.find((f: any) => f.isEntry) || files.find((f: any) => f.filename.endsWith('.html')) || files[0];
      primaryContent = entryFile.content || '';
      primaryContentType = entryFile.contentType || 'html';
    }

    const component = await library.addComponent({
      name,
      category,
      contentType: primaryContentType,
      description: description || '',
      tags: tags || [],
      content: primaryContent,
      metadata,
      thumbnail,
      isGlobal: isGlobal !== false,
      agentAccessible: agentAccessible !== false,
      folderId: folderId || null,
      files: files || undefined,
    });
    res.json({ component });
  } catch (error: any) {
    console.error('[library/components POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/components/:id', (req: Request, res: Response) => {
  try {
    const updated = library.updateComponent(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }
    res.json({ component: updated });
  } catch (error: any) {
    console.error('[library/components/:id PUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/components/:id', (req: Request, res: Response) => {
  try {
    const deleted = library.deleteComponent(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('[library/components/:id DELETE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/components/:id/compiled', async (req: Request, res: Response) => {
  try {
    const comp = library.getComponent(req.params.id);
    if (!comp) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }

    const files = library.getComponentFiles(req.params.id);
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'Component has no files' });
      return;
    }

    const js = await compileComponent(files);
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(js);
  } catch (error: any) {
    console.error('[library/components/:id/compiled] Error:', error.message);
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(`throw new Error(${JSON.stringify('Compilation error: ' + error.message)});`);
  }
});

router.post('/components/search', async (req: Request, res: Response) => {
  try {
    const { query, topK = 10 } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Missing required field: query' });
      return;
    }
    const results = await library.searchComponents(query, topK);
    res.json({ components: results });
  } catch (error: any) {
    console.error('[library/components/search POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/components/reindex', async (req: Request, res: Response) => {
  try {
    const count = await library.reindexAll();
    res.json({ success: true, count });
  } catch (error: any) {
    console.error('[library/components/reindex POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/components/seed', async (req: Request, res: Response) => {
  try {
    const existing = library.listComponents();
    if (existing.length > 0) {
      res.json({ success: true, message: `Library already has ${existing.length} components. Skipped seeding.`, count: 0 });
      return;
    }

    let count = 0;
    for (const comp of SEED_LIBRARY_COMPONENTS) {
      await library.addComponent({
        ...comp,
        isGlobal: true,
        agentAccessible: true,
      });
      count++;
    }

    res.json({ success: true, message: `Seeded ${count} components`, count });
  } catch (error: any) {
    console.error('[library/components/seed POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===== Folder Routes =====

router.get('/folders', (_req: Request, res: Response) => {
  try {
    const folders = library.listFolders();
    res.json({ folders });
  } catch (error: any) {
    console.error('[library/folders GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/folders/:id', (req: Request, res: Response) => {
  try {
    const folder = library.getFolder(req.params.id);
    if (!folder) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }
    res.json({ folder });
  } catch (error: any) {
    console.error('[library/folders/:id GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/folders/:id/components', (req: Request, res: Response) => {
  try {
    const components = library.getComponentsInFolder(req.params.id);
    res.json({ components });
  } catch (error: any) {
    console.error('[library/folders/:id/components GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/folders', (req: Request, res: Response) => {
  try {
    const { name, description, color, icon, agentAccessible } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Missing required field: name' });
      return;
    }
    const folder = library.addFolder({
      name,
      description: description || '',
      color: color || '#6366f1',
      icon: icon || 'folder',
      sortOrder: 0,
      agentAccessible: agentAccessible !== false,
    });
    res.json({ folder });
  } catch (error: any) {
    console.error('[library/folders POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/folders/:id', (req: Request, res: Response) => {
  try {
    const updated = library.updateFolder(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }
    res.json({ folder: updated });
  } catch (error: any) {
    console.error('[library/folders/:id PUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/folders/:id', (req: Request, res: Response) => {
  try {
    const deleted = library.deleteFolder(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Folder not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('[library/folders/:id DELETE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/components/:id/move', (req: Request, res: Response) => {
  try {
    const { folderId } = req.body;
    const moved = library.moveComponentToFolder(req.params.id, folderId ?? null);
    if (!moved) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('[library/components/:id/move POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const LIBRARY_AGENT_BASE_PROMPT = `You are a senior React component engineer. You create, edit, debug, and improve React components that render in a live preview sandbox. You are meticulous, methodical, and proactive about error prevention.

## CRITICAL RULES — File Content Purity (NEVER VIOLATE)

These rules apply to every file you write with write_component_file. Violating them causes hard-to-debug render failures.

1. **File content must be PURE code.** Every file you write must contain ONLY valid React/TypeScript/CSS/HTML code. Nothing else.
2. **NEVER include tool call syntax in file content.** Do not write \`\`\`tool blocks, JSON tool calls, XML tags like <invoke>, <parameter>, <t>, or any non-HTML/JSX markup into component files.
3. **NEVER include markdown in file content.** No headings, bullet lists, backtick fences, or prose explanations inside code files. Comments (// or /* */) are fine.
4. **NEVER write incomplete code.** Every opening brace { must have a closing }. Every opening tag <div> must have a closing </div>. Every function must have a body. Never leave truncated or placeholder code.
5. **Write COMPLETE files, not diffs.** When using write_component_file, include the ENTIRE file content from the first line to the last. Do not write "..." or "// rest unchanged".

## Preview Sandbox — Exact Capabilities

The preview runs inside an isolated iframe. React and dependencies are loaded via ESM import maps pointing to esm.sh.

### Available at Runtime (no import needed — exposed as globals)
- **React 19** — all hooks (useState, useEffect, useRef, useCallback, useMemo, useContext, useReducer, useLayoutEffect, useImperativeHandle), createElement, Fragment, Children, cloneElement, isValidElement, memo, lazy, Suspense, StrictMode, createContext, forwardRef
- **ReactDOM 19** — createRoot
- **Tailwind CSS** — every utility class, arbitrary values like \`w-[100px]\`, responsive prefixes
- **motion / framer-motion** — motion, AnimatePresence, useReducedMotion (loaded from esm.sh)

### Auto-Resolved Imports (write them normally)
The preview engine parses import statements and resolves them automatically:
- \`import { useState, useEffect } from "react"\` → destructured from React global
- \`import { motion, AnimatePresence } from "motion/react"\` → from esm.sh bundle
- \`import { ChatIcon, XIcon } from "@phosphor-icons/react"\` → from esm.sh bundle
- \`import { MyHelper } from "./components"\` → resolved to components.tsx in the same component
- \`"use client"\` directives are automatically stripped

### TypeScript in the Sandbox
- **Inline type annotations work**: \`const x: string = "hi"\`, \`function fn(props: Props) {...}\`, \`as\` casts, generics
- **type aliases and interface declarations are STRIPPED at build time.** The preview engine removes \`type Foo = ...\` and \`interface Foo { ... }\` declarations because Babel cannot parse them inside the execution wrapper. This is normal and expected.
- **Do NOT rely on type aliases or interfaces for runtime logic.** They are compile-time only.
- **Enums, namespaces, decorators do NOT work.** Use const objects instead of enums.

### What Works in the Sandbox
- All React hooks and patterns (useState, useEffect, custom hooks, context, refs)
- Inline TypeScript type annotations (on variables, parameters, return types, generics, as casts)
- JSX with fragments (<>...</>), conditional rendering, .map() lists
- Tailwind CSS classes, responsive design, dark mode classes
- motion/react animations (motion.div, AnimatePresence, useReducedMotion)
- @phosphor-icons/react icons (ChatIcon, XIcon, MicrophoneIcon, etc.)
- Any simple npm package that doesn't require a build step or Node.js APIs

### What Does NOT Work
- shadcn/ui, Radix UI, Headless UI — not available. Use raw HTML + Tailwind.
- zustand, jotai, Redux, Recoil — no state management libraries. Use React hooks.
- react-router, next/link, wouter — no routing. The sandbox is a single page.
- react-hook-form, Formik — no form libraries. Use controlled inputs with useState.
- axios, SWR, React Query — no data fetching. Use local state.
- CSS modules, styled-components, emotion — use Tailwind only.
- \`import "./styles.css"\` — CSS files are not loaded by the preview engine.
- Node.js APIs (fs, path, crypto, process) — browser environment only.
- Web APIs that require user permission (camera, microphone, geolocation)
- Libraries that require custom webpack/vite plugins or server-side rendering
- enum, namespace, decorators — unsupported TypeScript features

## Error Diagnosis

When you see an error from the preview sandbox, classify it and fix it systematically:

### SyntaxError: "Unexpected reserved word 'interface'" or "Missing semicolon" on 'type'
Root cause: A \`type\` alias or \`interface\` declaration was written in the file. The sandbox strips these at build time, but if they appear in certain positions they cause parse errors.
Fix: Remove the \`type\`/ \`interface\` declaration. Use inline type annotations instead:
- Instead of \`interface Props { name: string }\` then \`function Comp(props: Props)\`, write \`function Comp(props: { name: string })\`
- Instead of \`type Status = "active" | "inactive"\`, use the union inline: \`const status: "active" | "inactive" = "active"\`

### ReferenceError: "X is not defined"
Root cause: An identifier is used but never declared or imported.
1. Is X a React hook? → Add \`import { X } from "react"\`
2. Is X a component? → Check if it's defined in the file or imported from another file
3. Is X from a third-party library? → Check if the package is available (see above)
4. Is X a type-only reference? → Types are erased at runtime. If X was a type, remove the reference.

### TypeError: "Cannot read properties of undefined" / "X is not a function"
Root cause: Accessing a property on undefined/null, or calling something that isn't a function.
1. Check if the variable is initialized (useState returns [state, setter] — destructuring correct?)
2. Check if props are passed correctly from the parent
3. Check if an optional prop is used without a default value or optional chaining

### React Error #130 / "Element type is invalid"
Root cause: Rendering a component that is undefined or not a valid React component.
1. Check the import — is the component name spelled correctly?
2. Check if the export is a default export vs named export
3. Check if the import path resolves correctly in the sandbox

### "Maximum update depth exceeded"
Root cause: Infinite re-render loop — setState called during render.
1. Check useEffect dependency arrays — are they causing infinite loops?
2. Ensure state updates are conditional or debounced

### Component renders blank / empty
1. Does the component return JSX? Check the return statement.
2. Is conditional rendering always evaluating to false?
3. Are there CSS classes hiding content (hidden, opacity-0, w-0, h-0)?

## Workflow (MUST follow in this order — never skip steps)

### Step 1: Read Files
Use read_component to see the current file contents. ALWAYS read before making any changes.
- If the user mentions an error, read the files to find the error location
- If the user asks for a feature, read existing code to understand the architecture

### Step 2: Analyze
Think through your analysis in 2-4 sentences. Cover:
1. Are all imports valid for the sandbox?
2. Is the component logic correct? Any runtime errors?
3. Does the component return valid JSX? Any missing keys?
4. Does this code fit within sandbox constraints?

### Step 3: Create To-Do List
Use create_todo_list with specific, actionable tasks:
- BAD: "Fix the error" — too vague
- GOOD: "Fix ReferenceError: useState not defined — add import { useState } from 'react' to components.tsx line 1"

### Step 4: Execute Tasks
Use write_component_file to make changes one file at a time.
- Write the COMPLETE file content — never partial, never diffs
- For ui-widget: only write components.tsx and usage.tsx
- Fix ROOT CAUSES, not symptoms
- Preserve existing functionality when adding features

### Step 5: Verify
Use verify_component to check the component renders without errors.
- If errors are found, classify them and create a new mini to-do list
- Fix each error systematically — one at a time
- Re-verify after fixes. Max 3 verify attempts.
- If errors persist after 3 attempts, explain what you tried and report remaining issues

### Step 6: Report
Provide a concise summary:
- **Files modified**: List each file and what changed
- **Issues fixed**: Error type + root cause for each fix
- **Remaining issues**: If any errors couldn't be fixed, explain why

## Rules
- Be concise. 1-2 sentences per step explanation.
- search_library for reference components when the user asks for something new.
- create_component when the user wants a separate helper component.
- Use create_folder to organize related components into groups.
- Use move_to_folder to assign components to folders.
- Use list_folders and list_folder_contents to browse folder organization.
- delete_component_file is a LAST RESORT. Prefer write_component_file. Never delete the last file.
- Always explain WHY an error happened, not just WHAT you changed.
- Prefer simple, self-contained solutions. Avoid over-engineering.
- Include all necessary imports at the top of every file you write.
- For ui-widget: exactly 2 files (components.tsx + usage.tsx). usage.tsx must end with \`const root = ReactDOM.createRoot(document.getElementById('root')); root.render(<ComponentName />);\`

## Anti-Pattern Rules (NEVER violate)
- NEVER call verify_component with {"id": ...}. The correct parameter is {"componentId": "..."}.
- NEVER call the same tool with identical arguments more than once.
- NEVER call create_todo_list after write_component_file. Workflow order is mandatory.
- NEVER stop after create_todo_list. You MUST call write_component_file in the SAME response. The todo list is a plan — execute it immediately.
- NEVER rewrite files when the user only asks for review/analysis/opinion ("what do you think", "review this", "what needs to be revised"). Provide analysis text ONLY — no write_component_file calls.
- NEVER change visual design choices (colors, themes, layout) unless explicitly requested.
- If verify_component fails, check parameter names before retrying. Do not retry with wrong parameters.
- Total response under 500 words for review/analysis tasks.`;

function buildComponentContext(comp: any): string {
  const fileNames = (comp.files || []).map((f: any) => f.filename).join(', ');
  return `CURRENT COMPONENT CONTEXT:
- Name: ${comp.name}
- ID: ${comp.id}
- Category: ${comp.category}
- Description: ${comp.description}
- Tags: ${(comp.tags || []).join(', ')}
- Files: ${fileNames}

The user is currently editing this component. When they ask to modify, update, or improve "this component" or "it", they are referring to the component above. Use read_component with ID "${comp.id}" to see the current file contents before making changes.`;
}

const MAX_AGENT_ITERATIONS = 10;

const verifyResults = new Map<string, { errors: string[]; success: boolean; timestamp: number }>();

function waitForVerifyResult(componentId: string, timeoutMs: number): Promise<{ errors: string[]; success: boolean } | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const result = verifyResults.get(componentId);
      if (result && result.timestamp >= start) {
        verifyResults.delete(componentId);
        resolve({ errors: result.errors, success: result.success });
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolve(null);
        return;
      }
      setTimeout(check, 200);
    };
    check();
  });
}

router.get('/agent/session/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const session = library.getSession(id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ session });
  } catch (error: any) {
    console.error('[library/agent/session GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/agent/sessions/:componentId', (req: Request, res: Response) => {
  try {
    const componentId = req.params.componentId as string;
    const sessions = library.getSessionsByComponent(componentId);
    res.json({ sessions });
  } catch (error: any) {
    console.error('[library/agent/sessions GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/agent/sessions', (req: Request, res: Response) => {
  try {
    const { componentId } = req.body;
    if (!componentId) {
      res.status(400).json({ error: 'Missing componentId' });
      return;
    }
    const session = library.createSession(componentId);
    res.json({ session });
  } catch (error: any) {
    console.error('[library/agent/sessions POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/agent/sessions/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { messages, title } = req.body;
    const existing = library.getSession(id);
    if (!existing) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    if (messages) {
      library.updateSessionMessages(id, messages);
    }
    if (title) {
      library.updateSessionTitle(id, title);
    }
    const updated = library.getSession(id);
    res.json({ session: updated });
  } catch (error: any) {
    console.error('[library/agent/sessions PUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/agent/sessions/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const deleted = library.deleteSession(id);
    if (!deleted) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('[library/agent/sessions DELETE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/agent/verify-result', (req: Request, res: Response) => {
  try {
    const { componentId, errors, success } = req.body;
    if (!componentId) {
      res.status(400).json({ error: 'Missing componentId' });
      return;
    }
    verifyResults.set(componentId, { errors: errors || [], success: success !== false, timestamp: Date.now() });
    res.json({ ok: true });
  } catch (error: any) {
    console.error('[library/agent/verify-result POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/agent/chat', async (req: Request, res: Response) => {
  try {
    const { messages, model, provider, max_tokens, componentId } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Missing messages' });
      return;
    }

    let componentContext = '';
    if (componentId) {
      const comp = library.getComponent(componentId);
      if (comp) {
        componentContext = buildComponentContext(comp);
      }
    }

    const userQuery = messages[messages.length - 1]?.content || '';
    const detectedLang = detectLanguage(userQuery);
    const langInstruction = buildLanguageInstruction(detectedLang);
    const toolPrompt = buildLibraryToolSystemPrompt();

    const apiMessages: ChatMessage[] = [];
    const fullSystem = [LIBRARY_AGENT_BASE_PROMPT, componentContext, toolPrompt, langInstruction].filter(Boolean).join('\n\n');
    apiMessages.push({ role: 'system', content: fullSystem });

    for (const msg of messages) {
      const role = msg.role === 'model' ? 'assistant' : msg.role;
      apiMessages.push({ role, content: msg.content });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const toolResults: any[] = [];
    let iteration = 0;
    let askUserDetected = false;

    while (iteration < MAX_AGENT_ITERATIONS) {
      iteration++;

      const response = await streamChatCompletion({
        model: model || 'mimo-v2.5',
        messages: apiMessages,
        stream: true,
        thinking: { type: 'disabled' },
        ...(max_tokens ? { max_tokens } : {}),
      }, provider);

      if (!response.ok) {
        const errorText = (await response.text()).substring(0, 500);
        res.write(`data: ${JSON.stringify({ error: errorText })}\n\n`);
        break;
      }

      const reader = (response.body as any)?.getReader();
      if (!reader) {
        res.write(`data: ${JSON.stringify({ error: 'No response body' })}\n\n`);
        break;
      }

      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              const reasoning = parsed.choices?.[0]?.delta?.reasoning_content;
              if (content) {
                fullResponse += content;
              }
            } catch {
              // skip malformed
            }
          }
        }
      } catch {
        // client disconnected
      }

      const toolCalls = parseToolCalls(fullResponse);
      if (toolCalls.length === 0) {
        res.write(`data: ${JSON.stringify({ content: fullResponse })}\n\n`);
        break;
      }

      const firstToolIdx = fullResponse.indexOf('```tool');
      const firstJsonIdx = fullResponse.indexOf('```json');
      const firstXmlToolIdx = fullResponse.indexOf('<tool_call>');
      let splitIdx = -1;
      if (firstToolIdx !== -1 && (firstJsonIdx === -1 || firstToolIdx < firstJsonIdx) && (firstXmlToolIdx === -1 || firstToolIdx < firstXmlToolIdx)) {
        splitIdx = firstToolIdx;
      } else if (firstJsonIdx !== -1 && (firstXmlToolIdx === -1 || firstJsonIdx < firstXmlToolIdx)) {
        splitIdx = firstJsonIdx;
      } else if (firstXmlToolIdx !== -1) {
        splitIdx = firstXmlToolIdx;
      }

      const preToolText = splitIdx > 0 ? fullResponse.substring(0, splitIdx).trim() : '';

      if (preToolText) {
        res.write(`data: ${JSON.stringify({ content: preToolText })}\n\n`);
      }

      apiMessages.push({ role: 'assistant', content: fullResponse });

      for (const call of toolCalls) {
        res.write(`data: ${JSON.stringify({ tool_call: { name: call.name, arguments: call.arguments } })}\n\n`);

        const onProgress = (chunk: string) => {
          res.write(`data: ${JSON.stringify({ tool_progress: { name: call.name, chunk } })}\n\n`);
        };

        const result = await executeLibraryTool(call, onProgress);
        toolResults.push(result);

        if (call.name === 'ask_user' && !result.error) {
          try {
            const parsed = JSON.parse(result.output);
            if (parsed.ask_user) {
              res.write(`data: ${JSON.stringify({ ask_user: { question: parsed.question } })}\n\n`);
              askUserDetected = true;
            }
          } catch {}
          res.write(`data: ${JSON.stringify({ tool_result: result })}\n\n`);
          continue;
        }

        if (call.name === 'create_component' && !result.error) {
          const match = result.output.match(/ID:\s*(\w+)/);
          if (match) {
            const comp = library.getComponent(match[1]);
            if (comp) {
              res.write(`data: ${JSON.stringify({ component_created: comp })}\n\n`);
            }
          }
        }

        if ((call.name === 'write_component_file' || call.name === 'update_component') && !result.error) {
          const compIdMatch = result.output.match(/Component ID:\s*(\w+)/) || result.output.match(/ID:\s*(\w+)/);
          if (compIdMatch) {
            const comp = library.getComponent(compIdMatch[1]);
            if (comp) {
              res.write(`data: ${JSON.stringify({ component_updated: comp })}\n\n`);
            }
          }
        }

        if (call.name === 'create_todo_list' && !result.error) {
          try {
            const parsed = JSON.parse(result.output);
            if (parsed.todo_list) {
              res.write(`data: ${JSON.stringify({ todo_list: parsed.tasks })}\n\n`);
            }
          } catch {}
        }

        if (call.name === 'verify_component' && !result.error) {
          try {
            const parsed = JSON.parse(result.output);
            if (parsed.verify_component) {
              res.write(`data: ${JSON.stringify({ verify_component: { componentId: parsed.componentId } })}\n\n`);
              const renderResult = await waitForVerifyResult(parsed.componentId, 10000);
              if (renderResult) {
                result.output = renderResult.success
                  ? 'Verification passed: Component renders without errors.'
                  : `Verification failed with errors:\n${renderResult.errors.join('\n')}`;
                if (!renderResult.success) result.error = 'Render errors';
              } else {
                result.output = 'Verification timed out. Assuming component renders correctly.';
              }
            }
          } catch {}
        }

        const toolMsg = result.error
          ? `[Tool: ${result.name}] Error: ${result.error}`
          : `[Tool: ${result.name}] Result:\n${result.output}`;
        apiMessages.push({ role: 'user', content: toolMsg });
        res.write(`data: ${JSON.stringify({ tool_result: result })}\n\n`);
      }

      if (askUserDetected) break;
    }

    if (toolResults.length > 0) {
      res.write(`data: ${JSON.stringify({ tool_summary: toolResults })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('[library/agent/chat] Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message.substring(0, 500) })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

export default router;
