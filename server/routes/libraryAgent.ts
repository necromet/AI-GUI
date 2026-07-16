import { Router } from 'express';
import { streamText, tool, type CoreMessage } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import { getProviderConfig, detectLanguage, buildLanguageInstruction } from '../services/mimoService';
import * as library from '../services/libraryService';
import { setVerifyResult } from '../services/verifyService';
import { toolExecuteCode } from '../services/agentService';

const router = Router();

const LIBRARY_AGENT_BASE_PROMPT = `You are a senior React component engineer. You create, edit, debug, and improve React components that render in a live preview sandbox. You are meticulous, methodical, and proactive about error prevention.

## CRITICAL RULES — File Content Purity (NEVER VIOLATE)

These rules apply to every file you write with write_component_file. Violating them causes hard-to-debug render failures.

1. **File content must be PURE code.** Every file you write must contain ONLY valid React/TypeScript/CSS/HTML code. Nothing else.
2. **NEVER include markdown in file content.** No headings, bullet lists, backtick fences, or prose explanations inside code files. Comments (// or /* */) are fine.
3. **NEVER write incomplete code.** Every opening brace { must have a closing }. Every opening tag <div> must have a closing </div>. Every function must have a body. Never leave truncated or placeholder code.
4. **Write COMPLETE files, not diffs.** When using write_component_file, include the ENTIRE file content from the first line to the last. Do not write "..." or "// rest unchanged".

## Announce Intent Before Every Tool Call

Before EVERY tool call, output a short sentence describing what you are about to do and why. Never call a tool silently.

## Reasoning Requirement

After EVERY tool call result, output reasoning text (1-3 sentences) explaining:
- What you observed from the tool result
- What you plan to do next and why

NEVER chain tool calls without text between them. The user needs to understand your thought process.

## Preview Sandbox — Exact Capabilities

The preview runs inside an isolated iframe. React and dependencies are loaded via ESM import maps pointing to esm.sh.

### Available at Runtime (no import needed — exposed as globals)
- **React 19** — all hooks (useState, useEffect, useRef, useCallback, useMemo, useContext, reducer, useLayoutEffect, useImperativeHandle), createElement, Fragment, Children, cloneElement, isValidElement, memo, lazy, Suspense, StrictMode, createContext, forwardRef
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
Fix: Remove the \`type\`/ \`interface\` declaration. Use inline type annotations instead.

### ReferenceError: "X is not defined"
Root cause: An identifier is used but never declared or imported.
1. Is X a React hook? → Add \`import { X } from "react"\`
2. Is X a component? → Check if it's defined in the file or imported from another file
3. Is X from a third-party library? → Check if the package is available (see above)
4. Is X a type-only reference? → Types are erased at runtime.

### TypeError: "Cannot read properties of undefined" / "X is not a function"
Root cause: Accessing a property on undefined/null, or calling something that isn't a function.
1. Check if the variable is initialized
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

## Recommended Workflow

### Step 1: Read Files
Use read_component to see the current file contents. Read before making changes.

### Step 2: Analyze
Think through your analysis in 2-4 sentences. Cover:
1. Are all imports valid for the sandbox?
2. Is the component logic correct? Any runtime errors?
3. Does the component return valid JSX? Any missing keys?
4. Does this code fit within sandbox constraints?

### Step 3: Create To-Do List (optional)
Use create_todo_list for complex multi-step tasks. Skip for simple single-file changes.

### Step 4: Execute Tasks
Use write_component_file to make changes one file at a time.
- Write the COMPLETE file content — never partial, never diffs
- Fix ROOT CAUSES, not symptoms
- Preserve existing functionality when adding features

### Step 5: Verify (optional)
Use verify_component when you want to confirm the component renders correctly.
- If errors are found, fix them and re-verify
- Max 3 verify attempts per workflow cycle

### Step 6: Report
Provide a concise summary:
- **Files modified**: List each file and what changed
- **Issues fixed**: Error type + root cause for each fix
- **Remaining issues**: If any errors couldn't be fixed, explain why

## Rules
- Be concise. 1-2 sentences per step explanation.
- search_library for reference components when the user asks for something new.
- delete_component_file is a LAST RESORT. Prefer write_component_file. Never delete the last file.
- Always explain WHY an error happened, not just WHAT you changed.
- Prefer simple, self-contained solutions. Avoid over-engineering.
- Include all necessary imports at the top of every file you write.
- The entry file for any component is the one with \`isEntry: true\` in the database. When reading a component, look at the files list to identify the entry file. You do NOT need to create a usage.tsx — just ensure one file is marked as the entry point.

## Anti-Pattern Rules (NEVER violate)
- NEVER call verify_component with {"id": ...}. The correct parameter is {"componentId": "..."}.
- NEVER call the same tool with identical arguments more than once.
- NEVER rewrite files when the user only asks for review/analysis/opinion. Provide analysis text ONLY — no write_component_file calls.
- NEVER change visual design choices (colors, themes, layout) unless explicitly requested.
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

function createProvider(providerName?: string) {
  const config = getProviderConfig(providerName);
  return createOpenAICompatible({
    apiKey: config.key,
    baseURL: config.base,
  });
}

function buildLibraryTools(componentId?: string) {
  return {
    search_library: tool({
      description: 'Search the component library for reference components using natural language. Returns matching components with relevance scores and content previews.',
      parameters: z.object({
        query: z.string().describe('Natural language search query'),
        category: z.string().optional().describe('Optional category filter: ui-widget, template, theme'),
        topK: z.number().optional().describe('Max results to return (default 5)'),
      }),
      execute: async ({ query, category, topK }) => {
        if (!query) return 'Error: No search query provided.';
        const results = await library.searchComponents(query, topK || 5);
        const filtered = category ? results.filter(r => r.category === category) : results;
        if (filtered.length === 0) return `No components found for "${query}".`;
        const summary = filtered.map(r => {
          const filesInfo = r.files && r.files.length > 1 ? ` (${r.files.length} files)` : '';
          const desc = r.description.length > 150 ? r.description.substring(0, 150) + '...' : r.description;
          return `[${r.id}] ${r.name} — ${r.category}, ${r.contentType}${filesInfo}\n  ${desc}\n  Relevance: ${(r.score * 100).toFixed(0)}%`;
        }).join('\n\n');
        return `Found ${filtered.length} component(s):\n\n${summary}`;
      },
    }),

    read_component: tool({
      description: 'Read a component by ID, including all its files and metadata. Use this to inspect the current component before editing.',
      parameters: z.object({
        id: z.string().optional().describe('Component ID. If omitted, reads the component currently being edited.'),
      }),
      execute: async ({ id }) => {
        const effectiveId = id || componentId;
        if (!effectiveId) return 'Error: Missing required field: id. Provide the component ID.';
        const comp = library.getComponent(effectiveId);
        if (!comp) return `Component not found: ${effectiveId}`;
        const header = `Component: ${comp.name}\nID: ${comp.id}\nCategory: ${comp.category}\nDescription: ${comp.description}\nTags: ${comp.tags.join(', ')}\nCreated: ${comp.createdAt}\nUpdated: ${comp.updatedAt}\n\nFiles:\n`;
        const MAX_TOTAL = 12000;
        let remaining = MAX_TOTAL - header.length;
        const filesSummary = (comp.files || []).map(f => {
          if (remaining <= 0) return `  ${f.filename} [skipped — output limit reached]`;
          const fileHeader = `  ${f.isEntry ? '[ENTRY] ' : ''}${f.filename} (${f.contentType}, ${f.content.length} chars)\n`;
          const budget = Math.min(remaining - fileHeader.length, 4000);
          if (budget <= 0) return fileHeader.trim();
          const truncated = f.content.length <= budget ? f.content : f.content.substring(0, budget) + `\n... [truncated, ${f.content.length} chars total]`;
          remaining -= fileHeader.length + truncated.length;
          return fileHeader + truncated;
        }).join('\n\n');
        return header + filesSummary;
      },
    }),

    ask_user: tool({
      description: 'Ask the user a clarifying question. Use this when you need more information before proceeding. Do NOT call any other tools in the same response when using ask_user.',
      parameters: z.object({
        question: z.string().describe('The question to ask the user'),
      }),
      execute: async ({ question }) => {
        if (!question) return 'Error: No question provided.';
        return JSON.stringify({ ask_user: true, question });
      },
    }),

    execute_code: tool({
      description: 'Execute JavaScript code in a sandboxed environment and return the output. Use console.log() to see results.',
      parameters: z.object({
        code: z.string().describe('JavaScript code to execute'),
      }),
      execute: async ({ code }) => {
        if (!code) return 'Error: No code provided.';
        return await toolExecuteCode(code);
      },
    }),

    write_component_file: tool({
      description: 'Write or update a single file within a component. Creates the file if it does not exist, updates it if it does. This is the primary tool for editing the current component. CRITICAL: The content must be PURE code only — no XML tags, no markdown, no tool call syntax, no prose. Every file must be complete (not truncated, no diffs). Do NOT use type/interface declarations — use inline type annotations instead.',
      parameters: z.object({
        componentId: z.string().describe('Component ID'),
        filename: z.string().describe('File to write (e.g. "components.tsx")'),
        content: z.string().describe('Full file content to write. Must be valid, complete code.'),
      }),
      execute: async ({ componentId, filename, content }) => {
        if (!componentId) return 'Error: Missing required field: componentId';
        if (!filename) return 'Error: Missing required field: filename';
        if (content === undefined || content === null) return 'Error: Missing required field: content';
        const targetComp = library.getComponent(componentId);
        if (!targetComp) return `Component not found: ${componentId}`;
        const written = library.writeComponentFile(componentId, filename, content);
        return `File written successfully:\n  Component ID: ${componentId}\n  Filename: ${written.filename}\n  Content type: ${written.contentType}\n  Size: ${content.length} chars`;
      },
    }),

    delete_component_file: tool({
      description: 'Delete a single file from a component by filename. Use this only as a last resort. Prefer write_component_file instead.',
      parameters: z.object({
        componentId: z.string().describe('Component ID'),
        filename: z.string().describe('Filename to delete'),
      }),
      execute: async ({ componentId, filename }) => {
        if (!componentId) return 'Error: Missing required field: componentId';
        if (!filename) return 'Error: Missing required field: filename';
        const targetComp = library.getComponent(componentId);
        if (!targetComp) return `Component not found: ${componentId}`;
        const fileToDelete = (targetComp.files || []).find(f => f.filename === filename);
        if (!fileToDelete) return `File not found: ${filename} in component ${componentId}`;
        const remainingFiles = (targetComp.files || []).filter(f => f.filename !== filename);
        if (remainingFiles.length === 0) return 'Error: Cannot delete the last file in a component.';
        const deleted = library.deleteComponentFile(fileToDelete.id);
        if (deleted && fileToDelete.isEntry && remainingFiles.length > 0) {
          library.updateComponentFile(remainingFiles[0].id, { isEntry: true } as any);
        }
        return deleted
          ? `File deleted: ${filename} from component ${componentId}. Remaining files: ${remainingFiles.map(f => f.filename).join(', ')}`
          : `Failed to delete file: ${filename}`;
      },
    }),

    create_todo_list: tool({
      description: 'Create a structured to-do list of tasks to accomplish. Call this after reading files and analyzing issues. Tasks are displayed visually to the user as a checklist.',
      parameters: z.object({
        tasks: z.any().describe('Array of task objects, each with "title" (string), optional "id", "description", and "priority" ("high"|"medium"|"low")'),
      }),
      execute: async ({ tasks }) => {
        let parsedTasks = tasks;
        if (typeof parsedTasks === 'string') {
          try { parsedTasks = JSON.parse(parsedTasks); } catch { return 'Error: tasks must be a JSON array.'; }
        }
        if (!Array.isArray(parsedTasks) || parsedTasks.length === 0) return 'Error: Provide a non-empty tasks array.';
        const validTasks = parsedTasks.map((t: any, i: number) => ({
          id: (t.id || t.task_id || String(i + 1)).toString(),
          title: t.title || t.name || t.task || `Task ${i + 1}`,
          description: t.description || t.desc || '',
          priority: (['high', 'medium', 'low'].includes(t.priority || '') ? t.priority : 'medium') as string,
        }));
        return JSON.stringify({ todo_list: true, tasks: validTasks });
      },
    }),

    verify_component: tool({
      description: 'Verify the component renders correctly in the preview sandbox. Triggers a live preview render and checks for React/runtime errors. The result is reported asynchronously — continue working after calling this.',
      parameters: z.object({
        componentId: z.string().describe('Component ID to verify'),
      }),
      execute: async ({ componentId }) => {
        if (!componentId) return 'Error: Missing componentId. Use {"componentId": "..."} not {"id": "..."}';
        const comp = library.getComponent(componentId);
        if (!comp) return `Component not found: ${componentId}`;
        return 'Verification triggered. The preview will render the component and check for errors. You can continue working — the result will be shown to the user.';
      },
    }),

    list_folders: tool({
      description: 'List all library folders with their IDs, names, descriptions, and component counts.',
      parameters: z.object({}),
      execute: async () => {
        const allFolders = library.listFolders();
        if (allFolders.length === 0) return 'No folders exist yet.';
        const summary = allFolders.map(f =>
          `[${f.id}] ${f.name} — ${f.componentCount ?? 0} component(s)${f.description ? '\n  ' + f.description : ''}`
        ).join('\n\n');
        return `Found ${allFolders.length} folder(s):\n\n${summary}`;
      },
    }),

    list_folder_contents: tool({
      description: 'List all components in a specific folder.',
      parameters: z.object({
        folderId: z.string().describe('Folder ID'),
      }),
      execute: async ({ folderId }) => {
        if (!folderId) return 'Error: Missing required field: folderId';
        const listFolder = library.getFolder(folderId);
        if (!listFolder) return `Folder not found: ${folderId}`;
        const folderComps = library.getComponentsInFolder(folderId);
        if (folderComps.length === 0) return `Folder "${listFolder.name}" is empty.`;
        const summary = folderComps.map(c =>
          `[${c.id}] ${c.name} — ${c.category}${c.description ? '\n  ' + c.description.substring(0, 100) : ''}`
        ).join('\n\n');
        return `Folder "${listFolder.name}" contains ${folderComps.length} component(s):\n\n${summary}`;
      },
    }),
  };
}

function convertToCoreMessages(messages: any[]): CoreMessage[] {
  const result: CoreMessage[] = [];

  for (const msg of messages) {
    const role = msg.role === 'model' ? 'assistant' : msg.role;

    if (role === 'user') {
      result.push({ role: 'user', content: msg.content || '' });
    } else if (role === 'assistant') {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const parts: any[] = [];
        if (msg.content) {
          parts.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.tool_calls) {
          let input: any;
          try {
            input = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
          } catch {
            input = {};
          }
          parts.push({
            type: 'tool-call',
            toolCallId: tc.id || `tc_${Math.random().toString(36).slice(2)}`,
            toolName: tc.function.name,
            input,
          });
        }
        result.push({ role: 'assistant', content: parts } as any);
      } else {
        result.push({ role: 'assistant', content: msg.content || '' });
      }
    } else if (role === 'tool') {
      result.push({
        role: 'tool',
        content: [{
          type: 'tool-result',
          toolCallId: msg.tool_call_id || '',
          toolName: msg.tool_name || msg.name || '',
          output: { type: 'text', value: msg.content || '' },
        }],
      } as any);
    }
  }

  return result;
}

router.post('/verify-result', (req, res) => {
  try {
    const { componentId, errors, success } = req.body;
    if (!componentId) {
      res.status(400).json({ error: 'Missing componentId' });
      return;
    }
    setVerifyResult(componentId, errors || [], success !== false);
    res.json({ ok: true });
  } catch (error: any) {
    console.error('[library-agent/verify-result POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { messages, model, provider, componentId, max_tokens, systemPromptAppend } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Missing messages' });
      return;
    }

    let componentContext = '';
    if (componentId) {
      const comp = library.getComponent(componentId);
      if (comp) componentContext = buildComponentContext(comp);
    }

    const userQuery = messages[messages.length - 1]?.content || '';
    const detectedLang = detectLanguage(userQuery);
    const langInstruction = buildLanguageInstruction(detectedLang);

    const fullSystem = [LIBRARY_AGENT_BASE_PROMPT, componentContext, systemPromptAppend, langInstruction].filter(Boolean).join('\n\n');

    const coreMessages = convertToCoreMessages(messages);

    const aiProvider = createProvider(provider);
    const tools = buildLibraryTools(componentId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const emitEvent = (event: any) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    let reqClosed = false;
    req.on('close', () => { reqClosed = true; });

    const aiModel = aiProvider.chatModel(model || 'mimo-v2.5');

    const result = streamText({
      model: aiModel,
      system: fullSystem,
      messages: coreMessages,
      tools,
      maxSteps: 1,
      ...(max_tokens ? { maxTokens: max_tokens } : {}),
    });

    const stream = result.textStream;
    let fullText = '';
    for await (const chunk of stream) {
      fullText += chunk;
      emitEvent({ content: chunk });
    }

    const toolCalls = await result.toolCalls;
    const finishReason = await result.finishReason;

    if (toolCalls && toolCalls.length > 0) {
      for (const tc of toolCalls) {
        emitEvent({ tool_call: { id: tc.toolCallId, name: tc.toolName, arguments: tc.input } });
        if (tc.toolName === 'verify_component') {
          emitEvent({ verify_component: { componentId: (tc.input as any).componentId } });
        }
      }
    }

    const toolResults = await result.toolResults;

    console.log('[library-agent] complete, text:', fullText.length, 'toolCalls:', toolCalls?.length || 0, 'toolResults:', toolResults?.length || 0, 'finishReason:', finishReason);

    if (toolCalls && toolCalls.length > 0) {
      const resultIds = new Set((toolResults || []).map(r => r.toolCallId));
      for (const tc of toolCalls) {
        if (!resultIds.has(tc.toolCallId)) {
          emitEvent({ tool_result: { toolCallId: tc.toolCallId, name: tc.toolName, output: '', error: 'Tool execution failed (invalid arguments or validation error)' } });
        }
      }
    }

    if (toolResults && toolResults.length > 0) {
      for (let i = 0; i < toolResults.length; i++) {
        const tr = toolResults[i];
        const outputStr = typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output);
        emitEvent({ tool_result: { toolCallId: tr.toolCallId, name: tr.toolName, output: outputStr } });

        if (tr.toolName === 'create_component' && !outputStr.startsWith('Error:')) {
          const match = outputStr.match(/ID:\s*(\w+)/);
          if (match) {
            const comp = library.getComponent(match[1]);
            if (comp) emitEvent({ component_created: comp });
          }
        }

        if ((tr.toolName === 'write_component_file' || tr.toolName === 'update_component' || tr.toolName === 'delete_component_file') && !outputStr.startsWith('Error:')) {
          const match = outputStr.match(/Component ID:\s*(\w+)/) || outputStr.match(/ID:\s*(\w+)/) || outputStr.match(/component\s+(\w+)/i);
          if (match) {
            const comp = library.getComponent(match[1]);
            if (comp) emitEvent({ component_updated: comp });
          }
        }

        if (tr.toolName === 'create_todo_list' && !outputStr.startsWith('Error:')) {
          try {
            const parsed = JSON.parse(outputStr);
            if (parsed.todo_list) emitEvent({ todo_list: parsed.tasks });
          } catch {}
        }

        if (tr.toolName === 'ask_user' && !outputStr.startsWith('Error:')) {
          try {
            const parsed = JSON.parse(outputStr);
            if (parsed.ask_user) emitEvent({ ask_user: { question: parsed.question } });
          } catch {}
        }
      }
    }

    emitEvent({ done: true });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('[library-agent/chat] Error:', error.message, error.stack?.substring(0, 300));
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
