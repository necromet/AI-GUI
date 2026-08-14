import { Router } from 'express';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { detectLanguage, buildLanguageInstruction } from '../services/mimoService';
import { analyzeImages } from '../services/agentService';
import { createProvider, convertToCoreMessages } from '../lib/aiSdk';
import * as sessionService from '../services/skemaAgentService';
import * as skemaLibrary from '../services/skemaLibraryService';
import type { ProjectFile } from '../../types';

const router = Router();

const SKEMA_AGENT_BASE_PROMPT = `You are an expert HTML/CSS/TypeScript engineer. You create, edit, and manage web design files (HTML and TSX). You are meticulous and methodical.

## CRITICAL RULES — File Content Purity (NEVER VIOLATE)

These rules apply to every file you write. Violating them causes hard-to-debug render failures.

1. **File content must be PURE code.** Every file you write must contain ONLY valid HTML/TypeScript/CSS/JS code. Nothing else.
2. **NEVER include markdown in file content.** No headings, bullet lists, backtick fences, or prose explanations inside code files. Comments (// or /* */) are fine.
3. **NEVER write incomplete code.** Every opening brace { must have a closing }. Every opening tag must have a closing tag. Every function must have a body. Never leave truncated or placeholder code.
4. **Write COMPLETE files, not diffs.** When using create_file or update_file, include the ENTIRE file content from the first line to the last. Do not write "..." or "// rest unchanged".

## Announce Intent Before Every Tool Call

Before EVERY tool call, output a short sentence describing what you are about to do and why. Never call a tool silently.

## Reasoning Requirement

After EVERY tool call result, output reasoning text (1-3 sentences) explaining:
- What you observed from the tool result
- What you plan to do next and why

NEVER chain tool calls without text between them. The user needs to understand your thought process.

## Available Tools

- **create_file(path, content)** — Create a new HTML, TSX, TS, CSS, or JS file in the project.
- **update_file(path, content)** — Update an existing file with new complete content.
- **delete_file(path)** — Delete a file from the project.
- **read_file(path)** — Read a file's current content.
- **list_files()** — List all files in the project with paths, languages, sizes, and entry status.
- **set_preview(path)** — Set which file to show in the preview pane.
- **search_library(query, category?)** — Search the skema component library for reference designs.
- **ask_user(question)** — Ask the user a clarifying question.
- **create_todo_list(tasks)** — Create a structured task checklist for complex workflows.

## File Guidelines

- For **HTML files**: Write valid HTML5 with embedded CSS and JS. The file will be rendered directly in an iframe.
- For **TSX files**: Write React 19 components with Tailwind CSS. Use inline type annotations (no type/interface declarations).
- The **entry file** is marked with isEntry=true. This is the file shown in the preview.
- Use **create_file** first, then **set_preview** to show it.

## Preview Sandbox — Exact Capabilities

The preview runs inside an isolated iframe. React and dependencies are loaded via ESM import maps pointing to esm.sh.

### Available at Runtime (no import needed — exposed as globals)
- **React 19** — all hooks (useState, useEffect, useRef, useCallback, useMemo, useContext, reducer, useLayoutEffect, useImperativeHandle), createElement, Fragment, Children, cloneElement, isValidElement, memo, lazy, Suspense, StrictMode, createContext, forwardRef
- **ReactDOM 19** — createRoot
- **Tailwind CSS** — every utility class, arbitrary values like \`w-[100px]\`, responsive prefixes
- **motion / framer-motion** — motion, AnimatePresence, useReducedMotion (loaded from esm.sh)
- **lucide-react** — any icon from the library

### Auto-Resolved Imports (write them normally)
The preview engine parses import statements and resolves them automatically:
- \`import { useState } from "react"\` → destructured from React global
- \`import { motion, AnimatePresence } from "motion/react"\` → from esm.sh bundle
- \`import { ChatIcon } from "@phosphor-icons/react"\` → from esm.sh bundle
- \`import { ChevronDownIcon } from "@radix-ui/react-icons"\` → from esm.sh bundle
- \`import { Dialog, DialogContent } from "@radix-ui/react-dialog"\` → from esm.sh bundle
- \`"use client"\` directives are automatically stripped

### TypeScript in the Sandbox
- **Inline type annotations work**: \`const x: string = "hi"\`, \`function fn(props: Props) {...}\`, \`as\` casts, generics
- **type aliases and interface declarations are STRIPPED at build time.** Use inline type annotations instead.
- **Enums, namespaces, decorators do NOT work.** Use const objects instead of enums.

### What Does NOT Work
- CSS modules, styled-components, emotion — use Tailwind only.
- \`import "./styles.css"\` — CSS files are not loaded by the preview engine.
- Node.js APIs (fs, path, crypto, process) — browser environment only.
- enum, namespace, decorators — unsupported TypeScript features.

## Error Diagnosis

### SyntaxError: "Unexpected reserved word 'interface'" or "Missing semicolon" on 'type'
Root cause: A \`type\` alias or \`interface\` declaration was written in the file. Remove it. Use inline type annotations instead.

### ReferenceError: "X is not defined"
Root cause: An identifier is used but never declared or imported.
1. Is X a React hook? → Add \`import { X } from "react"\`
2. Is X a component? → Check if it's defined in the file or imported from another file
3. Is X from a third-party library? → Check if the package is available (see above)

### Component renders blank / empty
1. Does the component return JSX? Check the return statement.
2. Is conditional rendering always evaluating to false?
3. Are there CSS classes hiding content (hidden, opacity-0, w-0, h-0)?

## Recommended Workflow

### Step 1: List and Read Files
Use list_files to see the project structure, then read_file to inspect specific files.

### Step 2: Analyze
Think through your analysis in 2-4 sentences. Are all imports valid? Is the code correct? Does it fit sandbox constraints?

### Step 3: Create To-Do List (optional)
Use create_todo_list for complex multi-step tasks.

### Step 4: Execute Tasks
Use create_file / update_file to make changes one file at a time.
- Write the COMPLETE file content — never partial, never diffs
- Fix ROOT CAUSES, not symptoms
- Preserve existing functionality when adding features

### Step 5: Set Preview
Use set_preview to point the preview at the file you want rendered.

### Step 6: Report
Provide a concise summary of files modified and issues fixed.

## Rules
- Be concise. 1-2 sentences per step explanation.
- search_library for reference when the user asks for something new.
- Prefer simple, self-contained solutions. Avoid over-engineering.
- Include all necessary imports at the top of every file you write.
- When the user asks to modify "this" or "the current design", use list_files and read_file to understand the current state first.
- delete_file is a LAST RESORT. Prefer update_file. Never delete the last file.

## Anti-Pattern Rules (NEVER violate)
- NEVER call the same tool with identical arguments more than once.
- NEVER rewrite files when the user only asks for review/analysis/opinion. Provide analysis text ONLY — no tool calls.
- NEVER change visual design choices (colors, themes, layout) unless explicitly requested.
- Total response under 500 words for review/analysis tasks.`;

