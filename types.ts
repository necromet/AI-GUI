export enum Role {
  User = 'user',
  Assistant = 'model'
}

export interface Attachment {
  data: string; // base64 data URL (images) or empty string (docs)
  mimeType: string;
  name: string;
  textContent?: string; // extracted text for document attachments
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  isThinking?: boolean;
  isSearching?: boolean;
  thinkingContent?: string;
  timestamp: number;
  messageOrder?: number;
  dbMessageId?: number;
  usageMetadata?: UsageMetadata;
  audioUrl?: string;
  annotations?: SearchAnnotation[];
  attachments?: Attachment[];
}

export interface UsageMetadata {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

export interface SearchAnnotation {
  type: 'url_citation';
  url: string;
  title: string;
  summary?: string;
  site_name?: string;
  publish_time?: string;
  logo_url?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  dbConversationId?: number; // Database conversation ID
  modelId?: number; // Database model ID
  type?: 'chat' | 'rag' | 'skema' | 'python' | 'library';
}

export type ModelType = 'chat' | 'tts' | 'tts-voicedesign' | 'tts-voiceclone' | 'asr';

export type ConversationType = 'chat' | 'rag' | 'skema' | 'python' | 'library';

export type Mode = 'selector' | 'chat' | 'rag' | 'skema' | 'python' | 'library' | 'database' | 'agent-builder';

export interface LibraryComponent {
  id: string;
  name: string;
  category: 'ui-widget' | 'template' | 'theme' | 'python';
  contentType: 'tsx' | 'ts' | 'html' | 'css' | 'js' | 'json' | 'markdown' | 'python';
  description: string;
  tags: string[];
  content: string;
  metadata?: Record<string, any>;
  thumbnail?: string;
  isGlobal: boolean;
  agentAccessible: boolean;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
  files?: LibraryComponentFile[];
}

export interface LibraryComponentFile {
  id: string;
  componentId: string;
  filename: string;
  contentType: 'tsx' | 'ts' | 'html' | 'css' | 'js' | 'json' | 'markdown' | 'python';
  content: string;
  sortOrder: number;
  isEntry: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryFolder {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  sortOrder: number;
  agentAccessible: boolean;
  createdAt: string;
  updatedAt: string;
  componentCount?: number;
}

export function getModelType(modelId: string): ModelType {
  if (modelId.includes('tts-voicedesign')) return 'tts-voicedesign';
  if (modelId.includes('tts-voiceclone')) return 'tts-voiceclone';
  if (modelId.includes('tts')) return 'tts';
  if (modelId.includes('asr')) return 'asr';
  return 'chat';
}

export enum MiMoModel {
  V2 = 'mimo-v2.5',
  V2Pro = 'mimo-v2.5-pro',
}

export interface ModelConfig {
  id: string; // Changed from enum to string to support custom model IDs
  name: string;
  description: string;
  isReasoning: boolean;
  systemInstruction?: string;
  isCustom?: boolean;
  dbModelId?: number; // Database model ID
  contextWindowSize?: number; // Database context window size
  apiKey?: string; // API key for custom models
  provider?: string; // Provider for custom models
  apiModelId?: string; // Actual model ID sent to the API (if different from id)
  maxTokens?: number; // Maximum tokens for model output
  modelType?: ModelType; // UI routing type (auto-derived from id if omitted)
  supportsThinking?: boolean; // Can toggle thinking/reasoning mode
  supportsSearch?: boolean; // Can use web search tool
  supportsVision?: boolean; // Can accept image inputs
}

// ===== Skema Types =====

export type SkemaLayout = '16:9' | '1:1' | '9:16' | '4:5' | '1.91:1' | '4:3' | '3:4' | '32:9';

export type SkemaProjectType = 'canvas' | 'html';

export interface SkemaImageRef {
  id: string;
  label: string;
  url: string;
  mimeType?: string;
}

export interface ProjectFile {
  path: string;      // e.g. "index.html", "src/App.tsx"
  content: string;
  language: string;   // 'html' | 'tsx' | 'ts' | 'css' | 'js'
  isEntry?: boolean;
}

export interface SkemaBoard {
  id: string;
  projectId: string;
  title: string;
  layout: SkemaLayout;
  generatedHtml?: string;
  designSpec?: import('./types/skemaSpec').SkemaSlideSpec;
  bgImage?: string;
  bgColor?: string;
  files?: ProjectFile[];
  activeFile?: string;  // path of the file currently shown in preview
  createdAt: number;
  updatedAt: number;
}

export interface SkemaProject {
  id: string;
  title: string;
  description?: string;
  projectType: SkemaProjectType;
  boards: SkemaBoard[];
  theme?: import('./types/skemaSpec').SkemaTheme;
  fullDesignSpec?: import('./types/skemaSpec').SkemaDesignSpec;
  createdAt: number;
  updatedAt: number;
}

// ===== Database Explorer Types =====

export interface DatabaseConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  ssl?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseConnectionInput {
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTime: number;
  error?: string;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  columnDefault: string | null;
  characterMaximumLength: number | null;
  foreignKey?: { refTable: string; refColumn: string };
}

export interface TableInfo {
  schema: string;
  name: string;
  type: 'table' | 'view';
  columns: ColumnInfo[];
  rowCount?: number | null;
}

export interface SchemaInfo {
  schemas: string[];
  tables: TableInfo[];
}