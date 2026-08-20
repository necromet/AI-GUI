import { cacheFetch, cacheInvalidate, cacheInvalidatePrefix } from './cacheService';

const API_BASE = '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }
  return response.json();
}

export const getDatabase = async () => {
  await apiFetch<any>('/health');
};

export const getModels = async () => {
  return cacheFetch('models', async () => {
    const data = await apiFetch<{ models: any[] }>('/models');
    return data.models;
  });
};

export const getAllModels = async () => {
  return cacheFetch('models:all', async () => {
    const data = await apiFetch<{ models: any[] }>('/models/all');
    return data.models;
  });
};

export const getModelById = async (modelId: number) => {
  return cacheFetch(`model:${modelId}`, async () => {
    const data = await apiFetch<{ model: any }>(`/models/${modelId}`);
    return data.model;
  });
};

export const getModelByName = async (name: string) => {
  const models = await getModels();
  return models.find((m: any) => m.name === name);
};

export const addModel = async (
  name: string,
  description: string | null,
  contextWindowSize: number | null,
  apiKey?: string | null,
  provider?: string | null,
  systemInstruction?: string | null,
  isCustom?: boolean
) => {
  const data = await apiFetch<{ id: number }>('/models', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      context_window_size: contextWindowSize,
      api_key: apiKey,
      provider,
      system_instruction: systemInstruction,
      is_custom: isCustom,
    }),
  });
  cacheInvalidatePrefix('models');
  cacheInvalidatePrefix('model:');
  return data.id;
};

export const updateModel = async (
  modelId: number,
  updates: {
    name?: string;
    description?: string;
    context_window_size?: number;
    active?: boolean;
    api_key?: string;
    provider?: string;
    system_instruction?: string;
  }
) => {
  await apiFetch<any>(`/models/${modelId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  cacheInvalidatePrefix('models');
  cacheInvalidate(`model:${modelId}`);
};

export const deleteModel = async (modelId: number) => {
  await deactivateModel(modelId);
};

export const deactivateModel = async (modelId: number) => {
  await apiFetch<any>(`/models/${modelId}`, { method: 'DELETE' });
  cacheInvalidatePrefix('models');
  cacheInvalidate(`model:${modelId}`);
};

export const getConversations = async () => {
  return cacheFetch('conversations', async () => {
    const data = await apiFetch<{ conversations: any[] }>('/conversations');
    return data.conversations;
  });
};

export const getConversationsByType = async (type: 'chat' | 'rag' | 'skema' | 'python') => {
  return cacheFetch(`conversations:${type}`, async () => {
    const data = await apiFetch<{ conversations: any[] }>(`/conversations?type=${type}`);
    return data.conversations;
  });
};

export const getConversationById = async (conversationId: number) => {
  return cacheFetch(`conversation:${conversationId}`, async () => {
    const data = await apiFetch<{ conversation: any }>(`/conversations/${conversationId}`);
    return data.conversation;
  });
};

export const createConversation = async (modelId: number, title?: string | null, type?: 'chat' | 'rag' | 'skema' | 'python') => {
  const data = await apiFetch<{ id: number }>('/conversations', {
    method: 'POST',
    body: JSON.stringify({ model_id: modelId, title: title || null, type: type || 'chat' }),
  });
  cacheInvalidate('conversations');
  cacheInvalidatePrefix('conversations:');
  return data.id;
};

export const updateConversation = async (conversationId: number, title: string) => {
  await updateConversationTitle(conversationId, title);
};

export const updateConversationTitle = async (conversationId: number, title: string) => {
  await apiFetch<any>(`/conversations/${conversationId}`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
  });
  cacheInvalidate('conversations');
  cacheInvalidatePrefix('conversations:');
  cacheInvalidate(`conversation:${conversationId}`);
};

export const deleteConversation = async (conversationId: number) => {
  await apiFetch<any>(`/conversations/${conversationId}`, { method: 'DELETE' });
  cacheInvalidate('conversations');
  cacheInvalidatePrefix('conversations:');
  cacheInvalidate(`conversation:${conversationId}`);
  cacheInvalidate(`messages:${conversationId}`);
};

export const getMessagesByConversation = async (conversationId: number) => {
  return cacheFetch(`messages:${conversationId}`, async () => {
    const data = await apiFetch<{ messages: any[] }>(`/db/conversations/${conversationId}/messages`);
    return data.messages;
  });
};

export const addMessage = async (
  conversationId: number,
  role: 'user' | 'assistant' | 'system' | 'model',
  content: string,
  messageOrder: number,
  tokenCount?: number | null,
  generatedImages?: Array<{ id: string; data: string; mimeType: string }> | null,
  promptTokens?: number | null,
  candidatesTokens?: number | null,
  searchAnnotations?: any[] | null,
  attachments?: string | null
) => {
  const data = await apiFetch<{ id: number }>(`/db/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      role,
      content,
      message_order: messageOrder,
      token_count: tokenCount,
      generated_images: generatedImages ? JSON.stringify(generatedImages) : null,
      prompt_tokens: promptTokens,
      candidates_tokens: candidatesTokens,
      search_annotations: searchAnnotations ? (typeof searchAnnotations === 'string' ? searchAnnotations : JSON.stringify(searchAnnotations)) : null,
      attachments,
    }),
  });
  cacheInvalidate(`messages:${conversationId}`);
  cacheInvalidate('conversations');
  cacheInvalidatePrefix('conversations:');
  cacheInvalidatePrefix('stats:');
  return data.id;
};

