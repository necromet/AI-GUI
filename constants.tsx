import React from 'react';
import { TestTubeDiagonal } from 'lucide-react';
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
    supportsThinking: true,
    supportsSearch: true,
    supportsVision: true,
  },
  {
    id: MiMoModel.V2Pro,
    name: "MiMo V2.5 Pro",
    description: "Reasoning model with thinking",
    isReasoning: true,
    contextWindowSize: 32768,
    provider: 'mimo',
    modelType: 'chat',
    supportsThinking: true,
    supportsSearch: true,
    supportsVision: false,
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
    supportsThinking: true,
    supportsSearch: true,
    supportsVision: true,
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
    supportsThinking: true,
    supportsSearch: true,
    supportsVision: false,
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
  {
    id: 'deepseek-chat',
    name: "DeepSeek Chat",
    description: "Fast general-purpose chat model",
    isReasoning: false,
    contextWindowSize: 65536,
    provider: 'deepseek',
    modelType: 'chat',
    supportsThinking: true,
    supportsSearch: false,
    supportsVision: false,
  },
  {
    id: 'deepseek-reasoner',
    name: "DeepSeek Reasoner",
    description: "Deep reasoning model with thinking",
    isReasoning: true,
    contextWindowSize: 65536,
    provider: 'deepseek',
    modelType: 'chat',
    supportsThinking: true,
    supportsSearch: false,
    supportsVision: false,
  },
  {
    id: 'deepseek-v4-flash',
    name: "DeepSeek V4 Flash",
    description: "Fast next-gen model for quick responses",
    isReasoning: false,
    contextWindowSize: 65536,
    provider: 'deepseek',
    modelType: 'chat',
    supportsThinking: true,
    supportsSearch: false,
    supportsVision: true,
  },
  {
    id: 'deepseek-v4-pro',
    name: "DeepSeek V4 Pro",
    description: "Powerful next-gen reasoning model",
    isReasoning: true,
    contextWindowSize: 65536,
    provider: 'deepseek',
    modelType: 'chat',
    supportsThinking: true,
    supportsSearch: false,
    supportsVision: false,
  },
];

export const CHAT_MODELS = DEFAULT_MODELS.filter(m => m.modelType === 'chat');

export const CHATGPT_LOGO = (
  <TestTubeDiagonal size={24} />
);

export interface NeonVariant { rgb: string; tailwind: string }
export interface NeonPresetDef {
  id: string;
  name: string;
  primary: { dark: NeonVariant; light: NeonVariant };
  secondary: { dark: NeonVariant; light: NeonVariant };
  accent: { dark: NeonVariant; light: NeonVariant };
}

const v = (r: number, g: number, b: number): NeonVariant => ({ rgb: `${r}, ${g}, ${b}`, tailwind: `rgb(${r}, ${g}, ${b})` });

export const NEON_PRESETS: NeonPresetDef[] = [
  {
    id: 'cyber', name: 'Cyber',
    primary:   { dark: v(248,113,113), light: v(180,40,40) },
    secondary: { dark: v(34,211,238),  light: v(10,120,150) },
    accent:    { dark: v(192,132,252), light: v(100,50,170) },
  },
  {
    id: 'ocean', name: 'Ocean',
    primary:   { dark: v(96,165,250),  light: v(30,80,170) },
    secondary: { dark: v(45,212,191),  light: v(15,120,105) },
    accent:    { dark: v(34,211,238),  light: v(10,120,150) },
  },
  {
    id: 'sunset', name: 'Sunset',
    primary:   { dark: v(251,146,60),  light: v(190,80,15) },
    secondary: { dark: v(244,114,182), light: v(170,40,100) },
    accent:    { dark: v(250,204,21),  light: v(180,130,0) },
  },
  {
    id: 'forest', name: 'Forest',
    primary:   { dark: v(74,222,128),  light: v(22,120,60) },
    secondary: { dark: v(163,230,53),  light: v(100,150,10) },
    accent:    { dark: v(45,212,191),  light: v(15,120,105) },
  },
  {
    id: 'ember', name: 'Ember',
    primary:   { dark: v(251,113,133), light: v(180,40,55) },
    secondary: { dark: v(251,146,60),  light: v(190,80,15) },
    accent:    { dark: v(250,204,21),  light: v(180,130,0) },
  },
];

export interface ThemePresetDef {
  id: string;
  name: string;
  light: Record<string, string>;
  dark: Record<string, string>;
  neon?: {
    light: { primary: NeonVariant; secondary: NeonVariant; accent: NeonVariant };
    dark: { primary: NeonVariant; secondary: NeonVariant; accent: NeonVariant };
  };
}

