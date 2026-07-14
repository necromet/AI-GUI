import { tool } from 'ai';
import { z } from 'zod';
import * as library from '../../../server/services/libraryService';
import { toolExecuteCode } from '../../../server/services/agentService';

export const searchLibraryTool = tool({
  description: 'Search the component library for reference components using natural language. Returns matching components with relevance scores and content previews.',
  inputSchema: z.object({
    query: z.string().describe('Natural language search query'),
    category: z.string().optional().describe('Optional category filter: ui-widget, template, theme'),
    topK: z.number().optional().describe('Max results to return (default 5)'),
  }),
  execute: async (args) => {
    const results = await library.searchComponents(args.query, args.topK || 5);
    const filtered = args.category ? results.filter(r => r.category === args.category) : results;
    if (filtered.length === 0) {
      return `No components found for "${args.query}".`;
    }
    const summary = filtered.map(r => {
      const filesInfo = r.files && r.files.length > 1 ? ` (${r.files.length} files)` : '';
      const desc = r.description.length > 150 ? r.description.substring(0, 150) + '...' : r.description;
      return `[${r.id}] ${r.name} — ${r.category}, ${r.contentType}${filesInfo}\n  ${desc}\n  Relevance: ${(r.score * 100).toFixed(0)}%`;
    }).join('\n\n');
    return `Found ${filtered.length} component(s):\n\n${summary}`;
  },
});

export const readComponentTool = tool({
  description: 'Read a component by ID, including all its files and metadata. Use this to inspect the current component before editing.',
  inputSchema: z.object({
    id: z.string().describe('Component ID'),
  }),
  execute: async (args) => {
    const comp = library.getComponent(args.id);
    if (!comp) return `Component not found: ${args.id}`;
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
    return header + filesSummary;
  },
});

export const createComponentTool = tool({
  description: 'Create a new component in the library. Supports multi-file components.',
  inputSchema: z.object({
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
      throw new Error('At least one file required.');
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
    return JSON.stringify({
      message: `Component created: ID: ${created.id}, Name: ${created.name}, Files: ${(created.files || []).map(f => f.filename).join(', ')}`,
      componentId: created.id,
    });
  },
});

export const writeComponentFileTool = tool({
  description: 'Write or update a single file within a component. Creates the file if it does not exist. Content must be PURE code only — no markdown, no tool call syntax.',
  inputSchema: z.object({
    componentId: z.string().describe('Component ID'),
    filename: z.string().describe('File to write (e.g. "components.tsx", "usage.tsx")'),
    content: z.string().describe('Full file content to write. Must be valid, complete code.'),
  }),
  execute: async (args) => {
    const comp = library.getComponent(args.componentId);
    if (!comp) throw new Error(`Component not found: ${args.componentId}`);
    const written = library.writeComponentFile(args.componentId, args.filename, args.content);
    return JSON.stringify({
      message: `File written: Component: ${args.componentId}, File: ${written.filename}, Size: ${args.content.length} chars`,
      componentId: args.componentId,
    });
  },
});

export const updateComponentTool = tool({
  description: 'Update component metadata (name, description, tags, category) and/or replace its files.',
  inputSchema: z.object({
    id: z.string().describe('Component ID'),
    name: z.string().optional().describe('New name'),
    description: z.string().optional().describe('New description'),
    tags: z.array(z.string()).optional().describe('New tags'),
    category: z.string().optional().describe('New category'),
  }),
  execute: async (args) => {
    const existing = library.getComponent(args.id);
    if (!existing) throw new Error(`Component not found: ${args.id}`);
    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.category !== undefined) updates.category = args.category;
    const updated = library.updateComponent(args.id, updates);
    if (!updated) throw new Error(`Failed to update: ${args.id}`);
    return `Updated: ${updated.name} (${updated.id})`;
  },
});

export const deleteComponentFileTool = tool({
  description: 'Delete a single file from a component. Prefer overwriting with write_component_file instead.',
  inputSchema: z.object({
    componentId: z.string().describe('Component ID'),
    filename: z.string().describe('Filename to delete'),
  }),
  execute: async (args) => {
    const comp = library.getComponent(args.componentId);
    if (!comp) throw new Error(`Component not found: ${args.componentId}`);
    const file = (comp.files || []).find(f => f.filename === args.filename);
    if (!file) throw new Error(`File not found: ${args.filename}`);
    library.deleteComponentFile(file.id);
    return `Deleted ${args.filename} from ${args.componentId}`;
  },
});

