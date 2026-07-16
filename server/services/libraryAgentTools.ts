import * as library from './libraryService';
import type { ToolDefinition, ToolCall, ToolResult } from './agentService';
import { parseToolCalls, toolExecuteCode } from './agentService';

export { parseToolCalls };

export const LIBRARY_TOOLS: ToolDefinition[] = [
  {
    name: 'search_library',
    description: 'Search the component library for reference components using natural language. Returns matching components with relevance scores and content previews.',
    parameters: {
      query: { type: 'string', description: 'Natural language search query' },
      category: { type: 'string', description: 'Optional category filter: ui-widget, template, theme' },
      topK: { type: 'number', description: 'Max results to return (default 5)' },
    },
  },
  {
    name: 'read_component',
    description: 'Read a component by ID, including all its files and metadata. Use this to inspect the current component before editing, or to read reference components.',
    parameters: {
      id: { type: 'string', description: 'Component ID' },
    },
  },
  {
    name: 'ask_user',
    description: 'Ask the user a clarifying question. Use this when you need more information before proceeding. Do NOT call any other tools in the same response when using ask_user.',
    parameters: {
      question: { type: 'string', description: 'The question to ask the user' },
    },
  },
  {
    name: 'execute_code',
    description: 'Execute JavaScript code in a sandboxed environment and return the output. Use console.log() to see results.',
    parameters: {
      code: { type: 'string', description: 'JavaScript code to execute' },
    },
  },
  {
    name: 'write_component_file',
    description: 'Write or update a single file within a component. Creates the file if it does not exist, updates it if it does. This is the primary tool for editing the current component. CRITICAL: The content must be PURE code only — no XML tags, no markdown, no tool call syntax, no prose. Every file must be complete (not truncated, no diffs). Do NOT use type/interface declarations — use inline type annotations instead.',
    parameters: {
      componentId: { type: 'string', description: 'Component ID' },
      filename: { type: 'string', description: 'File to write (e.g. "components.tsx", "usage.tsx")' },
      content: { type: 'string', description: 'Full file content to write. Must be valid, complete code with no tool syntax or markdown.' },
    },
  },
  {
    name: 'delete_component_file',
    description: 'Delete a single file from a component by filename. Use this only as a last resort when a file truly needs to be removed (e.g. after splitting code into new files and the old combined file is no longer needed). Prefer overwriting files with write_component_file instead of deleting.',
    parameters: {
      componentId: { type: 'string', description: 'Component ID' },
      filename: { type: 'string', description: 'Filename to delete (e.g. "old-style.css")' },
    },
  },
  {
    name: 'create_todo_list',
    description: 'Create a structured to-do list of tasks to accomplish. Call this after reading files and analyzing issues. Tasks are displayed visually to the user as a checklist. Each task will be executed sequentially.',
    parameters: {
      tasks: { type: 'array', description: 'Array of task objects: { "id": string, "title": string, "description": string, "priority": "high"|"medium"|"low" }' },
    },
  },
  {
    name: 'verify_component',
    description: 'Verify the component renders correctly in the preview sandbox. Triggers a live preview render and checks for React/runtime errors. Call this after completing all file edits.',
    parameters: {
      componentId: { type: 'string', description: 'Component ID to verify' },
    },
  },
  {
    name: 'list_folders',
    description: 'List all library folders with their IDs, names, descriptions, and component counts. Use this to find folders for organizing components.',
    parameters: {},
  },
  {
    name: 'list_folder_contents',
    description: 'List all components in a specific folder. Returns component IDs, names, categories, and descriptions.',
    parameters: {
      folderId: { type: 'string', description: 'Folder ID' },
    },
  },
];

