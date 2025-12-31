import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import * as db from './database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Suppress debug warnings in development
if (isDev) {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
}

// Register protocol scheme before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-file',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true,
    },
  },
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      // allowFileAccessFromFiles: true,
    },
    autoHideMenuBar: true,
    titleBarStyle: 'default',
    backgroundColor: '#050505',
  });

  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    // Comment out dev tools to reduce console noise - open with F12 if needed
    // mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built index.html
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle app lifecycle
app.whenReady().then(async () => {
  // Register custom protocol to serve local files
  protocol.registerFileProtocol('local-file', (request, callback) => {
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''));
    callback({ path: filePath });
  });
  
  // Initialize database
  db.initDatabase();
  
  // Wait 5 seconds to ensure database is fully loaded
  console.log('⏳ Waiting for database to fully initialize...');
  // await new Promise(resolve => setTimeout(resolve, 10000));
  console.log('✅ Database ready!');
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  db.closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for API key management (more secure than storing in renderer)
ipcMain.handle('get-api-key', async () => {
  // In production, you might want to use a more secure storage like electron-store
  return process.env.GEMINI_API_KEY || '';
});

ipcMain.handle('set-api-key', async (_event, apiKey: string) => {
  process.env.GEMINI_API_KEY = apiKey;
  return true;
});

// Handle app info
ipcMain.handle('get-app-info', async () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    isDev,
  };
});

// ===== Database IPC Handlers =====

// Model operations
ipcMain.handle('db:get-models', async () => db.getModels());
ipcMain.handle('db:get-all-models', async () => db.getAllModels());
ipcMain.handle('db:get-model-by-id', async (_event, modelId: number) => db.getModelById(modelId));
ipcMain.handle('db:get-model-by-name', async (_event, name: string) => db.getModelByName(name));
ipcMain.handle('db:add-model', async (_event, model) => db.addModel(model));
ipcMain.handle('db:update-model', async (_event, modelId: number, model) => db.updateModel(modelId, model));
ipcMain.handle('db:delete-model', async (_event, modelId: number) => db.deleteModel(modelId));

// Conversation operations
ipcMain.handle('db:get-conversations', async () => db.getConversations());
ipcMain.handle('db:get-conversation-by-id', async (_event, conversationId: number) => db.getConversationById(conversationId));
ipcMain.handle('db:create-conversation', async (_event, modelId: number, title?: string) => db.createConversation(modelId, title));
ipcMain.handle('db:update-conversation', async (_event, conversationId: number, title: string) => db.updateConversation(conversationId, title));
ipcMain.handle('db:delete-conversation', async (_event, conversationId: number) => db.deleteConversation(conversationId));

// Message operations
ipcMain.handle('db:get-messages', async (_event, conversationId: number) => db.getMessages(conversationId));
ipcMain.handle('db:add-message', async (_event, message) => db.addMessage(message));
ipcMain.handle('db:delete-message', async (_event, messageId: number) => db.deleteMessage(messageId));
ipcMain.handle('db:clear-conversation-messages', async (_event, conversationId: number) => db.clearConversationMessages(conversationId));

// Database viewer operations
ipcMain.handle('db:get-stats', async () => db.getDatabaseStats());
ipcMain.handle('db:execute-query', async (_event, query: string) => {
  try {
    return { success: true, data: db.executeQuery(query) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle('db:get-all-tables', async () => db.getAllTables());
ipcMain.handle('db:get-table-schema', async (_event, tableName: string) => db.getTableSchema(tableName));

// Image saving operation
ipcMain.handle('save-generated-image', async (_event, imageData: string, mimeType: string) => {
  try {
    // Create generated_images folder in the project directory
    const projectPath = isDev ? process.cwd() : path.dirname(app.getPath('exe'));
    const imagesFolderPath = path.join(projectPath, 'generated_images');
    
    // Create folder if it doesn't exist
    if (!fs.existsSync(imagesFolderPath)) {
      fs.mkdirSync(imagesFolderPath, { recursive: true });
    }
    
    // Determine file extension from mimeType
    const extension = mimeType.split('/')[1] || 'png';
    const timestamp = Date.now();
    const filename = `image_${timestamp}.${extension}`;
    const filePath = path.join(imagesFolderPath, filename);
    
    // Convert base64 to buffer and save
    const buffer = Buffer.from(imageData, 'base64');
    fs.writeFileSync(filePath, buffer);
    
    return { success: true, path: filePath, filename };
  } catch (error: any) {
    console.error('Error saving image:', error);
    return { success: false, error: error.message };
  }
});
