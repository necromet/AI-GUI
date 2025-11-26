import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database name and version
const DB_NAME = 'ChatGPT_DB';
const DB_VERSION = 1;

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
      upgrade(db) {
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
export const addModel = async (name: string, description: string | null, contextWindowSize: number | null): Promise<number> => {
  const db = await getDatabase();
  const model: DBModel = {
    name,
    description,
    context_window_size: contextWindowSize,
    active: true
  };
  return await db.add('models', model);
};

/**
 * Update a model
 */
export const updateModel = async (modelId: number, name: string, description: string | null, contextWindowSize: number | null): Promise<void> => {
  const db = await getDatabase();
  const model = await db.get('models', modelId);
  if (model) {
    model.name = name;
    model.description = description;
    model.context_window_size = contextWindowSize;
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
}

/**
 * Add a message to a conversation
 */
export const addMessage = async (
  conversationId: number, 
  role: 'user' | 'assistant' | 'system', 
  content: string, 
  messageOrder: number,
  tokenCount: number | null = null
): Promise<number> => {
  const db = await getDatabase();
  const message: DBMessage = {
    conversation_id: conversationId,
    role,
    content,
    message_order: messageOrder,
    timestamp: new Date().toISOString(),
    token_count: tokenCount
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
