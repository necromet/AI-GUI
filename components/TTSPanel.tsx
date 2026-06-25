import React, { useState, useRef } from 'react';
import { Volume2, Loader2 } from 'lucide-react';
import { generateSpeech, BUILT_IN_VOICES } from '../services/mimoService';
import { ModelConfig } from '../types';

interface TTSPanelProps {
  onNotification: (msg: string, type: 'success' | 'error') => void;
  theme?: 'dark' | 'light';
  modelConfig?: ModelConfig;
}

const TTSPanel: React.FC<TTSPanelProps> = ({ onNotification, theme = 'dark', modelConfig }) => {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('mimo_default');
  const [style, setStyle] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setIsGenerating(true);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);

    try {
      const url = await generateSpeech({
        model: modelConfig?.apiModelId || modelConfig?.id || 'mimo-v2.5-tts',
        text: text.trim(),
        voice,
        style: style.trim() || undefined,
        provider: modelConfig?.provider,
      });
      setAudioUrl(url);
    } catch (err: any) {
      onNotification(err.message || 'Failed to generate speech', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = text.trim().length > 0;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ background: 'rgba(var(--neon-rgb), 0.1)', boxShadow: '0 0 20px rgba(var(--neon-rgb), 0.08)' }}>
          <Volume2 size={22} style={{ color: 'var(--neon-color)' }} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Text-to-Speech</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{modelConfig?.name || 'MiMo TTS'}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Text to synthesize</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to synthesize..."
            rows={5}
            className="w-full bg-gray-50 dark:bg-white/[0.02] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 px-4 py-3 resize-none outline-none rounded-xl text-sm transition-all duration-200 focus:bg-gray-100 dark:focus:bg-white/[0.04] border border-gray-300 dark:border-white/[0.06] focus:border-gray-400 dark:focus:border-white/20"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Voice</label>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="w-full bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-gray-200 text-sm px-4 py-3 rounded-xl outline-none transition-all duration-200 border border-gray-300 dark:border-white/[0.06] focus:border-gray-400 dark:focus:border-white/20"
            >
              {BUILT_IN_VOICES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Style (optional)</label>
            <input
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="e.g. Cheerful, slow"
              className="w-full bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-gray-200 text-sm px-4 py-3 rounded-xl outline-none transition-all duration-200 border border-gray-300 dark:border-white/[0.06] focus:border-gray-400 dark:focus:border-white/20"
            />
          </div>
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
              <Volume2 size={16} />
              Generate Speech
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

export default TTSPanel;
