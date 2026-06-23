import React, { useState, useRef } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { generateSpeech } from '../services/mimoService';

interface VoiceDesignPanelProps {
  onNotification: (msg: string, type: 'success' | 'error') => void;
  theme?: 'dark' | 'light';
}

const VoiceDesignPanel: React.FC<VoiceDesignPanelProps> = ({ onNotification, theme = 'dark' }) => {
  const [voiceDescription, setVoiceDescription] = useState('');
  const [text, setText] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleGenerate = async () => {
    if (!text.trim() || !voiceDescription.trim()) return;
    setIsGenerating(true);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);

    try {
      const url = await generateSpeech({
        model: 'mimo-v2.5-tts-voicedesign',
        text: text.trim(),
        style: voiceDescription.trim(),
      });
      setAudioUrl(url);
    } catch (err: any) {
      onNotification(err.message || 'Failed to generate speech', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = text.trim().length > 0 && voiceDescription.trim().length > 0;

  return (
    <div className="flex flex-col gap-3.5 p-4">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg" style={{ background: 'rgba(var(--neon-rgb), 0.08)' }}>
          <Wand2 size={15} style={{ color: 'var(--neon-color)' }} />
        </div>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-200">Voice Design</span>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Voice Description (required)</label>
        <input
          value={voiceDescription}
          onChange={(e) => setVoiceDescription(e.target.value)}
          placeholder="e.g. Warm female voice, soft and gentle"
          className="w-full bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 text-sm px-3.5 py-2.5 rounded-xl outline-none transition-all duration-200 border border-gray-300 dark:border-white/[0.06] focus:border-gray-400 dark:focus:border-white/20"
        />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter text to synthesize..."
        rows={3}
        className="w-full bg-gray-50 dark:bg-white/[0.02] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 px-3.5 py-2.5 resize-none outline-none rounded-xl text-sm transition-all duration-200 focus:bg-gray-100 dark:focus:bg-white/[0.04] border border-gray-300 dark:border-white/[0.06] focus:border-gray-400 dark:focus:border-white/20"
      />

      <button
        onClick={handleGenerate}
        disabled={!canGenerate || isGenerating}
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          background: canGenerate ? 'var(--neon-color)' : (theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'),
          color: canGenerate ? '#000' : (theme === 'dark' ? '#555' : '#999'),
          boxShadow: canGenerate ? '0 0 20px rgba(var(--neon-rgb), 0.3)' : 'none',
        }}
      >
        {isGenerating ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Wand2 size={15} />
            Generate Voice
          </>
        )}
      </button>

      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} controls className="w-full mt-1 rounded-xl" />
      )}
    </div>
  );
};

export default VoiceDesignPanel;