import React, { useState, useRef, useEffect } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { generateSpeech } from '../services/apiService';
import { ModelConfig } from '../types';

interface VoiceDesignPanelProps {
  onNotification: (msg: string, type: 'success' | 'error') => void;
  theme?: 'dark' | 'light';
  modelConfig?: ModelConfig;
}

const VoiceDesignPanel: React.FC<VoiceDesignPanelProps> = ({ onNotification, theme = 'dark', modelConfig }) => {
  const [voiceDescription, setVoiceDescription] = useState('');
  const [text, setText] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => { if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current); };
  }, []);

  const handleGenerate = async () => {
    if (!text.trim() || !voiceDescription.trim()) return;
    setIsGenerating(true);
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setAudioUrl(null);

    try {
      const url = await generateSpeech({
        model: modelConfig?.apiModelId || modelConfig?.id || 'mimo-v2.5-tts-voicedesign',
        text: text.trim(),
        style: voiceDescription.trim(),
        provider: modelConfig?.provider,
      });
      audioUrlRef.current = url;
      setAudioUrl(url);
    } catch (err: any) {
      onNotification(err.message || 'Failed to generate speech', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = text.trim().length > 0 && voiceDescription.trim().length > 0;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ background: 'rgba(var(--neon-rgb), 0.1)', boxShadow: '0 0 20px rgba(var(--neon-rgb), 0.08)' }}>
          <Wand2 size={22} style={{ color: 'var(--neon-color)' }} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Voice Design</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{modelConfig?.name || 'MiMo Voice Design'}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Voice Description (required)</label>
          <input
            value={voiceDescription}
            onChange={(e) => setVoiceDescription(e.target.value)}
            placeholder="e.g. Warm female voice, soft and gentle, speaks slowly with a slight accent"
            className="w-full bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 text-sm px-4 py-3 rounded-xl outline-none transition-all duration-200 border border-gray-200 dark:border-white/[0.04] focus:border-gray-300 dark:focus:border-white/12"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Text to synthesize</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to synthesize..."
            rows={5}
            className="w-full bg-gray-50 dark:bg-white/[0.02] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 px-4 py-3 resize-none outline-none rounded-xl text-sm transition-all duration-200 focus:bg-gray-100 dark:focus:bg-white/[0.04] border border-gray-200 dark:border-white/[0.04] focus:border-gray-300 dark:focus:border-white/12"
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
              Generating...
            </>
          ) : (
            <>
              <Wand2 size={16} />
              Generate Voice
            </>
          )}
        </button>

        {audioUrl && (
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Output</label>
            <audio ref={audioRef} src={audioUrl} controls className="w-full rounded-xl" />
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceDesignPanel;
