import React, { useState, useRef } from 'react';
import { Mic, Loader2, Upload, X } from 'lucide-react';
import { generateSpeech } from '../services/mimoService';
import { ModelConfig } from '../types';

interface VoiceClonePanelProps {
  onNotification: (msg: string, type: 'success' | 'error') => void;
  theme?: 'dark' | 'light';
  modelConfig?: ModelConfig;
}

const VoiceClonePanel: React.FC<VoiceClonePanelProps> = ({ onNotification, theme = 'dark', modelConfig }) => {
  const [text, setText] = useState('');
  const [style, setStyle] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      onNotification('Please select an audio file', 'error');
      return;
    }
    setAudioFile(file);
    setAudioPreview(URL.createObjectURL(file));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('audio/')) {
      onNotification('Please drop an audio file', 'error');
      return;
    }
    setAudioFile(file);
    setAudioPreview(URL.createObjectURL(file));
  };

  const handleRemoveFile = () => {
    if (audioPreview) URL.revokeObjectURL(audioPreview);
    setAudioFile(null);
    setAudioPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!text.trim() || !audioFile) return;
    setIsGenerating(true);
    if (generatedUrl) URL.revokeObjectURL(generatedUrl);
    setGeneratedUrl(null);

    try {
      const reader = new FileReader();
      const audioBase64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(audioFile);
      });

      const url = await generateSpeech({
        model: modelConfig?.apiModelId || modelConfig?.id || 'mimo-v2.5-tts-voiceclone',
        text: text.trim(),
        voice: audioBase64,
        style: style.trim() || undefined,
        provider: modelConfig?.provider,
      });
      setGeneratedUrl(url);
    } catch (err: any) {
      onNotification(err.message || 'Failed to generate speech', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = text.trim().length > 0 && !!audioFile;

  const borderColor = isDragOver ? 'rgba(var(--neon-rgb), 0.4)' : (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)');

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ background: 'rgba(var(--neon-rgb), 0.1)', boxShadow: '0 0 20px rgba(var(--neon-rgb), 0.08)' }}>
          <Mic size={22} style={{ color: 'var(--neon-color)' }} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Voice Clone</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{modelConfig?.name || 'MiMo Voice Clone'}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Reference Voice Sample</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          {!audioFile ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className="flex flex-col items-center gap-3 px-6 py-10 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-xl transition-all duration-200 w-full justify-center"
              style={{
                border: `2px dashed ${borderColor}`,
                background: isDragOver ? 'rgba(var(--neon-rgb), 0.04)' : 'transparent',
              }}
            >
              <Upload size={24} />
              <span>{isDragOver ? 'Drop audio here' : 'Drag & drop or click to upload reference audio'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.04]">
              <Mic size={16} style={{ color: 'var(--neon-color)' }} className="flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{audioFile.name}</span>
              <button onClick={handleRemoveFile} className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/[0.06] rounded-lg transition-colors text-gray-500 hover:text-red-400">
                <X size={14} />
              </button>
            </div>
          )}
          {audioPreview && (
            <audio src={audioPreview} controls className="w-full mt-3 rounded-xl" />
          )}
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Text to synthesize</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to synthesize with cloned voice..."
            rows={5}
            className="w-full bg-gray-50 dark:bg-white/[0.02] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 px-4 py-3 resize-none outline-none rounded-xl text-sm transition-all duration-200 focus:bg-gray-100 dark:focus:bg-white/[0.04] border border-gray-200 dark:border-white/[0.04] focus:border-gray-300 dark:focus:border-white/12"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Style (optional)</label>
          <input
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="e.g. Whisper softly, speak excitedly"
            className="w-full bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 text-sm px-4 py-3 rounded-xl outline-none transition-all duration-200 border border-gray-200 dark:border-white/[0.04] focus:border-gray-300 dark:focus:border-white/12"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: canGenerate ? 'var(--neon-color)' : (theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'),
            color: canGenerate ? '#000' : (theme === 'dark' ? '#555' : '#999'),
            boxShadow: canGenerate ? '0 0 25px rgba(var(--neon-rgb), 0.3)' : 'none',
          }}
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Cloning voice...
            </>
          ) : (
            <>
              <Mic size={16} />
              Clone & Generate
            </>
          )}
        </button>

        {generatedUrl && (
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Cloned Output</label>
            <audio ref={audioRef} src={generatedUrl} controls className="w-full rounded-xl" />
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceClonePanel;
