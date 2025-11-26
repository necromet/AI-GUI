export enum Role {
  User = 'user',
  Assistant = 'model'
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  isThinking?: boolean; // For model thinking state
  timestamp: number;
  messageOrder?: number; // Database message order
  dbMessageId?: number; // Database message ID
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  dbConversationId?: number; // Database conversation ID
  modelId?: number; // Database model ID
}

export enum GeminiModel {
  Flash = 'gemini-2.5-flash',
  Pro = 'gemini-3-pro-preview', // Reasoning model
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
}