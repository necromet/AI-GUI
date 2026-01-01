import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database name and version
const DB_NAME = 'ChatGPT_DB';
const DB_VERSION = 2;

// IndexedDB Schema
interface ChatGPTDB extends DBSchema {
  models: {
    key: number;
    value: DBModel;
    indexes: { 'by-name': string };
  };
  conversations: {
    key: number;
    value: DBConversation;
    indexes: { 'by-updated': string };
  };
  messages: {
    key: number;
    value: DBMessage;
    indexes: { 'by-conversation': number; 'by-conversation-order': [number, number] };
  };
}

let dbInstance: IDBPDatabase<ChatGPTDB> | null = null;

/**
 * Get or create the database connection
 */
export const getDatabase = async (): Promise<IDBPDatabase<ChatGPTDB>> => {
  if (!dbInstance) {
    dbInstance = await openDB<ChatGPTDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion) {
        // Create Models store
        if (!db.objectStoreNames.contains('models')) {
          const modelStore = db.createObjectStore('models', { 
            keyPath: 'model_id', 
            autoIncrement: true 
          });
          modelStore.createIndex('by-name', 'name', { unique: true });
        }

        // Create Conversations store
        if (!db.objectStoreNames.contains('conversations')) {
          const convStore = db.createObjectStore('conversations', { 
            keyPath: 'conversation_id', 
            autoIncrement: true 
          });
          convStore.createIndex('by-updated', 'updated_at');
        }

        // Create Messages store
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { 
            keyPath: 'message_id', 
            autoIncrement: true 
          });
          msgStore.createIndex('by-conversation', 'conversation_id');
          msgStore.createIndex('by-conversation-order', ['conversation_id', 'message_order'], { unique: true });
        }

        // Migration for version 2: Add support for generated_images
        // Note: IndexedDB allows flexible schemas, so existing records will simply have undefined for the new field
        if (oldVersion < 2) {
          console.log('Migrating database to version 2 (adding generated_images support)');
        }
      },
    });

    // Initialize default model
    await initializeDefaultModel();
  }
  return dbInstance;
};

/**
 * Initialize default model if it doesn't exist
 */
const initializeDefaultModel = async () => {
  const existingModel = await getModelByName('gemini-2.5-flash-preview-09-2025');
  
  if (!existingModel) {
    await addModel('gemini-2.5-flash-preview-09-2025', 'Google\'s fast and versatile model.', 1000000);
  }
};

// ===== Model Operations =====

export interface DBModel {
  model_id?: number;
  name: string;
  description: string | null;
  context_window_size: number | null;
  active: boolean;
  api_key?: string | null;
  provider?: string | null;
  system_instruction?: string | null;
  is_custom?: boolean;
}

/**
 * Get all active models
 */
export const getModels = async (): Promise<DBModel[]> => {
  const db = await getDatabase();
  const allModels = await db.getAll('models');
  return allModels.filter(m => m.active);
};

/**
 * Get a model by ID
 */
export const getModelById = async (modelId: number): Promise<DBModel | undefined> => {
  const db = await getDatabase();
  return await db.get('models', modelId);
};

/**
 * Get a model by name
 */
export const getModelByName = async (name: string): Promise<DBModel | undefined> => {
  const db = await getDatabase();
  const index = db.transaction('models').store.index('by-name');
  return await index.get(name);
};

/**
 * Add a new model
 */
export const addModel = async (
  name: string, 
  description: string | null, 
  contextWindowSize: number | null,
  apiKey?: string | null,
  provider?: string | null,
  systemInstruction?: string | null,
  isCustom?: boolean
): Promise<number> => {
  const db = await getDatabase();
  const model: DBModel = {
    name,
    description,
    context_window_size: contextWindowSize,
    active: true,
    api_key: apiKey,
    provider: provider,
    system_instruction: systemInstruction,
    is_custom: isCustom
  };
  return await db.add('models', model);
};

/**
 * Update a model
 */
export const updateModel = async (
  modelId: number, 
  name: string, 
  description: string | null, 
  contextWindowSize: number | null,
  apiKey?: string | null,
  provider?: string | null,
  systemInstruction?: string | null,
  isCustom?: boolean
): Promise<void> => {
  const db = await getDatabase();
  const model = await db.get('models', modelId);
  if (model) {
    model.name = name;
    model.description = description;
    model.context_window_size = contextWindowSize;
    model.api_key = apiKey;
    model.provider = provider;
    model.system_instruction = systemInstruction;
    model.is_custom = isCustom;
    await db.put('models', model);
  }
};

/**
 * Deactivate a model (soft delete)
 */
export const deactivateModel = async (modelId: number): Promise<void> => {
  const db = await getDatabase();
  const model = await db.get('models', modelId);
  if (model) {
    model.active = false;
    await db.put('models', model);
  }
};

// ===== Conversation Operations =====

export interface DBConversation {
  conversation_id?: number;
  title: string | null;
  model_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new conversation
 */
export const createConversation = async (modelId: number, title: string | null = null): Promise<number> => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const conversation: DBConversation = {
    title,
    model_id: modelId,
    created_at: now,
    updated_at: now
  };
  return await db.add('conversations', conversation);
};

