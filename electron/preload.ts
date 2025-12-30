import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // API Key management
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  setApiKey: (apiKey: string) => ipcRenderer.invoke('set-api-key', apiKey),
  
  // App info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // Database operations - Models
  getModels: () => ipcRenderer.invoke('db:get-models'),
  getAllModels: () => ipcRenderer.invoke('db:get-all-models'),
  getModelById: (modelId: number) => ipcRenderer.invoke('db:get-model-by-id', modelId),
  getModelByName: (name: string) => ipcRenderer.invoke('db:get-model-by-name', name),
  addModel: (model: any) => ipcRenderer.invoke('db:add-model', model),
  updateModel: (modelId: number, model: any) => ipcRenderer.invoke('db:update-model', modelId, model),
  deleteModel: (modelId: number) => ipcRenderer.invoke('db:delete-model', modelId),
  
  // Database operations - Conversations
  getConversations: () => ipcRenderer.invoke('db:get-conversations'),
  getConversationById: (conversationId: number) => ipcRenderer.invoke('db:get-conversation-by-id', conversationId),
  createConversation: (modelId: number, title?: string) => ipcRenderer.invoke('db:create-conversation', modelId, title),
  updateConversation: (conversationId: number, title: string) => ipcRenderer.invoke('db:update-conversation', conversationId, title),
  deleteConversation: (conversationId: number) => ipcRenderer.invoke('db:delete-conversation', conversationId),
  
  // Database operations - Messages
  getMessages: (conversationId: number) => ipcRenderer.invoke('db:get-messages', conversationId),
  addMessage: (message: any) => ipcRenderer.invoke('db:add-message', message),
  deleteMessage: (messageId: number) => ipcRenderer.invoke('db:delete-message', messageId),
  clearConversationMessages: (conversationId: number) => ipcRenderer.invoke('db:clear-conversation-messages', conversationId),
  
  // Database viewer operations
  getDatabaseStats: () => ipcRenderer.invoke('db:get-stats'),
  executeQuery: (query: string) => ipcRenderer.invoke('db:execute-query', query),
  getAllTables: () => ipcRenderer.invoke('db:get-all-tables'),
  getTableSchema: (tableName: string) => ipcRenderer.invoke('db:get-table-schema', tableName),
});

// Type definitions for the exposed API
export interface ElectronAPI {
  getApiKey: () => Promise<string>;
  setApiKey: (apiKey: string) => Promise<boolean>;
  getAppInfo: () => Promise<{ name: string; version: string; isDev: boolean }>;
  
  // Models
  getModels: () => Promise<any[]>;
  getAllModels: () => Promise<any[]>;
  getModelById: (modelId: number) => Promise<any>;
  getModelByName: (name: string) => Promise<any>;
  addModel: (model: any) => Promise<number>;
  updateModel: (modelId: number, model: any) => Promise<void>;
  deleteModel: (modelId: number) => Promise<void>;
  
  // Conversations
  getConversations: () => Promise<any[]>;
  getConversationById: (conversationId: number) => Promise<any>;
  createConversation: (modelId: number, title?: string) => Promise<number>;
  updateConversation: (conversationId: number, title: string) => Promise<void>;
  deleteConversation: (conversationId: number) => Promise<void>;
  
  // Messages
  getMessages: (conversationId: number) => Promise<any[]>;
  addMessage: (message: any) => Promise<number>;
  deleteMessage: (messageId: number) => Promise<void>;
  clearConversationMessages: (conversationId: number) => Promise<void>;
  
  // Database viewer
  getDatabaseStats: () => Promise<any>;
  executeQuery: (query: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getAllTables: () => Promise<string[]>;
  getTableSchema: (tableName: string) => Promise<any[]>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
