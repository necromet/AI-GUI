import { GoogleGenAI, GenerateContentStreamResult } from "@google/genai";
import { GeminiModel } from '../types';

// Initialize API Key from environment variable
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateResponseStream = async (
  modelId: string,
  prompt: string,
  history: { role: string; content: string }[],
  systemInstruction?: string
): Promise<GenerateContentStreamResult> => {
  
  // Add thinking config for Pro model if needed
  const config: any = {};
  
  // Check if it's a known reasoning model or just rely on the ID passed
  if (modelId.includes('pro') || modelId.includes('reasoning')) {
    // Example: give it a budget if it's a reasoning model, but only for supported models
    if (modelId === GeminiModel.Pro) {
       config.thinkingConfig = { thinkingBudget: 4096 }; 
    }
  }
  
  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }

  const chat = ai.chats.create({
    model: modelId,
    history: history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    })),
    config: Object.keys(config).length > 0 ? config : undefined
  });

  const result = await chat.sendMessageStream({
    message: prompt,
  });

  return result;
};