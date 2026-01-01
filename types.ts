export enum Role {
  User = 'user',
  Assistant = 'model'
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  isThinking?: boolean; // For model thinking state
  thinkingContent?: string; // Thinking process content for reasoning models
  isGeneratingImage?: boolean; // For image generation state
  imageGenerationProgress?: number; // Progress percentage (0-100)
  timestamp: number;
  messageOrder?: number; // Database message order
  dbMessageId?: number; // Database message ID
  images?: Array<{ id: string; data: string; mimeType: string }>; // Base64 image data
  groundingMetadata?: GroundingMetadata; // Grounding metadata from web search
  usageMetadata?: UsageMetadata; // Token usage information
}

export interface GroundingMetadata {
  webSearchQueries?: string[];
  searchResults?: Array<{
    url: string;
    title?: string;
    snippet?: string;
  }>;
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

export enum GeminiModel {
  FlashLite = 'gemini-2.5-flash-lite',
  Flash = 'gemini-3-flash-preview',
  Pro = 'gemini-3-pro-preview', // Reasoning model
  NanoBananaPro = 'gemini-3-pro-image-preview' // Multimodal reasoning model
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