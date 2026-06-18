export enum Role {
  User = 'user',
  Assistant = 'model'
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
}

export interface UsageMetadata {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  dbConversationId?: number; // Database conversation ID
  modelId?: number; // Database model ID
}

export type ModelType = 'chat' | 'tts' | 'tts-voicedesign' | 'tts-voiceclone' | 'asr';

export function getModelType(modelId: string): ModelType {
  if (modelId === 'mimo-v2.5-tts') return 'tts';
  if (modelId === 'mimo-v2.5-tts-voicedesign') return 'tts-voicedesign';
  if (modelId === 'mimo-v2.5-tts-voiceclone') return 'tts-voiceclone';
  if (modelId === 'mimo-v2.5-asr') return 'asr';
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
}