function buildSkemaFileTools(workingFiles: ProjectFile[], emitEvent: (event: any) => void) {
  return {
    create_file: tool({
      description: 'Create a new file in the project. Specify the path and full content. The language is auto-detected from the file extension.',
      parameters: z.object({
        path: z.string().describe('File path, e.g. "index.html" or "src/App.tsx"'),
        content: z.string().describe('Complete file content. Must be valid, complete code.'),
      }),
      execute: async ({ path, content }) => {
        if (!path) return 'Error: Missing file path.';
        if (content === undefined || content === null) return 'Error: Missing file content.';
        const existing = workingFiles.find(f => f.path === path);
        if (existing) return `Error: File already exists: ${path}. Use update_file instead.`;
        const language = path.endsWith('.html') ? 'html'
          : path.endsWith('.tsx') ? 'tsx'
          : path.endsWith('.ts') ? 'ts'
          : path.endsWith('.css') ? 'css'
          : 'js';
        const isEntry = workingFiles.length === 0 || path.endsWith('.html');
        const file: ProjectFile = { path, content, language, isEntry };
        workingFiles.push(file);
        emitEvent({ file_created: file });
        return `File created: ${path} (${language}, ${content.length} chars)${isEntry ? ' [ENTRY]' : ''}`;
      },
    }),

    update_file: tool({
      description: 'Update an existing file with new content. Writes the COMPLETE file — never partial, never diffs. CRITICAL: content must be PURE code only — no markdown, no fences, no prose.',
      parameters: z.object({
        path: z.string().describe('File path to update'),
        content: z.string().describe('Complete new file content'),
      }),
      execute: async ({ path, content }) => {
        if (!path) return 'Error: Missing file path.';
        if (content === undefined || content === null) return 'Error: Missing file content.';
        const idx = workingFiles.findIndex(f => f.path === path);
        if (idx < 0) return `Error: File not found: ${path}. Use create_file instead.`;
        workingFiles[idx] = { ...workingFiles[idx], content };
        emitEvent({ file_updated: { path, content } });
        return `File updated: ${path} (${content.length} chars)`;
      },
    }),

    delete_file: tool({
      description: 'Delete a file from the project. Use this only as a last resort. Prefer update_file instead. Never delete the last file.',
      parameters: z.object({
        path: z.string().describe('File path to delete'),
      }),
      execute: async ({ path }) => {
        if (!path) return 'Error: Missing file path.';
        const idx = workingFiles.findIndex(f => f.path === path);
        if (idx < 0) return `Error: File not found: ${path}`;
        if (workingFiles.length <= 1) return 'Error: Cannot delete the last file in the project.';
        workingFiles.splice(idx, 1);
        emitEvent({ file_deleted: { path } });
        return `File deleted: ${path}. Remaining files: ${workingFiles.map(f => f.path).join(', ')}`;
      },
    }),

    read_file: tool({
      description: 'Read the content of a file. Use this before editing to understand the current state.',
      parameters: z.object({
        path: z.string().describe('File path to read'),
      }),
      execute: async ({ path }) => {
        if (!path) return 'Error: Missing file path.';
        const file = workingFiles.find(f => f.path === path);
        if (!file) return `Error: File not found: ${path}`;
        const MAX_CHARS = 12000;
        const truncated = file.content.length > MAX_CHARS
          ? file.content.substring(0, MAX_CHARS) + `\n... [truncated, ${file.content.length} chars total]`
          : file.content;
        return `File: ${path} (${file.language}, ${file.content.length} chars${file.isEntry ? ', ENTRY' : ''})\n\n${truncated}`;
      },
    }),

    list_files: tool({
      description: 'List all files in the project with their paths, languages, sizes, and entry status.',
      parameters: z.object({}),
      execute: async () => {
        if (workingFiles.length === 0) return 'No files in the project yet. Use create_file to start building.';
        return workingFiles.map(f =>
          `${f.isEntry ? '[ENTRY] ' : ''}${f.path} (${f.language}, ${f.content.length} chars)`
        ).join('\n');
      },
    }),

    set_preview: tool({
      description: 'Set which file to show in the preview pane. HTML files render directly, TSX files are compiled and rendered as React components.',
      parameters: z.object({
        path: z.string().describe('File path to preview'),
      }),
      execute: async ({ path }) => {
        if (!path) return 'Error: Missing file path.';
        const file = workingFiles.find(f => f.path === path);
        if (!file) return `Error: File not found: ${path}`;
        for (const f of workingFiles) f.isEntry = false;
        file.isEntry = true;
        emitEvent({ preview_set: { path } });
        return `Preview set to: ${path}`;
      },
    }),

    search_library: tool({
      description: 'Search the skema component library for reusable components, templates, snippets, and design elements.',
      parameters: z.object({
        query: z.string().describe('Natural language search query'),
        category: z.string().optional().describe('Optional category filter'),
      }),
      execute: async ({ query, category }) => {
        if (!query) return 'Error: No search query provided.';
        const results = await skemaLibrary.searchComponents(query, undefined, 5);
        const filtered = category ? results.filter(r => r.category === category) : results;
        if (filtered.length === 0) return `No components found for "${query}".`;
        const summary = filtered.map(r => {
          const desc = r.description.length > 150 ? r.description.substring(0, 150) + '...' : r.description;
          return `[${r.id}] ${r.name} — ${r.category}, ${r.contentType}\n  ${desc}\n  Relevance: ${(r.score * 100).toFixed(0)}%`;
        }).join('\n\n');
        return `Found ${filtered.length} component(s):\n\n${summary}`;
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
        if (parsedTasks && typeof parsedTasks === 'object' && !Array.isArray(parsedTasks)) {
          parsedTasks = [parsedTasks];
        }
        if (!Array.isArray(parsedTasks)) return 'Error: tasks must be an array of task objects.';
        if (parsedTasks.length === 0) {
          return JSON.stringify({ todo_list: true, tasks: [{ id: '1', title: 'Complete the task', description: '', priority: 'medium' }] });
        }
        const validTasks = parsedTasks.map((t: any, i: number) => ({
          id: (t.id || t.task_id || String(i + 1)).toString(),
          title: t.title || t.name || t.task || `Task ${i + 1}`,
          description: t.description || t.desc || '',
          priority: (['high', 'medium', 'low'].includes(t.priority || '') ? t.priority : 'medium') as string,
        }));
        return JSON.stringify({ todo_list: true, tasks: validTasks });
      },
    }),
  };
}