export function buildLibraryToolSystemPrompt(): string {
  const toolDescriptions = LIBRARY_TOOLS.map(t => {
    const params = Object.entries(t.parameters)
      .map(([name, p]) => `  - ${name} (${p.type}): ${p.description}`)
      .join('\n');
    return `### ${t.name}\n${t.description}\nParameters:\n${params}`;
  }).join('\n\n');

  return `You have access to the following tools. To use a tool, respond with a JSON block in this exact format:

\`\`\`tool
{"name": "tool_name", "arguments": {"param": "value"}}
\`\`\`

You can use multiple tools in sequence. After using a tool, you will receive the result and can continue reasoning or provide a final answer.

Available tools:
${toolDescriptions}

### Tool Usage Rules
- ALWAYS write a short sentence describing what you are about to do and WHY before every tool call. Never call a tool silently.
- Always read_component before modifying files — never edit blindly.
- write_component_file is your primary editing tool. Write the COMPLETE file content (not a diff).
- CRITICAL: write_component_file content must be PURE CODE ONLY. Never include tool call blocks (\`\`\`tool), XML tags (<invoke>, <parameter>, <t>), markdown, or prose in file content.
- CRITICAL: After EVERY tool call block, you MUST add a blank line before continuing your text. The closing \`\`\` must be followed by a blank line. Example of CORRECT format:

\`\`\`tool
{"name": "read_component", "arguments": {"id": "abc"}}
\`\`\`

Now let me analyze...

INCORRECT (no blank line — breaks parsing):
\`\`\`tool
{"name": "read_component", "arguments": {"id": "abc"}}
\`\`\`
Now let me analyze...
- Do NOT use \`type Foo = ...\` or \`interface Foo { ... }\` declarations in files — the sandbox strips them. Use inline type annotations instead.
- When you use ask_user, do NOT call any other tools in the same response.
- execute_code runs JavaScript in a sandboxed VM (Node.js-like). Use it for data transformations, NOT for React rendering.
- Content types: html, tsx, css, js, json, markdown.
- Categories: ui-widget, template, theme.

### Component File Structure
- Components can have any number of files with any filenames.
- One file must be marked as isEntry: true — this is the main entry point for rendering.
- The entry file is stored in the database with isEntry: true. When reading a component, check the files list to identify it.
- You do NOT need to create a usage.tsx or any specific filename. Just provide the main component file as the entry.
- Use inline type annotations (props: { name: string }) — do NOT use \`interface\` or \`type\` declarations.
- Do NOT include "import React from 'react'" — React is a global.

### Verify Flow
- verify_component triggers a live render in the preview iframe.
- The sandbox reports back: either "Verification passed" or specific error messages.
- If verification fails, you will see the exact errors. Analyze them, create fixes, and re-verify.
- Common verification failures: missing imports, undefined variables, invalid JSX syntax.
- Max 3 verify attempts per workflow cycle.

STRUCTURED WORKFLOW — You MUST follow these steps in order:
1. read_component → 2. analyze → 3. create_todo_list → 4. write_component_file → 5. verify_component → 6. report
Never skip steps. The create_todo_list and verify_component calls are mandatory.

CRITICAL: After calling create_todo_list, you MUST IMMEDIATELY call write_component_file for the first task. Do NOT stop after creating the todo list. Do NOT output analysis text between create_todo_list and write_component_file. The todo list is a plan — now EXECUTE it. Call write_component_file in the SAME response as create_todo_list.

### Anti-Pattern Rules (NEVER violate)
1. NEVER call verify_component with {"id": ...}. The correct parameter is {"componentId": "..."}.
2. NEVER call the same tool with identical arguments more than once. If you already read a component, do not read it again. If you already wrote a file, do not write it again unless you need to fix an error found during verification.
3. NEVER call create_todo_list after write_component_file. The workflow order is mandatory: read → analyze → todo → write → verify → report.
4. NEVER rewrite files when the user only asks for review, analysis, or opinion. If the user says "what do you think", "review this", "analyze", or "what needs to be revised" — provide ANALYSIS TEXT ONLY. Do NOT call write_component_file unless the user explicitly asks you to make changes.
5. NEVER change visual design choices (colors, themes, layout, typography) unless the user explicitly requests it. If the original uses a light theme, keep it light.
6. Keep responses concise. 1-2 sentences per step. Total response under 500 words for review/analysis tasks.
7. If a verify_component call fails, check your parameter names before retrying. Do not retry with the same wrong parameters.`;
}

