import { GoogleGenAI } from "@google/genai";
import { GeminiModel } from '../types';

// Initialize API Key from environment variable
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export interface ImageGenConfig {
  aspectRatio?: string;
  imageSize?: '1K' | '2K' | '4K';
}

export const generateResponseStream = async (
  modelId: string,
  prompt: string,
  history: { role: string; content: string }[],
  systemInstruction?: string,
  imageParts?: Array<{ inlineData: { data: string; mimeType: string } }>,
  imageGenConfig?: ImageGenConfig
) => {
  
  // Add thinking config for reasoning models
  const config: any = {};
  
  // Check if it's a known reasoning model or just rely on the ID passed
  if (modelId.includes('pro') || modelId.includes('reasoning')) {
    // Example: give it a budget if it's a reasoning model, but only for supported models
    if (modelId === GeminiModel.Pro || modelId === GeminiModel.NanoBananaPro) {
       config.thinkingConfig = { thinkingBudget: 1024 }; 
    }
  }
  
  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }

  // Add image generation configuration only for Nano Banana Pro model
  if (imageGenConfig && modelId === GeminiModel.NanoBananaPro) {
    // Set response modalities to include IMAGE for image generation
    config.responseModalities = ['TEXT', 'IMAGE'];
    
    // Configure image settings
    config.imageConfig = {
      aspectRatio: imageGenConfig.aspectRatio || '1:1',
      imageSize: imageGenConfig.imageSize || '1K',
    };
    console.log('Image generation config:', config.imageConfig);
  }

  console.log('Full config being sent to Gemini:', config);

  const chat = ai.chats.create({
    model: modelId,
    history: history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    })),
    config: Object.keys(config).length > 0 ? config : undefined
  });

  // Build message parts
  const messageParts: any[] = [];
  if (imageParts && imageParts.length > 0) {
    messageParts.push(...imageParts);
  }
  if (prompt) {
    messageParts.push({ text: prompt });
  }

  const result = await chat.sendMessageStream({
    message: messageParts.length > 0 ? messageParts : prompt,
  });

  return result;
};