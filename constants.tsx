import React from 'react';
import { User, Flame } from 'lucide-react';
import { GeminiModel, ModelConfig } from './types';

export const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: GeminiModel.FlashLite,
    name: "Gemini 2.5 Flash Lite",
    description: "Lightweight model for basic tasks",
    isReasoning: false,
    contextWindowSize: 10000,
  },
  {
    id: GeminiModel.Flash,
    name: "Gemini 3 Flash",
    description: "Great for everyday tasks",
    isReasoning: false,
    contextWindowSize: 10000,
  },
  {
    id: GeminiModel.Pro,
    name: "Gemini 3 Pro",
    description: "High-intelligence reasoning model",
    isReasoning: true,
    contextWindowSize: 10000,
  },
  {
    id: GeminiModel.NanoBananaPro,
    name: "Nano Banana Pro",
    description: "Multimodal reasoning for text, images & documents",
    isReasoning: true,
    contextWindowSize: 32768,
  }
];

export const CHATGPT_LOGO = (
  <Flame className="w-6 h-6 drop-shadow-[0_0_8px_rgba(var(--neon-rgb),0.8)]" strokeWidth={2} fill="currentColor" style={{ color: 'var(--neon-color)' }} />
);

export const USER_AVATAR = (
  <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center text-gray-300">
    <User size={16} strokeWidth={2} />
  </div>
);