export const executeCodeTool = tool({
  description: 'Execute JavaScript code in a sandboxed environment. Use console.log() for output.',
  inputSchema: z.object({
    code: z.string().describe('JavaScript code to execute'),
  }),
  execute: async (args) => {
    return await toolExecuteCode(args.code);
  },
});

export const askUserTool = tool({
  description: 'Ask the user a clarifying question. Do NOT call other tools in the same response when using this.',
  inputSchema: z.object({
    question: z.string().describe('The question to ask the user'),
  }),
  execute: async (args) => {
    return JSON.stringify({ ask_user: true, question: args.question });
  },
});

export const verifyComponentTool = tool({
  description: 'Verify the component renders correctly in the preview sandbox. Triggers a live render and checks for errors.',
  inputSchema: z.object({
    componentId: z.string().describe('Component ID to verify'),
  }),
  execute: async (args) => {
    return JSON.stringify({ verify_component: true, componentId: args.componentId });
  },
});

export const createTodoListTool = tool({
  description: 'Create a structured to-do list of tasks. Call after reading files and analyzing issues. Tasks are displayed as a checklist.',
  inputSchema: z.object({
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
    return JSON.stringify({ todo_list: true, tasks });
  },
});

export const listFoldersTool = tool({
  description: 'List all library folders with their IDs, names, descriptions, and component counts. Use to find folders for organizing components.',
  inputSchema: z.object({}),
  execute: async () => {
    const folders = library.listFolders();
    if (folders.length === 0) {
      return 'No folders exist yet. Use create_folder to create one.';
    }
    const summary = folders.map(f =>
      `[${f.id}] ${f.name} — ${f.componentCount ?? 0} component(s)${f.description ? '\n  ' + f.description : ''}`
    ).join('\n\n');
    return `Found ${folders.length} folder(s):\n\n${summary}`;
  },
});

export const createFolderTool = tool({
  description: 'Create a new folder to group related components. Folders help organize the library and can be referenced by agents.',
  inputSchema: z.object({
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
    return JSON.stringify({
      message: `Folder created: ID: ${folder.id}, Name: ${folder.name}, Color: ${folder.color}`,
      folderId: folder.id,
    });
  },
});

export const moveToFolderTool = tool({
  description: 'Move a component into a folder or remove it from its current folder. Use list_folders to find available folder IDs.',
  inputSchema: z.object({
    componentId: z.string().describe('Component ID to move'),
    folderId: z.string().optional().describe('Folder ID to move into, or omit to remove from folder'),
  }),
  execute: async (args) => {
    const comp = library.getComponent(args.componentId);
    if (!comp) throw new Error(`Component not found: ${args.componentId}`);
    if (args.folderId) {
      const folder = library.getFolder(args.folderId);
      if (!folder) throw new Error(`Folder not found: ${args.folderId}`);
    }
    const moved = library.moveComponentToFolder(args.componentId, args.folderId || null);
    if (!moved) throw new Error('Move failed');
    return `Moved "${comp.name}" ${args.folderId ? `to folder ${args.folderId}` : 'out of folder'}`;
  },
});

export const listFolderContentsTool = tool({
  description: 'List all components in a specific folder. Returns component IDs, names, categories, and descriptions.',
  inputSchema: z.object({
    folderId: z.string().describe('Folder ID'),
  }),
  execute: async (args) => {
    const folder = library.getFolder(args.folderId);
    if (!folder) throw new Error(`Folder not found: ${args.folderId}`);
    const comps = library.getComponentsInFolder(args.folderId);
    if (comps.length === 0) {
      return `Folder "${folder.name}" is empty.`;
    }
    const summary = comps.map(c =>
      `[${c.id}] ${c.name} — ${c.category}${c.description ? '\n  ' + c.description.substring(0, 100) : ''}`
    ).join('\n\n');
    return `Folder "${folder.name}" contains ${comps.length} component(s):\n\n${summary}`;
  },
});

export const LIBRARY_TOOLS = {
  search_library: searchLibraryTool,
  read_component: readComponentTool,
  create_component: createComponentTool,
  write_component_file: writeComponentFileTool,
  update_component: updateComponentTool,
  delete_component_file: deleteComponentFileTool,
  execute_code: executeCodeTool,
  ask_user: askUserTool,
  verify_component: verifyComponentTool,
  create_todo_list: createTodoListTool,
  list_folders: listFoldersTool,
  create_folder: createFolderTool,
  move_to_folder: moveToFolderTool,
  list_folder_contents: listFolderContentsTool,
} as const;
