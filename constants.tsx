import React from 'react';
import { TestTubeDiagonal, User } from 'lucide-react';
import { MiMoModel, ModelConfig } from './types';

export const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: MiMoModel.V2,
    name: "MiMo V2.5",
    description: "Fast general-purpose model",
    isReasoning: false,
    contextWindowSize: 32768,
    provider: 'mimo',
    modelType: 'chat',
  },
  {
    id: MiMoModel.V2Pro,
    name: "MiMo V2.5 Pro",
    description: "Reasoning model with thinking",
    isReasoning: true,
    contextWindowSize: 32768,
    provider: 'mimo',
    modelType: 'chat',
  },
  {
    id: 'mimo-v2.5-asr',
    name: "MiMo V2.5 ASR",
    description: "Automatic speech recognition",
    isReasoning: false,
    contextWindowSize: 32768,
    provider: 'mimo',
    modelType: 'asr',
  },
  {
    id: 'mimo-v2.5-tts',
    name: "MiMo V2.5 TTS",
    description: "Text-to-speech synthesis",
    isReasoning: false,
    contextWindowSize: 32768,
    provider: 'mimo',
    modelType: 'tts',
  },
  {
    id: 'mimo-v2.5-tts-voiceclone',
    name: "MiMo V2.5 TTS VoiceClone",
    description: "Clone a voice for text-to-speech",
    isReasoning: false,
    contextWindowSize: 32768,
    provider: 'mimo',
    modelType: 'tts-voiceclone',
  },
  {
    id: 'mimo-v2.5-tts-voicedesign',
    name: "MiMo V2.5 TTS VoiceDesign",
    description: "Design a custom voice for TTS",
    isReasoning: false,
    contextWindowSize: 32768,
    provider: 'mimo',
    modelType: 'tts-voicedesign',
  },
  {
    id: 'mimo-v2.5-direct',
    name: "MiMo V2.5 (API Key)",
    description: "Fast general-purpose model (API key)",
    isReasoning: false,
    contextWindowSize: 32768,
    provider: 'mimo-direct',
    apiModelId: MiMoModel.V2,
    modelType: 'chat',
  },
  {
    id: 'mimo-v2.5-pro-direct',
    name: "MiMo V2.5 Pro (API Key)",
    description: "Reasoning model with thinking (API key)",
    isReasoning: true,
    contextWindowSize: 32768,
    provider: 'mimo-direct',
    apiModelId: MiMoModel.V2Pro,
    modelType: 'chat',
  },
  {
    id: 'mimo-v2.5-asr-direct',
    name: "MiMo V2.5 ASR (API Key)",
    description: "Automatic speech recognition (API key)",
    isReasoning: false,
    contextWindowSize: 32768,
    provider: 'mimo-direct',
    apiModelId: 'mimo-v2.5-asr',
    modelType: 'asr',
  },
  {
    id: 'mimo-v2.5-tts-direct',
    name: "MiMo V2.5 TTS (API Key)",
    description: "Text-to-speech synthesis (API key)",
    isReasoning: false,
    contextWindowSize: 32768,
    provider: 'mimo-direct',
    apiModelId: 'mimo-v2.5-tts',
    modelType: 'tts',
  },
  {
    id: 'mimo-v2.5-tts-voiceclone-direct',
    name: "MiMo V2.5 TTS VoiceClone (API Key)",
    description: "Clone a voice for text-to-speech (API key)",
    isReasoning: false,
    contextWindowSize: 32768,
    provider: 'mimo-direct',
    apiModelId: 'mimo-v2.5-tts-voiceclone',
    modelType: 'tts-voiceclone',
  },
  {
    id: 'mimo-v2.5-tts-voicedesign-direct',
    name: "MiMo V2.5 TTS VoiceDesign (API Key)",
    description: "Design a custom voice for TTS (API key)",
    isReasoning: false,
    contextWindowSize: 32768,
    provider: 'mimo-direct',
    apiModelId: 'mimo-v2.5-tts-voicedesign',
    modelType: 'tts-voicedesign',
  },
];

export const CHATGPT_LOGO = (
  <TestTubeDiagonal size={24} />
);

export const USER_AVATAR = (
  <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center text-gray-300">
    <User size={16} strokeWidth={2} />
  </div>
);