export async function executeLibraryTool(
  call: ToolCall,
  onProgress?: (chunk: string) => void,
): Promise<ToolResult> {
  const result: ToolResult = { name: call.name, input: call.arguments, output: '' };

  try {
    switch (call.name) {
      case 'search_library': {
        const query = call.arguments.query || '';
        const category = call.arguments.category;
        const topK = call.arguments.topK || 5;
        if (!query) {
          result.output = 'Error: No search query provided.';
          result.error = 'No query';
          break;
        }
        const results = await library.searchComponents(query, topK);
        const filtered = category ? results.filter(r => r.category === category) : results;
        if (filtered.length === 0) {
          result.output = `No components found for "${query}".`;
        } else {
          const summary = filtered.map(r => {
            const filesInfo = r.files && r.files.length > 1 ? ` (${r.files.length} files)` : '';
            const desc = r.description.length > 150 ? r.description.substring(0, 150) + '...' : r.description;
            return `[${r.id}] ${r.name} — ${r.category}, ${r.contentType}${filesInfo}\n  ${desc}\n  Relevance: ${(r.score * 100).toFixed(0)}%`;
          }).join('\n\n');
          result.output = `Found ${filtered.length} component(s):\n\n${summary}`;
        }
        break;
      }

      case 'read_component': {
        const id = call.arguments.id;
        if (!id) {
          result.output = 'Error: Missing required field: id';
          result.error = 'Missing id';
          break;
        }
        const comp = library.getComponent(id);
        if (!comp) {
          result.output = `Component not found: ${id}`;
          result.error = 'Not found';
          break;
        }
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
        result.output = header + filesSummary;
        break;
      }

      case 'ask_user': {
        const question = call.arguments.question || '';
        if (!question) {
          result.output = 'Error: No question provided.';
          result.error = 'No question';
        } else {
          result.output = JSON.stringify({ ask_user: true, question });
        }
        break;
      }

      case 'execute_code': {
        const code = call.arguments.code || '';
        if (!code) {
          result.output = 'Error: No code provided.';
          result.error = 'No code';
          break;
        }
        result.output = await toolExecuteCode(code);
        break;
      }

      case 'write_component_file': {
        const { componentId, filename, content } = call.arguments;
        if (!componentId) {
          result.output = 'Error: Missing required field: componentId';
          result.error = 'Missing componentId';
          break;
        }
        if (!filename) {
          result.output = 'Error: Missing required field: filename';
          result.error = 'Missing filename';
          break;
        }
        if (content === undefined || content === null) {
          result.output = 'Error: Missing required field: content';
          result.error = 'Missing content';
          break;
        }
        const targetComp = library.getComponent(componentId);
        if (!targetComp) {
          result.output = `Component not found: ${componentId}`;
          result.error = 'Not found';
          break;
        }
        const written = library.writeComponentFile(componentId, filename, content);
        result.output = `File written successfully:\n  Component ID: ${componentId}\n  Filename: ${written.filename}\n  Content type: ${written.contentType}\n  Size: ${content.length} chars`;
        onProgress?.(`Wrote ${filename} (${content.length} chars)`);
        break;
      }

      case 'delete_component_file': {
        const { componentId, filename } = call.arguments;
        if (!componentId) {
          result.output = 'Error: Missing required field: componentId';
          result.error = 'Missing componentId';
          break;
        }
        if (!filename) {
          result.output = 'Error: Missing required field: filename';
          result.error = 'Missing filename';
          break;
        }
        const targetComp = library.getComponent(componentId);
        if (!targetComp) {
          result.output = `Component not found: ${componentId}`;
          result.error = 'Not found';
          break;
        }
        const fileToDelete = (targetComp.files || []).find(f => f.filename === filename);
        if (!fileToDelete) {
          result.output = `File not found: ${filename} in component ${componentId}`;
          result.error = 'File not found';
          break;
        }
        const remainingFiles = (targetComp.files || []).filter(f => f.filename !== filename);
        if (remainingFiles.length === 0) {
          result.output = `Error: Cannot delete the last file in a component. Use delete_component instead to remove the entire component.`;
          result.error = 'Last file';
          break;
        }
        const deleted = library.deleteComponentFile(fileToDelete.id);
        if (deleted && fileToDelete.isEntry && remainingFiles.length > 0) {
          library.updateComponentFile(remainingFiles[0].id, { isEntry: true } as any);
        }
        result.output = deleted
          ? `File deleted: ${filename} from component ${componentId}. Remaining files: ${remainingFiles.map(f => f.filename).join(', ')}`
          : `Failed to delete file: ${filename}`;
        if (!deleted) result.error = 'Delete failed';
        break;
      }

      case 'create_todo_list': {
        let { tasks } = call.arguments;
        if (typeof tasks === 'string') {
          try { tasks = JSON.parse(tasks); } catch {
            result.output = 'Error: tasks must be a JSON array.';
            result.error = 'Invalid tasks';
            break;
          }
        }
        if (!Array.isArray(tasks) || tasks.length === 0) {
          result.output = 'Error: Provide a non-empty tasks array.';
          result.error = 'No tasks';
          break;
        }
        const validTasks = tasks.map((t: any, i: number) => ({
          id: (t.id || t.task_id || String(i + 1)).toString(),
          title: t.title || t.name || t.task || `Task ${i + 1}`,
          description: t.description || t.desc || '',
          priority: ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
        }));
        result.output = JSON.stringify({ todo_list: true, tasks: validTasks });
        onProgress?.(`Created to-do list with ${validTasks.length} tasks`);
        break;
      }

      case 'verify_component': {
        const componentId = call.arguments.componentId || call.arguments.id;
        if (!componentId) {
          result.output = 'Error: Missing componentId. Use {"componentId": "..."} not {"id": "..."}.';
          result.error = 'Missing componentId';
          break;
        }
        const comp = library.getComponent(componentId);
        if (!comp) {
          result.output = `Component not found: ${componentId}`;
          result.error = 'Not found';
          break;
        }
        result.output = 'Verification triggered. The preview will render the component and check for errors.';
        onProgress?.(`Verifying component: ${comp.name}`);
        break;
      }

      case 'list_folders': {
        const allFolders = library.listFolders();
        if (allFolders.length === 0) {
          result.output = 'No folders exist yet.';
        } else {
          const summary = allFolders.map(f =>
            `[${f.id}] ${f.name} — ${f.componentCount ?? 0} component(s)${f.description ? '\n  ' + f.description : ''}`
          ).join('\n\n');
          result.output = `Found ${allFolders.length} folder(s):\n\n${summary}`;
        }
        break;
      }

      case 'list_folder_contents': {
        const { folderId: listFolderId } = call.arguments;
        if (!listFolderId) {
          result.output = 'Error: Missing required field: folderId';
          result.error = 'Missing folderId';
          break;
        }
        const listFolder = library.getFolder(listFolderId);
        if (!listFolder) {
          result.output = `Folder not found: ${listFolderId}`;
          result.error = 'Not found';
          break;
        }
        const folderComps = library.getComponentsInFolder(listFolderId);
        if (folderComps.length === 0) {
          result.output = `Folder "${listFolder.name}" is empty.`;
        } else {
          const summary = folderComps.map(c =>
            `[${c.id}] ${c.name} — ${c.category}${c.description ? '\n  ' + c.description.substring(0, 100) : ''}`
          ).join('\n\n');
          result.output = `Folder "${listFolder.name}" contains ${folderComps.length} component(s):\n\n${summary}`;
        }
        break;
      }

      default:
        result.output = `Unknown tool: ${call.name}`;
        result.error = 'Tool not found';
    }
  } catch (err: any) {
    result.output = '';
    result.error = err.message || 'Tool execution failed';
  }

  return result;
}