export const deleteMessage = async (messageId: number) => {
  await apiFetch<any>(`/db/messages/${messageId}`, { method: 'DELETE' });
  cacheInvalidatePrefix('messages:');
  cacheInvalidatePrefix('stats:');
};

export const clearConversationMessages = async (conversationId: number) => {
  const messages = await getMessagesByConversation(conversationId);
  for (const msg of messages) {
    if (msg.id) {
      await deleteMessage(msg.id);
    }
  }
  cacheInvalidate(`messages:${conversationId}`);
};

export const getNextMessageOrder = async (conversationId: number): Promise<number> => {
  const data = await apiFetch<{ nextOrder: number }>(`/db/conversations/${conversationId}/next-order`);
  return data.nextOrder;
};

export const getOverallTokenStats = async () => {
  return cacheFetch('stats:overall', async () => {
    return await apiFetch<any>('/stats/overall');
  });
};

export const getTokenStatsByModel = async () => {
  return cacheFetch('stats:models', async () => {
    const data = await apiFetch<{ stats: any[] }>('/stats/by-model');
    return data.stats;
  });
};

export const getTokenStatsByDate = async (days: number = 30) => {
  return cacheFetch(`stats:dates:${days}`, async () => {
    const data = await apiFetch<{ stats: any[] }>(`/stats/by-date?days=${days}`);
    return data.stats;
  });
};

export const getTokenStatsByConversation = async (limit: number = 20) => {
  return cacheFetch(`stats:conversations:${limit}`, async () => {
    const data = await apiFetch<{ stats: any[] }>(`/stats/by-conversation?limit=${limit}`);
    return data.stats;
  });
};

export const getSkemaProjects = async () => {
  return cacheFetch('skema:projects', async () => {
    const data = await apiFetch<{ projects: any[] }>('/skema/projects');
    return data.projects;
  });
};

export const getSkemaProject = async (id: string) => {
  return cacheFetch(`skema:project:${id}`, async () => {
    const data = await apiFetch<{ project: any }>(`/skema/projects/${id}`);
    return data.project;
  });
};

