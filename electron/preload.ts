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
  
  // Token usage statistics
  getOverallTokenStats: () => ipcRenderer.invoke('db:get-overall-token-stats'),
  getTokenStatsByModel: () => ipcRenderer.invoke('db:get-token-stats-by-model'),
  getTokenStatsByDate: (days: number) => ipcRenderer.invoke('db:get-token-stats-by-date', days),
  getTokenStatsByConversation: (limit: number) => ipcRenderer.invoke('db:get-token-stats-by-conversation', limit),
  
  // Image operations
  saveGeneratedImage: (imageData: string, mimeType: string) => ipcRenderer.invoke('save-generated-image', imageData, mimeType),
});