function buildFileContext(files: ProjectFile[]): string {
  if (!files || files.length === 0) {
    return 'CURRENT PROJECT: No files yet. Use create_file to start building the project.';
  }
  const fileList = files.map(f =>
    `  ${f.isEntry ? '[ENTRY] ' : ''}${f.path} (${f.language}, ${f.content.length} chars)`
  ).join('\n');
  return `CURRENT PROJECT FILES:\n${fileList}\n\nThe entry file (marked [ENTRY]) is the one shown in the preview. Use read_file to see a file's content before editing it.`;
}

router.post('/chat', async (req, res) => {
  try {
    const { messages, model, provider, context = {}, max_tokens, systemPromptAppend } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Missing messages' });
      return;
    }

    const userQuery = messages[messages.length - 1]?.content || '';
    const detectedLang = detectLanguage(userQuery);
    const langInstruction = buildLanguageInstruction(detectedLang);

    if (context.images?.length > 0 && !context.imageAnalysis) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.write(`data: ${JSON.stringify({ status: 'Analyzing reference images...' })}\n\n`);
      context.imageAnalysis = await analyzeImages(context.images, model, provider);
      if (context.imageAnalysis) {
        res.write(`data: ${JSON.stringify({ status: 'Image analysis complete. Generating design...' })}\n\n`);
      }
    }

    const workingFiles: ProjectFile[] = [...(context.files || [])];
    const fileContext = buildFileContext(workingFiles);

    const fullSystem = [SKEMA_AGENT_BASE_PROMPT, fileContext, systemPromptAppend, langInstruction].filter(Boolean).join('\n\n');

    const coreMessages = convertToCoreMessages(messages);

    const aiProvider = createProvider(provider);

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
    const tools = buildSkemaFileTools(workingFiles, emitEvent);

    const result = streamText({
      model: aiModel,
      system: fullSystem,
      messages: coreMessages,
      tools,
      maxSteps: 6,
      ...(max_tokens ? { maxTokens: max_tokens } : {}),
    });

    const stream = result.textStream;
    let fullText = '';
    for await (const chunk of stream) {
      if (reqClosed) break;
      fullText += chunk;
      emitEvent({ content: chunk });
    }

    const toolCalls = await result.toolCalls;
    const finishReason = await result.finishReason;

    if (toolCalls && toolCalls.length > 0) {
      for (const tc of toolCalls) {
        emitEvent({ tool_call: { id: tc.toolCallId, name: tc.toolName, arguments: tc.input } });
      }
    }

    const toolResults = await result.toolResults;

    console.log('[skema-agent] complete, text:', fullText.length, 'toolCalls:', toolCalls?.length || 0, 'toolResults:', toolResults?.length || 0, 'finishReason:', finishReason);

    if (toolCalls && toolCalls.length > 0) {
      const resultIds = new Set((toolResults || []).map(r => r.toolCallId));
      for (const tc of toolCalls) {
        if (!resultIds.has(tc.toolCallId)) {
          emitEvent({ tool_result: { toolCallId: tc.toolCallId, name: tc.toolName, output: '', error: 'Tool execution failed (invalid arguments or validation error)' } });
        }
      }
    }

    if (toolResults && toolResults.length > 0) {
      for (const tr of toolResults) {
        const outputStr = typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output);
        emitEvent({ tool_result: { toolCallId: tr.toolCallId, name: tr.toolName, output: outputStr } });

        if (tr.toolName === 'ask_user' && !outputStr.startsWith('Error:')) {
          try {
            const parsed = JSON.parse(outputStr);
            if (parsed.ask_user) emitEvent({ ask_user: { question: parsed.question } });
          } catch {}
        }

        if (tr.toolName === 'create_todo_list' && !outputStr.startsWith('Error:')) {
          try {
            const parsed = JSON.parse(outputStr);
            if (parsed.todo_list) emitEvent({ todo_list: parsed.tasks });
          } catch {}
        }
      }
    }

    emitEvent({ done: true });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('[skema-agent/chat] Error:', error.message, error.stack?.substring(0, 300));
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message.substring(0, 500) })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

router.get('/tools', (_req, res) => {
  const skemaFileToolNames = ['create_file', 'update_file', 'delete_file', 'read_file', 'list_files', 'set_preview', 'search_library', 'ask_user', 'create_todo_list'];
  res.json({ tools: skemaFileToolNames });
});

// ===== Session CRUD =====

router.get('/session/:id', async (req, res) => {
  try {
    const session = await sessionService.getSession(req.params.id);
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sessions/:projectId', async (req, res) => {
  try {
    const boardIdx = typeof req.query.boardIdx === 'string' ? parseInt(req.query.boardIdx, 10) : undefined;
    const sessions = await sessionService.getSessionsByProject(req.params.projectId, boardIdx);
    res.json({ sessions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sessions', async (req, res) => {
  try {
    const { projectId, boardIdx = 0 } = req.body;
    if (!projectId) { res.status(400).json({ error: 'Missing projectId' }); return; }
    const session = await sessionService.createSession(projectId, boardIdx);
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/sessions/:id', async (req, res) => {
  try {
    const { messages, title } = req.body;
    const session = await sessionService.updateSession(req.params.id, { messages, title });
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/sessions/:id', async (req, res) => {
  try {
    const deleted = await sessionService.deleteSession(req.params.id);
    if (!deleted) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