export const saveSkemaProject = async (project: {
  id: string;
  title: string;
  description?: string;
  projectType?: string;
  boards: any[];
  theme?: any;
  fullDesignSpec?: any;
  createdAt: number;
  updatedAt: number;
}) => {
  await apiFetch<any>(`/skema/projects/${project.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: project.title,
      description: project.description,
      project_type: project.projectType || 'canvas',
      boards_json: JSON.stringify(project.boards),
      theme_json: project.theme ? JSON.stringify(project.theme) : null,
      full_design_spec_json: project.fullDesignSpec ? JSON.stringify(project.fullDesignSpec) : null,
      created_at: new Date(project.createdAt).toISOString(),
      updated_at: new Date(project.updatedAt).toISOString(),
    }),
  });
  cacheInvalidate('skema:projects');
  cacheInvalidate(`skema:project:${project.id}`);
};

export const deleteSkemaProject = async (id: string) => {
  await apiFetch<any>(`/skema/projects/${id}`, { method: 'DELETE' });
  cacheInvalidate('skema:projects');
  cacheInvalidate(`skema:project:${id}`);
};

// ===== Python Projects =====

export interface PythonProjectFile {
  filename: string;
  content: string;
  isEntry: boolean;
}

export interface PythonProject {
  id: string;
  title: string;
  description: string;
  files: PythonProjectFile[];
  settings: { requirements?: string[] } | null;
  createdAt: string;
  updatedAt: string;
}

export const getPythonProjects = async (): Promise<PythonProject[]> => {
  return cacheFetch('python:projects', async () => {
    const data = await apiFetch<{ projects: PythonProject[] }>('/python/projects');
    return data.projects;
  });
};

export const getPythonProject = async (id: string): Promise<PythonProject> => {
  return cacheFetch(`python:project:${id}`, async () => {
    const data = await apiFetch<{ project: PythonProject }>(`/python/projects/${id}`);
    return data.project;
  });
};

export const createPythonProject = async (title: string, files?: PythonProjectFile[]): Promise<PythonProject> => {
  const data = await apiFetch<{ project: PythonProject }>('/python/projects', {
    method: 'POST',
    body: JSON.stringify({ title, files: files || [{ filename: 'main.py', content: '', isEntry: true }] }),
  });
  cacheInvalidate('python:projects');
  return data.project;
};

export const savePythonProject = async (project: {
  id: string;
  title: string;
  description?: string;
  files: PythonProjectFile[];
  settings?: { requirements?: string[] } | null;
}): Promise<PythonProject> => {
  const data = await apiFetch<{ project: PythonProject }>(`/python/projects/${project.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: project.title,
      description: project.description,
      files: project.files,
      settings: project.settings,
    }),
  });
  cacheInvalidate('python:projects');
  cacheInvalidate(`python:project:${project.id}`);
  return data.project;
};

export const deletePythonProject = async (id: string) => {
  await apiFetch<any>(`/python/projects/${id}`, { method: 'DELETE' });
  cacheInvalidate('python:projects');
  cacheInvalidate(`python:project:${id}`);
};

// ===== Library Components =====

export const getLibraryComponents = async (params?: URLSearchParams) => {
  const key = `library:components:${params?.toString() || ''}`;
  return cacheFetch(key, async () => {
    const qs = params ? `?${params}` : '';
    const response = await fetch(`${API_BASE}/library/components${qs}`);
    if (!response.ok) throw new Error('Failed to load components');
    const data = await response.json();
    return data.components || [];
  });
};

export const getLibraryFolders = async () => {
  return cacheFetch('library:folders', async () => {
    const response = await fetch(`${API_BASE}/library/folders`);
    if (!response.ok) throw new Error('Failed to load folders');
    const data = await response.json();
    return data.folders || [];
  });
};

export const invalidateLibraryCache = () => {
  cacheInvalidatePrefix('library:');
};

// ===== Skema Components =====

export const getSkemaComponents = async (params?: URLSearchParams) => {
  const key = `skema:components:${params?.toString() || ''}`;
  return cacheFetch(key, async () => {
    const qs = params ? `?${params}` : '';
    const response = await fetch(`${API_BASE}/skema/components${qs}`);
    if (!response.ok) throw new Error('Failed to load components');
    const data = await response.json();
    return data.components || [];
  });
};

export const invalidateSkemaComponentsCache = () => {
  cacheInvalidatePrefix('skema:components:');
};

// ===== Agent Tools =====

export const getAvailableToolsCached = async () => {
  return cacheFetch('agent:tools', async () => {
    const response = await fetch(`${API_BASE}/skema-agent/tools`);
    if (!response.ok) throw new Error(`Tools error ${response.status}`);
    const data = await response.json();
    return data.tools || [];
  }, 300_000);
};

