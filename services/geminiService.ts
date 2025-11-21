import { GoogleGenAI, GenerateContentStreamResult } from "@google/genai";
import { GeminiModel } from '../types';

// Initialize API Key from environment variable
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateResponseStream = async (
  modelId: GeminiModel,
  prompt: string,
  history: { role: string; content: string }[]
): Promise<GenerateContentStreamResult> => {
  
  // Filter history to map to Gemini's expected format if needed, 
  // though for simple chat, we often just send the last prompt or use ChatSession
  // Here we will use a simple stateless generation for the MVP, or construct a chat history string.
  // Better approach for "Chat" interface:
  
  const chat = ai.chats.create({
    model: modelId,
    // Convert previous messages to history format expected by SDK if persistent chat is needed.
    // For this implementation, we'll assume the UI handles history display, 
    // and we pass the context via the 'history' param to the chat creation if we wanted true multi-turn.
    // However, to keep it simple and robust with the provided prompt guidelines:
    history: history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    })),
  });

  // Add thinking config for Pro model if needed
  const config: any = {};
  if (modelId === GeminiModel.Pro) {
    // Example: give it a budget if it's a reasoning model
    config.thinkingConfig = { thinkingBudget: 4096 }; 
  }

  const result = await chat.sendMessageStream({
    message: prompt,
    config: Object.keys(config).length > 0 ? config : undefined
  });

  return result;
};
