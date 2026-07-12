import { z } from 'zod';
import { defineTool, type ToolInfo } from '../tool';
import * as library from '../../../server/services/libraryService';
import { toolExecuteCode } from '../../../server/services/agentService';

export const searchLibraryTool = defineTool({
  name: 'search_library',
  description: 'Search the component library for reference components using natural language. Returns matching components with relevance scores and content previews.',
  parameters: z.object({
    query: z.string().describe('Natural language search query'),
    category: z.string().optional().describe('Optional category filter: ui-widget, template, theme'),
    topK: z.number().optional().describe('Max results to return (default 5)'),
  }),
  execute: async (args) => {
    const results = await library.searchComponents(args.query, args.topK || 5);
    const filtered = args.category ? results.filter(r => r.category === args.category) : results;
    if (filtered.length === 0) {
      return { title: 'Search', output: `No components found for "${args.query}".` };
    }
    const summary = filtered.map(r => {
      const filesInfo = r.files && r.files.length > 1 ? ` (${r.files.length} files)` : '';
      const desc = r.description.length > 150 ? r.description.substring(0, 150) + '...' : r.description;
      return `[${r.id}] ${r.name} — ${r.category}, ${r.contentType}${filesInfo}\n  ${desc}\n  Relevance: ${(r.score * 100).toFixed(0)}%`;
    }).join('\n\n');
    return { title: 'Search', output: `Found ${filtered.length} component(s):\n\n${summary}` };
  },
});

export const readComponentTool = defineTool({
  name: 'read_component',
  description: 'Read a component by ID, including all its files and metadata. Use this to inspect the current component before editing.',
  parameters: z.object({
    id: z.string().describe('Component ID'),
  }),
  execute: async (args) => {
    const comp = library.getComponent(args.id);
    if (!comp) return { title: 'Read', output: `Component not found: ${args.id}`, error: 'Not found' };
    const header = `Component: ${comp.name}\nID: ${comp.id}\nCategory: ${comp.category}\nDescription: ${comp.description}\nTags: ${comp.tags.join(', ')}\n\nFiles:\n`;
    const MAX_TOTAL = 12000;
    let remaining = MAX_TOTAL - header.length;
    const filesSummary = (comp.files || []).map(f => {
      if (remaining <= 0) return `  ${f.filename} [skipped]`;
      const fileHeader = `  ${f.isEntry ? '[ENTRY] ' : ''}${f.filename} (${f.contentType}, ${f.content.length} chars)\n`;
      const budget = Math.min(remaining - fileHeader.length, 4000);
      if (budget <= 0) return fileHeader.trim();
      const truncated = f.content.length <= budget ? f.content : f.content.substring(0, budget) + `\n... [truncated, ${f.content.length} chars total]`;
      remaining -= fileHeader.length + truncated.length;
      return fileHeader + truncated;
    }).join('\n\n');
    return { title: 'Read Component', output: header + filesSummary };
  },
});

export const createComponentTool = defineTool({
  name: 'create_component',
  description: 'Create a new component in the library. Supports multi-file components.',
  parameters: z.object({
    name: z.string().describe('Component name'),
    category: z.enum(['ui-widget', 'template', 'theme']).optional().describe('Category'),
    description: z.string().optional().describe('What the component does'),
    tags: z.array(z.string()).optional().describe('Array of tag strings'),
    files: z.array(z.object({
      filename: z.string(),
      contentType: z.string().optional(),
      content: z.string(),
      isEntry: z.boolean().optional(),
    })).describe('Array of files. At least one required.'),
  }),
  execute: async (args) => {
    if (!args.files || args.files.length === 0) {
      return { title: 'Create', output: 'Error: At least one file required.', error: 'No files' };
    }
    const cat = args.category || 'template';
    const entryFile = args.files.find(f => f.isEntry) || args.files[0];
    const created = await library.addComponent({
      name: args.name,
      category: cat,
      contentType: (entryFile.contentType as any) || 'html',
      description: args.description || '',
      tags: args.tags || [],
      content: entryFile.content || '',
      isGlobal: true,
      agentAccessible: true,
      files: args.files.map((f, i) => ({
        filename: f.filename,
        contentType: (f.contentType as any) || 'html',
        content: f.content || '',
        isEntry: f.isEntry ?? (i === 0),
        sortOrder: i,
      })) as any,
    });
    return {
      title: 'Create Component',
      output: `Component created:\n  ID: ${created.id}\n  Name: ${created.name}\n  Files: ${(created.files || []).map(f => f.filename).join(', ')}`,
      metadata: { componentId: created.id },
    };
  },
});

