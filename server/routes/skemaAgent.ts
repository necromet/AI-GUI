import { Router } from 'express';
import { detectLanguage, buildLanguageInstruction, streamChatCompletion, readSSEStream, ChatMessage } from '../services/mimoService';
import { analyzeImages, buildSkemaFileToolPrompt, executeSkemaFileTool, parseToolCalls } from '../services/agentService';
import * as sessionService from '../services/skemaAgentService';
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
  console.log('[skema-agent] HIT /chat');
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
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
      }
      res.write(`data: ${JSON.stringify({ status: 'Analyzing reference images...' })}\n\n`);
      context.imageAnalysis = await analyzeImages(context.images, model, provider);
      if (context.imageAnalysis) {
        res.write(`data: ${JSON.stringify({ status: 'Image analysis complete. Generating design...' })}\n\n`);
      }
    }

    const workingFiles: ProjectFile[] = [...(context.files || [])];
    const fileContext = buildFileContext(workingFiles);
    const toolPrompt = buildSkemaFileToolPrompt();

    console.log('[skema-agent] system prompt parts: base=', SKEMA_AGENT_BASE_PROMPT.length, 'fileContext=', fileContext.length, 'toolPrompt=', toolPrompt.length, 'langInstruction=', langInstruction.length);

    const fullSystem = [SKEMA_AGENT_BASE_PROMPT, fileContext, toolPrompt, systemPromptAppend, langInstruction].filter(Boolean).join('\n\n');

    console.log('[skema-agent] total system:', fullSystem.length, 'chars');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const emitEvent = (event: any) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    let reqClosed = false;
    req.on('close', () => { reqClosed = true; });

    const apiMessages: ChatMessage[] = [];
    apiMessages.push({ role: 'system', content: fullSystem });
    for (const msg of messages) {
      const role = msg.role === 'model' ? 'assistant' : msg.role;
      apiMessages.push({ role, content: msg.content || '' });
    }

    let iteration = 0;
    const MAX_ROUNDS = 6;
    const debugInfo: string[] = [];

    while (iteration < MAX_ROUNDS) {
      iteration++;
      debugInfo.push(`round ${iteration} start`);

      const response = await streamChatCompletion({
        model: model || 'mimo-v2.5',
        messages: apiMessages,
        stream: true,
        thinking: { type: 'disabled' },
        ...(max_tokens ? { max_tokens } : {}),
      }, provider);

      debugInfo.push(`upstream ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        debugInfo.push(`error: ${errorText.substring(0, 200)}`);
        emitEvent({ error: `API error ${response.status}: ${errorText}` });
        break;
      }

      let fullResponse = '';
      await readSSEStream(response, (chunk) => {
        if (reqClosed) return;
        if (chunk.content) {
          fullResponse += chunk.content;
          emitEvent({ content: chunk.content });
        }
        if (chunk.reasoning) {
          emitEvent({ reasoning: chunk.reasoning });
        }
      });

      if (reqClosed) break;

      debugInfo.push(`got ${fullResponse.length} chars`);

      const toolCalls = parseToolCalls(fullResponse);
      if (toolCalls.length === 0) break;

      apiMessages.push({ role: 'assistant', content: fullResponse });

      for (const call of toolCalls) {
        emitEvent({ tool_call: { name: call.name, arguments: call.arguments } });
        const result = await executeSkemaFileTool(call, workingFiles, emitEvent);
        const outputStr = result.error ? `Error: ${result.error}` : result.output;
        emitEvent({ tool_result: { name: result.name, output: result.output, error: result.error } });
        apiMessages.push({ role: 'user', content: `[Tool: ${result.name}] ${outputStr}` });
      }
    }

    emitEvent({ done: true, _debug: debugInfo });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    console.error('[skema-agent/chat] Error:', errMsg);
    if (!res.headersSent) {
      res.status(500).json({ error: errMsg });
    } else {
      try {
        res.write(`data: ${JSON.stringify({ error: errMsg.substring(0, 500) })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } catch {}
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
