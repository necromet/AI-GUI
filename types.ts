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
  type?: 'chat' | 'rag' | 'plugin-agent' | 'stitch';
}

export type ModelType = 'chat' | 'tts' | 'tts-voicedesign' | 'tts-voiceclone' | 'asr';

export type ConversationType = 'chat' | 'rag' | 'plugin-agent' | 'stitch';

export type Mode = 'selector' | 'chat' | 'experiments';

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

export type StitchLayout = '16:9' | '1:1' | '9:16';

export interface StitchBoard {
  id: string;
  projectId: string;
  title: string;
  layout: StitchLayout;
  generatedHtml?: string;
  bgImage?: string;
  bgColor?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StitchProject {
  id: string;
  title: string;
  description?: string;
  boards: StitchBoard[];
  createdAt: number;
  updatedAt: number;
}