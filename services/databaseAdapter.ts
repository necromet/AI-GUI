/**
 * Database Adapter
 * 
 * This adapter layer detects whether the app is running in Electron or web mode
 * and routes database calls to the appropriate implementation:
 * - Electron: Uses SQLite via window.electron IPC
 * - Web: Uses IndexedDB via databaseService
 */

import * as idbService from './databaseService';

// Check if running in Electron - must be a function to check at runtime, not at module load time
const isElectron = () => typeof window !== 'undefined' && window.electron !== undefined;

// ===== Model Operations =====

export const getModels = async () => {
  if (isElectron()) {
    return await window.electron.getModels();
  }
  return await idbService.getModels();
};

export const getAllModels = async () => {
  if (isElectron()) {
    return await window.electron.getAllModels();
  }
  // In IndexedDB, get all models including inactive ones
  const db = await idbService.getDatabase();
  return await db.getAll('models');
};

export const getModelById = async (modelId: number) => {
  if (isElectron()) {
    return await window.electron.getModelById(modelId);
  }
  return await idbService.getModelById(modelId);
};

export const getModelByName = async (name: string) => {
  if (isElectron()) {
    return await window.electron.getModelByName(name);
  }
  return await idbService.getModelByName(name);
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
  if (isElectron()) {
    return await window.electron.addModel({
      name,
      description,
      context_window_size: contextWindowSize,
      api_key: apiKey,
      provider,
      system_instruction: systemInstruction,
      is_custom: isCustom
    });
  }
  return await idbService.addModel(name, description, contextWindowSize);
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
  if (isElectron()) {
    return await window.electron.updateModel(modelId, updates);
  }
  // IndexedDB doesn't support model updates in the same way
  throw new Error('Model updates not supported in web mode');
};

export const deleteModel = async (modelId: number) => {
  if (isElectron()) {
    return await window.electron.deleteModel(modelId);
  }
  return await idbService.deactivateModel(modelId);
};

export const deactivateModel = async (modelId: number) => {
  if (isElectron()) {
    // In SQLite, we can use the active flag
    return await window.electron.updateModel(modelId, { active: false });
  }
  return await idbService.deactivateModel(modelId);
};

// ===== Conversation Operations =====

export const getConversations = async () => {
  if (isElectron()) {
    return await window.electron.getConversations();
  }
  return await idbService.getConversations();
};

export const getConversationById = async (conversationId: number) => {
  if (isElectron()) {
    return await window.electron.getConversationById(conversationId);
  }
  return await idbService.getConversationById(conversationId);
};

export const createConversation = async (modelId: number, title?: string | null) => {
  if (isElectron()) {
    return await window.electron.createConversation(modelId, title);
  }
  return await idbService.createConversation(modelId, title || null);
};

export const updateConversation = async (conversationId: number, title: string) => {
  if (isElectron()) {
    return await window.electron.updateConversation(conversationId, title);
  }
  return await idbService.updateConversationTitle(conversationId, title);
};

export const updateConversationTitle = async (conversationId: number, title: string) => {
  if (isElectron()) {
    return await window.electron.updateConversation(conversationId, title);
  }
  return await idbService.updateConversationTitle(conversationId, title);
};

export const deleteConversation = async (conversationId: number) => {
  if (isElectron()) {
    return await window.electron.deleteConversation(conversationId);
  }
  return await idbService.deleteConversation(conversationId);
};

// ===== Message Operations =====

export const getMessagesByConversation = async (conversationId: number) => {
  if (isElectron()) {
    return await window.electron.getMessages(conversationId);
  }
  return await idbService.getMessagesByConversation(conversationId);
};

export const addMessage = async (
  conversationId: number,
  role: 'user' | 'assistant' | 'system' | 'model',
  content: string,
  messageOrder: number,
  tokenCount?: number
) => {
  if (isElectron()) {
    return await window.electron.addMessage({
      conversation_id: conversationId,
      role,
      content,
      message_order: messageOrder,
      token_count: tokenCount
    });
  }
  // Map 'model' role to 'assistant' for IndexedDB storage
  const idbRole = role === 'model' ? 'assistant' : role;
  return await idbService.addMessage(conversationId, idbRole, content, messageOrder);
};

export const deleteMessage = async (messageId: number) => {
  if (isElectron()) {
    return await window.electron.deleteMessage(messageId);
  }
  return await idbService.deleteMessage(messageId);
};

export const clearConversationMessages = async (conversationId: number) => {
  if (isElectron()) {
    return await window.electron.clearConversationMessages(conversationId);
  }
  // IndexedDB doesn't have this direct method, need to get and delete individually
  const messages = await idbService.getMessagesByConversation(conversationId);
  for (const msg of messages) {
    if (msg.message_id) {
      await idbService.deleteMessage(msg.message_id);
    }
  }
};

// ===== Helper Functions =====

export const getNextMessageOrder = async (conversationId: number): Promise<number> => {
  if (isElectron()) {
    const messages = await window.electron.getMessages(conversationId);
    return messages.length > 0 
      ? Math.max(...messages.map((m: any) => m.message_order)) + 1 
      : 0;
  }
  return await idbService.getNextMessageOrder(conversationId);
};

export const getDatabase = async () => {
  if (isElectron()) {
    // In Electron mode, database is already initialized
    return null;
  }
  return await idbService.getDatabase();
};
