import React, { useState, useRef } from 'react';
import { Volume2, Loader2 } from 'lucide-react';
import { generateSpeech, BUILT_IN_VOICES } from '../services/mimoService';

interface TTSPanelProps {
  onNotification: (msg: string, type: 'success' | 'error') => void;
}

const TTSPanel: React.FC<TTSPanelProps> = ({ onNotification }) => {
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
        model: 'mimo-v2.5-tts',
        text: text.trim(),
        voice,
        style: style.trim() || undefined,
      });
      setAudioUrl(url);
    } catch (err: any) {
      onNotification(err.message || 'Failed to generate speech', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Volume2 size={18} style={{ color: 'var(--neon-color)' }} />
        <span className="text-sm font-medium text-gray-300">Text-to-Speech</span>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter text to synthesize..."
        rows={3}
        className="w-full bg-transparent text-gray-100 placeholder-gray-500 px-3 py-2 resize-none outline-none border border-white/10 rounded-lg focus:border-white/30 transition-colors text-sm"
      />

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Voice</label>
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="w-full bg-[#1a1a1a] text-gray-200 text-sm px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-white/30"
          >
            {BUILT_IN_VOICES.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Style (optional)</label>
          <input
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="e.g. Cheerful, slow"
            className="w-full bg-[#1a1a1a] text-gray-200 text-sm px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-white/30"
          />
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={!text.trim() || isGenerating}
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: text.trim() ? 'var(--neon-color)' : undefined,
          color: text.trim() ? '#000' : undefined,
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
        <audio ref={audioRef} src={audioUrl} controls className="w-full mt-1 rounded-lg" />
      )}
    </div>
  );
};

export default TTSPanel;
