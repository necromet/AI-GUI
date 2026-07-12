export enum Role {
  User = 'user',
  Assistant = 'model'
}

export interface Attachment {
  data: string; // base64 data URL (data:image/png;base64,...)
  mimeType: string;
  name: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  isThinking?: boolean;
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
  type?: 'chat' | 'rag' | 'plugin-agent' | 'stitch' | 'library';
}

export type ModelType = 'chat' | 'tts' | 'tts-voicedesign' | 'tts-voiceclone' | 'asr';

export type ConversationType = 'chat' | 'rag' | 'plugin-agent' | 'stitch' | 'library';

export type Mode = 'selector' | 'chat' | 'experiments' | 'library';

export interface LibraryComponent {
  id: string;
  name: string;
  category: 'ui-widget' | 'template' | 'theme';
  contentType: 'tsx' | 'ts' | 'html' | 'css' | 'js' | 'json' | 'markdown';
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
  contentType: 'tsx' | 'ts' | 'html' | 'css' | 'js' | 'json' | 'markdown';
  content: string;
  sortOrder: number;
  isEntry: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryComponentWithScore extends LibraryComponent {
  score: number;
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
}

// ===== Stitch Types =====

export type StitchLayout = '16:9' | '1:1' | '9:16' | '4:5' | '1.91:1' | '4:3' | '3:4' | '32:9';

export type StitchProjectType = 'website' | 'ig-carousel' | 'ig-story';

export interface StitchImageRef {
  id: string;
  label: string;
  url: string;
  mimeType?: string;
}

export interface StitchBoard {
  id: string;
  projectId: string;
  title: string;
  layout: StitchLayout;
  generatedHtml?: string;
  designSpec?: import('./types/stitchSpec').StitchSlideSpec;
  bgImage?: string;
  bgColor?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StitchProject {
  id: string;
  title: string;
  description?: string;
  projectType: StitchProjectType;
  boards: StitchBoard[];
  theme?: import('./types/stitchSpec').StitchTheme;
  fullDesignSpec?: import('./types/stitchSpec').StitchDesignSpec;
  createdAt: number;
  updatedAt: number;
}