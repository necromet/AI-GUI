import * as idbService from './databaseService';

// ===== Model Operations =====

export const getModels = async () => {
  return await idbService.getModels();
};

export const getAllModels = async () => {
  const db = await idbService.getDatabase();
  return await db.getAll('models');
};

export const getModelById = async (modelId: number) => {
  return await idbService.getModelById(modelId);
};

export const getModelByName = async (name: string) => {
  return await idbService.getModelByName(name);
};

export const addModel = async (
  name: string,
  description: string | null,
  contextWindowSize: number | null,
  _apiKey?: string | null,
  _provider?: string | null,
  _systemInstruction?: string | null,
  _isCustom?: boolean
) => {
  return await idbService.addModel(name, description, contextWindowSize);
};

export const updateModel = async (
  _modelId: number,
  _updates: {
    name?: string;
    description?: string;
    context_window_size?: number;
    active?: boolean;
    api_key?: string;
    provider?: string;
    system_instruction?: string;
  }
) => {
  throw new Error('Model updates not supported in web mode');
};

export const deleteModel = async (modelId: number) => {
  return await idbService.deactivateModel(modelId);
};

export const deactivateModel = async (modelId: number) => {
  return await idbService.deactivateModel(modelId);
};

// ===== Conversation Operations =====

export const getConversations = async () => {
  return await idbService.getConversations();
};

export const getConversationById = async (conversationId: number) => {
  return await idbService.getConversationById(conversationId);
};

export const createConversation = async (modelId: number, title?: string | null) => {
  return await idbService.createConversation(modelId, title || null);
};

export const updateConversation = async (conversationId: number, title: string) => {
  return await idbService.updateConversationTitle(conversationId, title);
};

export const updateConversationTitle = async (conversationId: number, title: string) => {
  return await idbService.updateConversationTitle(conversationId, title);
};

export const deleteConversation = async (conversationId: number) => {
  return await idbService.deleteConversation(conversationId);
};

// ===== Message Operations =====

export const getMessagesByConversation = async (conversationId: number) => {
  return await idbService.getMessagesByConversation(conversationId);
};

export const addMessage = async (
  conversationId: number,
  role: 'user' | 'assistant' | 'system' | 'model',
  content: string,
  messageOrder: number,
  tokenCount?: number,
  generatedImages?: Array<{ id: string; data: string; mimeType: string }> | null,
  promptTokens?: number,
  candidatesTokens?: number,
  searchAnnotations?: any[] | null,
  attachments?: string | null
) => {
  const idbRole = role === 'model' ? 'assistant' : role;
  return await idbService.addMessage(conversationId, idbRole, content, messageOrder, tokenCount, generatedImages, promptTokens, candidatesTokens, searchAnnotations, attachments);
};

export const deleteMessage = async (messageId: number) => {
  return await idbService.deleteMessage(messageId);
};

export const clearConversationMessages = async (conversationId: number) => {
  const messages = await idbService.getMessagesByConversation(conversationId);
  for (const msg of messages) {
    if (msg.message_id) {
      await idbService.deleteMessage(msg.message_id);
    }
  }
};

// ===== Helper Functions =====

export const getNextMessageOrder = async (conversationId: number): Promise<number> => {
  return await idbService.getNextMessageOrder(conversationId);
};

export const getDatabase = async () => {
  return await idbService.getDatabase();
};

// ===== Token Usage Statistics =====

export const getOverallTokenStats = async () => {
  return await idbService.getOverallTokenStats();
};

export const getTokenStatsByModel = async () => {
  return await idbService.getTokenStatsByModel();
};

export const getTokenStatsByDate = async (days: number = 30) => {
  return await idbService.getTokenStatsByDate(days);
};

export const getTokenStatsByConversation = async (limit: number = 20) => {
  return await idbService.getTokenStatsByConversation(limit);
};
