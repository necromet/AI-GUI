// Global type definitions for Electron API

interface ElectronAPI {
  // API Key management
  getApiKey: () => Promise<string>;
  setApiKey: (apiKey: string) => Promise<boolean>;
  
  // App info
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
  executeQuery: (query: string) => Promise<{ success: boolean; data?: any; error?: string }>;;
  getAllTables: () => Promise<string[]>;
  getTableSchema: (tableName: string) => Promise<any[]>;
}

interface Window {
  electron: ElectronAPI;
  electronAPI: ElectronAPI;
}
