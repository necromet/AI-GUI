import { GoogleGenAI } from "@google/genai";
import { GeminiModel } from '../types';

// Initialize API Key from environment variable
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export interface ImageGenConfig {
  aspectRatio?: string;
  imageSize?: '1K' | '2K' | '4K';
}

export interface GroundingConfig {
  enabled: boolean;
  dynamicRetrievalThreshold?: number;
}

export const generateResponseStream = async (
  modelId: string,
  prompt: string,
  history: { role: string; content: string }[],
  systemInstruction?: string,
  imageParts?: Array<{ inlineData: { data: string; mimeType: string } }>,
  imageGenConfig?: ImageGenConfig,
  groundingConfig?: GroundingConfig
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

  // Add grounding with Google Search
  if (groundingConfig?.enabled) {
    config.tools = [
      {
        googleSearch: {},
      },
    ];
    
    // Optionally configure dynamic retrieval threshold (0.0 to 1.0)
    if (groundingConfig.dynamicRetrievalThreshold !== undefined) {
      config.toolConfig = {
        functionCallingConfig: {
          mode: 'AUTO',
        },
      };
    }
    
    console.log('Grounding config enabled with Google Search');
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

export const generateChatTitle = async (
  userMessage: string,
  assistantResponse: string
): Promise<string> => {
  try {
    // Use Gemini 2.5 Flash Lite for generating concise chat titles
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash-lite',
      config: {
        systemInstruction: 'You are a helpful assistant that generates concise, descriptive titles for conversations. Create a title that is 3-7 words long and captures the main topic of the conversation. Do not use quotes or punctuation except hyphens. Return only the title text.'
      }
    });

    const prompt = `Based on this conversation, generate a short, descriptive title (3-7 words):\n\nUser: ${userMessage.substring(0, 200)}\n\nAssistant: ${assistantResponse.substring(0, 200)}`;
    
    const result = await chat.sendMessageStream({ message: prompt });
    
    let title = '';
    for await (const chunk of result) {
      title += chunk.text;
    }
    
    // Clean up the title
    title = title.trim().replace(/["']/g, '');
    
    // Fallback if title is too long or empty
    if (!title || title.length > 100) {
      return userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');
    }
    
    return title;
  } catch (error) {
    console.error('Error generating chat title:', error);
    // Fallback to simple title generation
    return userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');
  }
};