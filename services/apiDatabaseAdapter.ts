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
  const data = await apiFetch<{ models: any[] }>('/models');
  return data.models;
};

export const getAllModels = async () => {
  const data = await apiFetch<{ models: any[] }>('/models/all');
  return data.models;
};

export const getModelById = async (modelId: number) => {
  const data = await apiFetch<{ model: any }>(`/models/${modelId}`);
  return data.model;
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
};

export const deleteModel = async (modelId: number) => {
  await deactivateModel(modelId);
};

export const deactivateModel = async (modelId: number) => {
  await apiFetch<any>(`/models/${modelId}`, { method: 'DELETE' });
};

export const getConversations = async () => {
  const data = await apiFetch<{ conversations: any[] }>('/conversations');
  return data.conversations;
};

export const getConversationsByType = async (type: 'chat' | 'rag' | 'plugin-agent' | 'skema') => {
  const data = await apiFetch<{ conversations: any[] }>(`/conversations?type=${type}`);
  return data.conversations;
};

export const getConversationById = async (conversationId: number) => {
  const data = await apiFetch<{ conversation: any }>(`/conversations/${conversationId}`);
  return data.conversation;
};

export const createConversation = async (modelId: number, title?: string | null, type?: 'chat' | 'rag' | 'plugin-agent' | 'skema') => {
  const data = await apiFetch<{ id: number }>('/conversations', {
    method: 'POST',
    body: JSON.stringify({ model_id: modelId, title: title || null, type: type || 'chat' }),
  });
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
};

export const deleteConversation = async (conversationId: number) => {
  await apiFetch<any>(`/conversations/${conversationId}`, { method: 'DELETE' });
};

export const getMessagesByConversation = async (conversationId: number) => {
  const data = await apiFetch<{ messages: any[] }>(`/db/conversations/${conversationId}/messages`);
  return data.messages;
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
  return data.id;
};

export const deleteMessage = async (messageId: number) => {
  await apiFetch<any>(`/db/messages/${messageId}`, { method: 'DELETE' });
};

export const clearConversationMessages = async (conversationId: number) => {
  const messages = await getMessagesByConversation(conversationId);
  for (const msg of messages) {
    if (msg.id) {
      await deleteMessage(msg.id);
    }
  }
};

export const getNextMessageOrder = async (conversationId: number): Promise<number> => {
  const data = await apiFetch<{ nextOrder: number }>(`/db/conversations/${conversationId}/next-order`);
  return data.nextOrder;
};

export const getOverallTokenStats = async () => {
  return await apiFetch<any>('/stats/overall');
};

export const getTokenStatsByModel = async () => {
  const data = await apiFetch<{ stats: any[] }>('/stats/by-model');
  return data.stats;
};

export const getTokenStatsByDate = async (days: number = 30) => {
  const data = await apiFetch<{ stats: any[] }>(`/stats/by-date?days=${days}`);
  return data.stats;
};

export const getTokenStatsByConversation = async (limit: number = 20) => {
  const data = await apiFetch<{ stats: any[] }>(`/stats/by-conversation?limit=${limit}`);
  return data.stats;
};

export const getSkemaProjects = async () => {
  const data = await apiFetch<{ projects: any[] }>('/skema/projects');
  return data.projects;
};

export const getSkemaProject = async (id: string) => {
  const data = await apiFetch<{ project: any }>(`/skema/projects/${id}`);
  return data.project;
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
};

export const deleteSkemaProject = async (id: string) => {
  await apiFetch<any>(`/skema/projects/${id}`, { method: 'DELETE' });
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
  const data = await apiFetch<{ projects: PythonProject[] }>('/python/projects');
  return data.projects;
};

export const getPythonProject = async (id: string): Promise<PythonProject> => {
  const data = await apiFetch<{ project: PythonProject }>(`/python/projects/${id}`);
  return data.project;
};

export const createPythonProject = async (title: string, files?: PythonProjectFile[]): Promise<PythonProject> => {
  const data = await apiFetch<{ project: PythonProject }>('/python/projects', {
    method: 'POST',
    body: JSON.stringify({ title, files: files || [{ filename: 'main.py', content: '', isEntry: true }] }),
  });
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
  return data.project;
};

export const deletePythonProject = async (id: string) => {
  await apiFetch<any>(`/python/projects/${id}`, { method: 'DELETE' });
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