/**
 * Get all conversations ordered by most recent
 */
export const getConversations = async (): Promise<DBConversation[]> => {
  const db = await getDatabase();
  const conversations = await db.getAll('conversations');
  return conversations.sort((a, b) => 
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
};

/**
 * Get a conversation by ID
 */
export const getConversationById = async (conversationId: number): Promise<DBConversation | undefined> => {
  const db = await getDatabase();
  return await db.get('conversations', conversationId);
};

/**
 * Update conversation title
 */
export const updateConversationTitle = async (conversationId: number, title: string): Promise<void> => {
  const db = await getDatabase();
  const conversation = await db.get('conversations', conversationId);
  if (conversation) {
    conversation.title = title;
    conversation.updated_at = new Date().toISOString();
    await db.put('conversations', conversation);
  }
};

/**
 * Delete a conversation (and all its messages manually since IndexedDB doesn't have CASCADE)
 */
export const deleteConversation = async (conversationId: number): Promise<void> => {
  const db = await getDatabase();
  
  // Delete all messages for this conversation
  const messages = await getMessagesByConversation(conversationId);
  const tx = db.transaction('messages', 'readwrite');
  for (const msg of messages) {
    if (msg.message_id) {
      await tx.store.delete(msg.message_id);
    }
  }
  await tx.done;
  
  // Delete the conversation
  await db.delete('conversations', conversationId);
};

// ===== Message Operations =====

export interface DBMessage {
  message_id?: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_order: number;
  timestamp: string;
  token_count: number | null;
  prompt_tokens?: number | null;
  candidates_tokens?: number | null;
  generated_images?: string | null; // JSON string of array of {id, data, mimeType}
}

/**
 * Add a message to a conversation
 */
export const addMessage = async (
  conversationId: number, 
  role: 'user' | 'assistant' | 'system', 
  content: string, 
  messageOrder: number,
  tokenCount: number | null = null,
  generatedImages?: Array<{ id: string; data: string; mimeType: string }> | null,
  promptTokens?: number | null,
  candidatesTokens?: number | null
): Promise<number> => {
  const db = await getDatabase();
  const message: DBMessage = {
    conversation_id: conversationId,
    role,
    content,
    message_order: messageOrder,
    timestamp: new Date().toISOString(),
    token_count: tokenCount,
    prompt_tokens: promptTokens || null,
    candidates_tokens: candidatesTokens || null,
    generated_images: generatedImages ? JSON.stringify(generatedImages) : null
  };
  
  // Update conversation's updated_at timestamp
  const conversation = await db.get('conversations', conversationId);
  if (conversation) {
    conversation.updated_at = new Date().toISOString();
    await db.put('conversations', conversation);
  }
  
  return await db.add('messages', message);
};

/**
 * Get all messages for a conversation
 */
export const getMessagesByConversation = async (conversationId: number): Promise<DBMessage[]> => {
  const db = await getDatabase();
  const index = db.transaction('messages').store.index('by-conversation');
  const messages = await index.getAll(conversationId);
  return messages.sort((a, b) => a.message_order - b.message_order);
};

/**
 * Update message content
 */
export const updateMessage = async (messageId: number, content: string, tokenCount: number | null = null): Promise<void> => {
  const db = await getDatabase();
  const message = await db.get('messages', messageId);
  if (message) {
    message.content = content;
    message.token_count = tokenCount;
    await db.put('messages', message);
  }
};

/**
 * Delete a message
 */
export const deleteMessage = async (messageId: number): Promise<void> => {
  const db = await getDatabase();
  await db.delete('messages', messageId);
};

/**
 * Get the next message order for a conversation
 */
export const getNextMessageOrder = async (conversationId: number): Promise<number> => {
  const messages = await getMessagesByConversation(conversationId);
  if (messages.length === 0) return 1;
  const maxOrder = Math.max(...messages.map(m => m.message_order));
  return maxOrder + 1;
};

/**
 * Close the database connection
 */
export const closeDatabase = async (): Promise<void> => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
};

// ===== Token Usage Statistics =====

export interface TokenUsageStats {
  totalTokens: number;
  promptTokens: number;
  candidatesTokens: number;
  messageCount: number;
  conversationCount: number;
}

export interface TokenUsageByModel {
  modelName: string;
  totalTokens: number;
  promptTokens: number;
  candidatesTokens: number;
  messageCount: number;
}

export interface TokenUsageByDate {
  date: string; // ISO date string (YYYY-MM-DD)
  totalTokens: number;
  promptTokens: number;
  candidatesTokens: number;
  messageCount: number;
}

export interface TokenUsageByConversation {
  conversationId: number;
  conversationTitle: string;
  totalTokens: number;
  promptTokens: number;
  candidatesTokens: number;
  messageCount: number;
  updatedAt: string;
}

/**
 * Get overall token usage statistics
 */