export const writeComponentFileTool = defineTool({
  name: 'write_component_file',
  description: 'Write or update a single file within a component. Creates the file if it does not exist. Content must be PURE code only — no markdown, no tool call syntax.',
  parameters: z.object({
    componentId: z.string().describe('Component ID'),
    filename: z.string().describe('File to write (e.g. "components.tsx", "usage.tsx")'),
    content: z.string().describe('Full file content to write. Must be valid, complete code.'),
  }),
  execute: async (args) => {
    const comp = library.getComponent(args.componentId);
    if (!comp) return { title: 'Write', output: `Component not found: ${args.componentId}`, error: 'Not found' };
    const written = library.writeComponentFile(args.componentId, args.filename, args.content);
    return {
      title: 'Write File',
      output: `File written:\n  Component: ${args.componentId}\n  File: ${written.filename}\n  Size: ${args.content.length} chars`,
      metadata: { componentId: args.componentId, filename: written.filename },
    };
  },
});

export const updateComponentTool = defineTool({
  name: 'update_component',
  description: 'Update component metadata (name, description, tags, category) and/or replace its files.',
  parameters: z.object({
    id: z.string().describe('Component ID'),
    name: z.string().optional().describe('New name'),
    description: z.string().optional().describe('New description'),
    tags: z.array(z.string()).optional().describe('New tags'),
    category: z.string().optional().describe('New category'),
  }),
  execute: async (args) => {
    const existing = library.getComponent(args.id);
    if (!existing) return { title: 'Update', output: `Component not found: ${args.id}`, error: 'Not found' };
    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.category !== undefined) updates.category = args.category;
    const updated = library.updateComponent(args.id, updates);
    if (!updated) return { title: 'Update', output: `Failed to update: ${args.id}`, error: 'Update failed' };
    return { title: 'Update Component', output: `Updated: ${updated.name} (${updated.id})` };
  },
});

export const deleteComponentFileTool = defineTool({
  name: 'delete_component_file',
  description: 'Delete a single file from a component. Prefer overwriting with write_component_file instead.',
  parameters: z.object({
    componentId: z.string().describe('Component ID'),
    filename: z.string().describe('Filename to delete'),
  }),
  permission: 'delete_component_file',
  execute: async (args) => {
    const comp = library.getComponent(args.componentId);
    if (!comp) return { title: 'Delete File', output: `Component not found: ${args.componentId}`, error: 'Not found' };
    const file = (comp.files || []).find(f => f.filename === args.filename);
    if (!file) return { title: 'Delete File', output: `File not found: ${args.filename}`, error: 'Not found' };
    library.deleteComponentFile(file.id);
    return { title: 'Delete File', output: `Deleted ${args.filename} from ${args.componentId}` };
  },
});

export const executeCodeTool = defineTool({
  name: 'execute_code',
  description: 'Execute JavaScript code in a sandboxed environment. Use console.log() for output.',
  parameters: z.object({
    code: z.string().describe('JavaScript code to execute'),
  }),
  execute: async (args) => {
    const output = await toolExecuteCode(args.code);
    return { title: 'Execute Code', output };
  },
});

export const askUserTool = defineTool({
  name: 'ask_user',
  description: 'Ask the user a clarifying question. Do NOT call other tools in the same response when using this.',
  parameters: z.object({
    question: z.string().describe('The question to ask the user'),
  }),
  execute: async (args) => {
    return { title: 'Ask User', output: JSON.stringify({ ask_user: true, question: args.question }) };
  },
});

export const verifyComponentTool = defineTool({
  name: 'verify_component',
  description: 'Verify the component renders correctly in the preview sandbox. Triggers a live render and checks for errors.',
  parameters: z.object({
    componentId: z.string().describe('Component ID to verify'),
  }),
  execute: async (args) => {
    return { title: 'Verify', output: JSON.stringify({ verify_component: true, componentId: args.componentId }) };
  },
});