// ===== Database Explorer =====

export const getDbConnections = async () => {
  const data = await apiFetch<{ connections: any[] }>('/database/connections');
  return data.connections;
};

export const getDbConnection = async (id: string) => {
  const data = await apiFetch<{ connection: any }>(`/database/connections/${id}`);
  return data.connection;
};

export const saveDbConnection = async (conn: {
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}) => {
  const data = await apiFetch<{ id: string }>('/database/connections', {
    method: 'POST',
    body: JSON.stringify(conn),
  });
  return data.id;
};

export const updateDbConnection = async (id: string, updates: {
  name?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}) => {
  await apiFetch<any>(`/database/connections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
};

export const deleteDbConnection = async (id: string) => {
  await apiFetch<any>(`/database/connections/${id}`, { method: 'DELETE' });
};

export const testDbConnection = async (conn: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}) => {
  return await apiFetch<{ success: boolean; version?: string; error?: string }>('/database/test', {
    method: 'POST',
    body: JSON.stringify(conn),
  });
};

export const getDbSchema = async (connectionId: string) => {
  return await apiFetch<{ schemas: string[]; tables: any[] }>('/database/schema', {
    method: 'POST',
    body: JSON.stringify({ connectionId }),
  });
};

export const executeDbQuery = async (connectionId: string, sql: string, maxRows?: number, force?: boolean, timeout?: number) => {
  return await apiFetch<{ columns: string[]; rows: any[][]; rowCount: number; executionTime: number; error?: string; needsConfirmation?: boolean; warning?: string; truncated?: boolean }>('/database/query', {
    method: 'POST',
    body: JSON.stringify({ connectionId, sql, maxRows, force, timeout }),
  });
};

export const releaseDbPool = async (connectionId: string) => {
  await apiFetch<any>(`/database/connections/${connectionId}/pool`, { method: 'DELETE' });
};

export const pingDbConnection = async (connectionId: string) => {
  return await apiFetch<{ reachable: boolean; error?: string }>(`/database/connections/${connectionId}/ping`, {
    method: 'POST',
  });
};

// ===== Notes =====

export const getNotes = async () => {
  return cacheFetch('notes:tree', async () => {
    const data = await apiFetch<{ notes: any[] }>('/notes');
    return data.notes;
  });
};

export const getNotesFlat = async () => {
  return cacheFetch('notes:flat', async () => {
    const data = await apiFetch<{ notes: any[] }>('/notes/flat');
    return data.notes;
  });
};

export const getNote = async (id: string) => {
  const data = await apiFetch<{ note: any }>(`/notes/${id}`);
  return data.note;
};

export const createNote = async (title?: string, icon?: string, parentId?: string | null, blocks?: any[]) => {
  const data = await apiFetch<{ note: any }>('/notes', {
    method: 'POST',
    body: JSON.stringify({ title, icon, parentId, blocks }),
  });
  cacheInvalidatePrefix('notes:');
  return data.note;
};

export const saveNote = async (id: string, updates: {
  title?: string;
  icon?: string;
  coverUrl?: string;
  parentId?: string | null;
  sortOrder?: number;
  blocks?: any[];
  isFavorite?: boolean;
}) => {
  const data = await apiFetch<{ note: any }>(`/notes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  cacheInvalidatePrefix('notes:');
  return data.note;
};

export const deleteNote = async (id: string) => {
  await apiFetch<any>(`/notes/${id}`, { method: 'DELETE' });
  cacheInvalidatePrefix('notes:');
};

export const moveNote = async (id: string, parentId: string | null, sortOrder?: number) => {
  const data = await apiFetch<{ note: any }>(`/notes/${id}/move`, {
    method: 'PUT',
    body: JSON.stringify({ parentId, sortOrder }),
  });
  cacheInvalidatePrefix('notes:');
  return data.note;
};

export const reorderNotes = async (order: { id: string; sortOrder: number }[]) => {
  await apiFetch<any>('/notes/batch/reorder', {
    method: 'PUT',
    body: JSON.stringify({ order }),
  });
  cacheInvalidatePrefix('notes:');
};