export const getOverallTokenStats = async (): Promise<TokenUsageStats> => {
  const db = await getDatabase();
  const messages = await db.getAll('messages');
  
  let totalTokens = 0;
  let promptTokens = 0;
  let candidatesTokens = 0;
  let messageCount = 0;
  
  messages.forEach(msg => {
    if (msg.token_count) {
      totalTokens += msg.token_count;
      messageCount++;
    }
    if (msg.prompt_tokens) {
      promptTokens += msg.prompt_tokens;
    }
    if (msg.candidates_tokens) {
      candidatesTokens += msg.candidates_tokens;
    }
  });
  
  const conversations = await db.getAll('conversations');
  
  return {
    totalTokens,
    promptTokens,
    candidatesTokens,
    messageCount,
    conversationCount: conversations.length
  };
};

/**
 * Get token usage grouped by model
 */
export const getTokenStatsByModel = async (): Promise<TokenUsageByModel[]> => {
  const db = await getDatabase();
  const conversations = await db.getAll('conversations');
  const messages = await db.getAll('messages');
  const models = await db.getAll('models');
  
  // Create a map of conversation_id to model_id
  const convToModel = new Map<number, number>();
  conversations.forEach(conv => {
    convToModel.set(conv.conversation_id!, conv.model_id);
  });
  
  // Create a map of model_id to model name
  const modelIdToName = new Map<number, string>();
  models.forEach(model => {
    modelIdToName.set(model.model_id!, model.name);
  });
  
  // Aggregate token usage by model
  const modelStats = new Map<string, TokenUsageByModel>();
  
  messages.forEach(msg => {
    const modelId = convToModel.get(msg.conversation_id);
    if (!modelId) return;
    
    const modelName = modelIdToName.get(modelId) || 'Unknown Model';
    
    if (!modelStats.has(modelName)) {
      modelStats.set(modelName, {
        modelName,
        totalTokens: 0,
        promptTokens: 0,
        candidatesTokens: 0,
        messageCount: 0
      });
    }
    
    const stats = modelStats.get(modelName)!;
    if (msg.token_count) {
      stats.totalTokens += msg.token_count;
      stats.messageCount++;
    }
    if (msg.prompt_tokens) {
      stats.promptTokens += msg.prompt_tokens;
    }
    if (msg.candidates_tokens) {
      stats.candidatesTokens += msg.candidates_tokens;
    }
  });
  
  return Array.from(modelStats.values()).sort((a, b) => b.totalTokens - a.totalTokens);
};

/**
 * Get token usage grouped by date
 */
export const getTokenStatsByDate = async (days: number = 30): Promise<TokenUsageByDate[]> => {
  const db = await getDatabase();
  const messages = await db.getAll('messages');
  
  const dateStats = new Map<string, TokenUsageByDate>();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  messages.forEach(msg => {
    const msgDate = new Date(msg.timestamp);
    if (msgDate < cutoffDate) return;
    
    const dateKey = msgDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!dateStats.has(dateKey)) {
      dateStats.set(dateKey, {
        date: dateKey,
        totalTokens: 0,
        promptTokens: 0,
        candidatesTokens: 0,
        messageCount: 0
      });
    }
    
    const stats = dateStats.get(dateKey)!;
    if (msg.token_count) {
      stats.totalTokens += msg.token_count;
      stats.messageCount++;
    }
    if (msg.prompt_tokens) {
      stats.promptTokens += msg.prompt_tokens;
    }
    if (msg.candidates_tokens) {
      stats.candidatesTokens += msg.candidates_tokens;
    }
  });
  
  return Array.from(dateStats.values()).sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Get token usage grouped by conversation
 */
export const getTokenStatsByConversation = async (limit: number = 20): Promise<TokenUsageByConversation[]> => {
  const db = await getDatabase();
  const conversations = await db.getAll('conversations');
  const messages = await db.getAll('messages');
  
  // Group messages by conversation
  const convMessages = new Map<number, DBMessage[]>();
  messages.forEach(msg => {
    if (!convMessages.has(msg.conversation_id)) {
      convMessages.set(msg.conversation_id, []);
    }
    convMessages.get(msg.conversation_id)!.push(msg);
  });
  
  const convStats: TokenUsageByConversation[] = [];
  
  conversations.forEach(conv => {
    const msgs = convMessages.get(conv.conversation_id!) || [];
    
    let totalTokens = 0;
    let promptTokens = 0;
    let candidatesTokens = 0;
    let messageCount = 0;
    
    msgs.forEach(msg => {
      if (msg.token_count) {
        totalTokens += msg.token_count;
        messageCount++;
      }
      if (msg.prompt_tokens) {
        promptTokens += msg.prompt_tokens;
      }
      if (msg.candidates_tokens) {
        candidatesTokens += msg.candidates_tokens;
      }
    });
    
    if (totalTokens > 0) {
      convStats.push({
        conversationId: conv.conversation_id!,
        conversationTitle: conv.title || 'Untitled Conversation',
        totalTokens,
        promptTokens,
        candidatesTokens,
        messageCount,
        updatedAt: conv.updated_at
      });
    }
  });
  
  // Sort by total tokens descending and limit results
  return convStats.sort((a, b) => b.totalTokens - a.totalTokens).slice(0, limit);
};

