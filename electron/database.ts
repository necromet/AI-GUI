import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import * as fs from 'fs';

let db: Database.Database | null = null;
let dbPath: string = '';

export function initDatabase() {
  try {
    // Use user data directory for the database (works with AppImages and packaged apps)
    const projectPath = app.isPackaged 
      ? app.getPath('userData')
      : process.cwd();
    dbPath = path.join(projectPath, 'chat.db');
    
    console.log('Initializing database at:', dbPath);
    
    // Create database connection
    db = new Database(dbPath);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Create tables if they don't exist
    createTables();
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('Database closed');
  }
}

function createTables() {
  if (!db) throw new Error('Database not initialized');
  
  // Create Models table
  db.exec(`
    CREATE TABLE IF NOT EXISTS Models (
      model_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      context_window_size INTEGER,
      active BOOLEAN NOT NULL DEFAULT 1,
      api_key TEXT,
      provider TEXT,
      system_instruction TEXT,
      is_custom BOOLEAN DEFAULT 0
    )
  `);
  
  // Create Conversations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS Conversations (
      conversation_id INTEGER PRIMARY KEY,
      title TEXT,
      model_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (model_id) REFERENCES Models(model_id)
    )
  `);
  
  // Create trigger for updating updated_at
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_conversations_updated_at
    AFTER UPDATE ON Conversations
    FOR EACH ROW
    BEGIN
      UPDATE Conversations SET updated_at = CURRENT_TIMESTAMP WHERE conversation_id = NEW.conversation_id;
    END
  `);
  
  // Create Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS Messages (
      message_id INTEGER PRIMARY KEY,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'model')),
      content TEXT NOT NULL,
      message_order INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      token_count INTEGER,
      FOREIGN KEY (conversation_id) REFERENCES Conversations(conversation_id) ON DELETE CASCADE
    )
  `);
  
  // Create unique index for message order
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_order ON Messages (conversation_id, message_order)
  `);
  
  // Insert default model if it doesn't exist
  const defaultModel = db.prepare('SELECT * FROM Models WHERE name = ?').get('gemini-2.5-flash-preview-09-2025');
  if (!defaultModel) {
    db.prepare(`
      INSERT INTO Models (name, description, context_window_size) 
      VALUES (?, ?, ?)
    `).run('gemini-2.5-flash-preview-09-2025', "Google's fast and versatile model.", 1000000);
  }
}

// ===== Model Operations =====

export function getModels() {
  if (!db) throw new Error('Database not initialized');
  return db.prepare('SELECT * FROM Models WHERE active = 1 ORDER BY model_id').all();
}

export function getAllModels() {
  if (!db) throw new Error('Database not initialized');
  return db.prepare('SELECT * FROM Models ORDER BY model_id').all();
}

export function getModelById(modelId: number) {
  if (!db) throw new Error('Database not initialized');
  return db.prepare('SELECT * FROM Models WHERE model_id = ?').get(modelId);
}

export function getModelByName(name: string) {
  if (!db) throw new Error('Database not initialized');
  return db.prepare('SELECT * FROM Models WHERE name = ?').get(name);
}