export const THEME_PRESETS: ThemePresetDef[] = [
  {
    id: 'default',
    name: 'Default',
    light: {
      '--bg-0': '#ffffff',
      '--bg-100': '#fcfcfc',
      '--bg-100-rgb': '252, 252, 252',
      '--bg-200': '#f3f3f3',
      '--bg-300': '#eaeaea',
      '--bg-400': '#dcdcdc',
      '--text-100': '#2b2b2b',
      '--text-200': '#4a4a4a',
      '--text-300': '#6b6b6b',
      '--text-400': '#8b8b8b',
      '--text-500': '#a3a3a3',
      '--border-100': 'rgba(0,0,0,0.07)',
      '--border-200': 'rgba(0,0,0,0.12)',
      '--border-300': 'rgba(0,0,0,0.18)',
      '--border-400': 'rgba(0,0,0,0.28)',
      '--surface-hover': 'rgba(0,0,0,0.05)',
    },
    dark: {
      '--bg-0': '#111111',
      '--bg-100': '#1a1a1a',
      '--bg-100-rgb': '26, 26, 26',
      '--bg-200': '#242424',
      '--bg-300': '#2e2e2e',
      '--bg-400': '#3a3a3a',
      '--text-100': '#ececec',
      '--text-200': '#d0d0d0',
      '--text-300': '#ababab',
      '--text-400': '#888888',
      '--text-500': '#6a6a6a',
      '--border-100': 'rgba(255,255,255,0.08)',
      '--border-200': 'rgba(255,255,255,0.12)',
      '--border-300': 'rgba(255,255,255,0.18)',
      '--border-400': 'rgba(255,255,255,0.28)',
      '--surface-hover': 'rgba(255,255,255,0.06)',
    },
  },
  {
    id: 'mint-garden',
    name: 'Mint Garden',
    light: {
      '--bg-0': '#ffffff',
      '--bg-100': '#fafcf9',
      '--bg-100-rgb': '250, 252, 249',
      '--bg-200': '#f1f5ee',
      '--bg-300': '#e7ede3',
      '--bg-400': '#d5ddd0',
      '--text-100': '#243022',
      '--text-200': '#445042',
      '--text-300': '#667064',
      '--text-400': '#889086',
      '--text-500': '#a4aaa2',
      '--border-100': 'rgba(30,50,28,0.07)',
      '--border-200': 'rgba(30,50,28,0.12)',
      '--border-300': 'rgba(30,50,28,0.18)',
      '--border-400': 'rgba(30,50,28,0.28)',
      '--surface-hover': 'rgba(30,50,28,0.05)',
    },
    dark: {
      '--bg-0': '#101410',
      '--bg-100': '#181c18',
      '--bg-100-rgb': '24, 28, 24',
      '--bg-200': '#222822',
      '--bg-300': '#2c322c',
      '--bg-400': '#383e38',
      '--text-100': '#eceee9',
      '--text-200': '#d0d4cc',
      '--text-300': '#a8ada5',
      '--text-400': '#868c84',
      '--text-500': '#686e66',
      '--border-100': 'rgba(220,240,220,0.08)',
      '--border-200': 'rgba(220,240,220,0.12)',
      '--border-300': 'rgba(220,240,220,0.18)',
      '--border-400': 'rgba(220,240,220,0.28)',
      '--surface-hover': 'rgba(220,240,220,0.06)',
    },
    neon: {
      light: { primary: v(79,70,229), secondary: v(20,184,166), accent: v(245,158,11) },
      dark:  { primary: v(129,140,248), secondary: v(45,212,191), accent: v(252,211,77) },
    },
  },
];

export const INDIVIDUAL_COLORS: Record<string, { dark: NeonVariant; light: NeonVariant }> = {
  red:    { dark: v(248,113,113), light: v(180,40,40) },
  orange: { dark: v(251,146,60),  light: v(190,80,15) },
  yellow: { dark: v(250,204,21),  light: v(180,130,0) },
  lime:   { dark: v(163,230,53),  light: v(100,150,10) },
  green:  { dark: v(74,222,128),  light: v(22,120,60) },
  cyan:   { dark: v(34,211,238),  light: v(10,120,150) },
  blue:   { dark: v(96,165,250),  light: v(30,80,170) },
  indigo: { dark: v(129,140,248), light: v(55,60,160) },
  purple: { dark: v(192,132,252), light: v(100,50,170) },
  pink:   { dark: v(244,114,182), light: v(170,40,100) },
  rose:   { dark: v(251,113,133), light: v(180,40,55) },
  teal:   { dark: v(45,212,191),  light: v(15,120,105) },
};