export const createTodoListTool = defineTool({
  name: 'create_todo_list',
  description: 'Create a structured to-do list of tasks. Call after reading files and analyzing issues. Tasks are displayed as a checklist.',
  parameters: z.object({
    tasks: z.array(z.object({
      id: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(['high', 'medium', 'low']).optional(),
    })).describe('Array of tasks'),
  }),
  execute: async (args) => {
    const tasks = args.tasks.map((t, i) => ({
      id: t.id || String(i + 1),
      title: t.title,
      description: t.description || '',
      priority: t.priority || 'medium',
    }));
    return { title: 'Todo List', output: JSON.stringify({ todo_list: true, tasks }) };
  },
});

export const listFoldersTool = defineTool({
  name: 'list_folders',
  description: 'List all library folders with their IDs, names, descriptions, and component counts. Use to find folders for organizing components.',
  parameters: z.object({}),
  execute: async () => {
    const folders = library.listFolders();
    if (folders.length === 0) {
      return { title: 'Folders', output: 'No folders exist yet. Use create_folder to create one.' };
    }
    const summary = folders.map(f =>
      `[${f.id}] ${f.name} — ${f.componentCount ?? 0} component(s)${f.description ? '\n  ' + f.description : ''}`
    ).join('\n\n');
    return { title: 'Folders', output: `Found ${folders.length} folder(s):\n\n${summary}` };
  },
});

export const createFolderTool = defineTool({
  name: 'create_folder',
  description: 'Create a new folder to group related components. Folders help organize the library and can be referenced by agents.',
  parameters: z.object({
    name: z.string().describe('Folder name'),
    description: z.string().optional().describe('What components belong in this folder'),
    color: z.string().optional().describe('Hex color code (e.g. #6366f1)'),
  }),
  execute: async (args) => {
    const folder = library.addFolder({
      name: args.name,
      description: args.description || '',
      color: args.color || '#6366f1',
      icon: 'folder',
      sortOrder: 0,
      agentAccessible: true,
    });
    return {
      title: 'Create Folder',
      output: `Folder created:\n  ID: ${folder.id}\n  Name: ${folder.name}\n  Color: ${folder.color}`,
      metadata: { folderId: folder.id },
    };
  },
});

export const moveToFolderTool = defineTool({
  name: 'move_to_folder',
  description: 'Move a component into a folder or remove it from its current folder. Use list_folders to find available folder IDs.',
  parameters: z.object({
    componentId: z.string().describe('Component ID to move'),
    folderId: z.string().optional().describe('Folder ID to move into, or omit to remove from folder'),
  }),
  execute: async (args) => {
    const comp = library.getComponent(args.componentId);
    if (!comp) return { title: 'Move', output: `Component not found: ${args.componentId}`, error: 'Not found' };
    if (args.folderId) {
      const folder = library.getFolder(args.folderId);
      if (!folder) return { title: 'Move', output: `Folder not found: ${args.folderId}`, error: 'Not found' };
    }
    const moved = library.moveComponentToFolder(args.componentId, args.folderId || null);
    return {
      title: 'Move to Folder',
      output: moved
        ? `Moved "${comp.name}" ${args.folderId ? `to folder ${args.folderId}` : 'out of folder'}`
        : 'Move failed',
      error: moved ? undefined : 'Move failed',
    };
  },
});

export const listFolderContentsTool = defineTool({
  name: 'list_folder_contents',
  description: 'List all components in a specific folder. Returns component IDs, names, categories, and descriptions.',
  parameters: z.object({
    folderId: z.string().describe('Folder ID'),
  }),
  execute: async (args) => {
    const folder = library.getFolder(args.folderId);
    if (!folder) return { title: 'Folder Contents', output: `Folder not found: ${args.folderId}`, error: 'Not found' };
    const comps = library.getComponentsInFolder(args.folderId);
    if (comps.length === 0) {
      return { title: 'Folder Contents', output: `Folder "${folder.name}" is empty.` };
    }
    const summary = comps.map(c =>
      `[${c.id}] ${c.name} — ${c.category}${c.description ? '\n  ' + c.description.substring(0, 100) : ''}`
    ).join('\n\n');
    return { title: 'Folder Contents', output: `Folder "${folder.name}" contains ${comps.length} component(s):\n\n${summary}` };
  },
});

export const LIBRARY_TOOLS: ToolInfo[] = [
  searchLibraryTool,
  readComponentTool,
  createComponentTool,
  writeComponentFileTool,
  updateComponentTool,
  deleteComponentFileTool,
  executeCodeTool,
  askUserTool,
  verifyComponentTool,
  createTodoListTool,
  listFoldersTool,
  createFolderTool,
  moveToFolderTool,
  listFolderContentsTool,
];