export function addModel(model: {
  name: string;
  description?: string;
  context_window_size?: number;
  api_key?: string;
  provider?: string;
  system_instruction?: string;
  is_custom?: boolean;
}) {
  if (!db) throw new Error('Database not initialized');
  const result = db.prepare(`
    INSERT INTO Models (name, description, context_window_size, api_key, provider, system_instruction, is_custom)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    model.name,
    model.description || null,
    model.context_window_size || null,
    model.api_key || null,
    model.provider || null,
    model.system_instruction || null,
    model.is_custom ? 1 : 0
  );
  return result.lastInsertRowid;
}

export function updateModel(modelId: number, model: {
  name?: string;
  description?: string;
  context_window_size?: number;
  active?: boolean;
  api_key?: string;
  provider?: string;
  system_instruction?: string;
}) {
  if (!db) throw new Error('Database not initialized');
  const updates: string[] = [];
  const values: any[] = [];
  
  if (model.name !== undefined) {
    updates.push('name = ?');
    values.push(model.name);
  }
  if (model.description !== undefined) {
    updates.push('description = ?');
    values.push(model.description);
  }
  if (model.context_window_size !== undefined) {
    updates.push('context_window_size = ?');
    values.push(model.context_window_size);
  }
  if (model.active !== undefined) {
    updates.push('active = ?');
    values.push(model.active ? 1 : 0);
  }
  if (model.api_key !== undefined) {
    updates.push('api_key = ?');
    values.push(model.api_key);
  }
  if (model.provider !== undefined) {
    updates.push('provider = ?');
    values.push(model.provider);
  }
  if (model.system_instruction !== undefined) {
    updates.push('system_instruction = ?');
    values.push(model.system_instruction);
  }
  
  if (updates.length === 0) return;
  
  values.push(modelId);
  db.prepare(`UPDATE Models SET ${updates.join(', ')} WHERE model_id = ?`).run(...values);
}

export function deleteModel(modelId: number) {
  if (!db) throw new Error('Database not initialized');
  db.prepare('DELETE FROM Models WHERE model_id = ?').run(modelId);
}

// ===== Conversation Operations =====

export function getConversations() {
  if (!db) throw new Error('Database not initialized');
  return db.prepare(`
    SELECT c.*, m.name as model_name
    FROM Conversations c
    JOIN Models m ON c.model_id = m.model_id
    ORDER BY c.updated_at DESC
  `).all();
}

export function getConversationById(conversationId: number) {
  if (!db) throw new Error('Database not initialized');
  return db.prepare(`
    SELECT c.*, m.name as model_name
    FROM Conversations c
    JOIN Models m ON c.model_id = m.model_id
    WHERE c.conversation_id = ?
  `).get(conversationId);
}

export function createConversation(modelId: number, title?: string) {
  if (!db) throw new Error('Database not initialized');
  const result = db.prepare(`
    INSERT INTO Conversations (model_id, title)
    VALUES (?, ?)
  `).run(modelId, title || null);
  return result.lastInsertRowid;
}

export function updateConversation(conversationId: number, title: string) {
  if (!db) throw new Error('Database not initialized');
  db.prepare('UPDATE Conversations SET title = ? WHERE conversation_id = ?').run(title, conversationId);
}

export function deleteConversation(conversationId: number) {
  if (!db) throw new Error('Database not initialized');
  db.prepare('DELETE FROM Conversations WHERE conversation_id = ?').run(conversationId);
}

// ===== Message Operations =====

export function getMessages(conversationId: number) {
  if (!db) throw new Error('Database not initialized');
  return db.prepare(`
    SELECT * FROM Messages
    WHERE conversation_id = ?
    ORDER BY message_order ASC
  `).all(conversationId);
}

export function addMessage(message: {
  conversation_id: number;
  role: string;
  content: string;
  message_order: number;
  token_count?: number;
}) {
  if (!db) throw new Error('Database not initialized');
  const result = db.prepare(`
    INSERT INTO Messages (conversation_id, role, content, message_order, token_count)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    message.conversation_id,
    message.role,
    message.content,
    message.message_order,
    message.token_count || null
  );
  return result.lastInsertRowid;
}

export function deleteMessage(messageId: number) {
  if (!db) throw new Error('Database not initialized');
  db.prepare('DELETE FROM Messages WHERE message_id = ?').run(messageId);
}

export function clearConversationMessages(conversationId: number) {
  if (!db) throw new Error('Database not initialized');
  db.prepare('DELETE FROM Messages WHERE conversation_id = ?').run(conversationId);
}

// ===== Database Viewer Operations =====

export function getDatabaseStats() {
  if (!db) throw new Error('Database not initialized');
  const stats = {
    models: db.prepare('SELECT COUNT(*) as count FROM Models').get() as { count: number },
    conversations: db.prepare('SELECT COUNT(*) as count FROM Conversations').get() as { count: number },
    messages: db.prepare('SELECT COUNT(*) as count FROM Messages').get() as { count: number },
  };
  
  // Get database file size
  let databaseSize = 0;
  try {
    const stat = fs.statSync(dbPath);
    databaseSize = stat.size;
  } catch (error) {
    console.error('Error getting database size:', error);
  }
  
  return {
    models: stats.models.count,
    conversations: stats.conversations.count,
    messages: stats.messages.count,
    databaseSize,
    databasePath: dbPath,
  };
}

export function executeQuery(query: string) {
  if (!db) throw new Error('Database not initialized');
  // Only allow SELECT queries for safety
  if (!query.trim().toUpperCase().startsWith('SELECT')) {
    throw new Error('Only SELECT queries are allowed');
  }
  return db.prepare(query).all();
}

export function getAllTables() {
  if (!db) throw new Error('Database not initialized');
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `).all() as { name: string }[];
  return tables.map(t => t.name);
}

export function getTableSchema(tableName: string) {
  if (!db) throw new Error('Database not initialized');
  return db.prepare(`PRAGMA table_info(${tableName})`).all();
}


