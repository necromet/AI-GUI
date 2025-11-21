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
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export enum GeminiModel {
  Flash = 'gemini-2.5-flash',
  Pro = 'gemini-3-pro-preview', // Reasoning model
}

export interface ModelConfig {
  id: GeminiModel;
  name: string;
  description: string;
  isReasoning: boolean;
}