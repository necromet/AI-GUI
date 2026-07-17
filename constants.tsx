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
    light: {},
    dark: {},
  },
  {
    id: 'mint-garden',
    name: 'Mint Garden',
    light: {
      '--bg-100': '#ffffff',
      '--bg-200': '#f7f9f3',
      '--bg-300': '#f0f0f0',
      '--bg-400': '#d4d4d4',
      '--text-100': '#000000',
      '--text-300': '#333333',
      '--text-500': '#737373',
      '--border-300': 'rgba(0,0,0,0.12)',
      '--border-200': 'rgba(0,0,0,0.06)',
      '--surface-hover': 'rgba(0,0,0,0.04)',
    },
    dark: {
      '--bg-100': '#000000',
      '--bg-200': '#1a212b',
      '--bg-300': '#333333',
      '--bg-400': '#545454',
      '--text-100': '#ffffff',
      '--text-300': '#cccccc',
      '--text-500': '#888888',
      '--border-300': 'rgba(255,255,255,0.12)',
      '--border-200': 'rgba(255,255,255,0.06)',
      '--surface-hover': 'rgba(255,255,255,0.03)',
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