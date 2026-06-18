import React, { useState, useRef } from 'react';
import { Mic, Loader2, Upload, X } from 'lucide-react';
import { generateSpeech } from '../services/mimoService';

interface VoiceClonePanelProps {
  onNotification: (msg: string, type: 'success' | 'error') => void;
}

const VoiceClonePanel: React.FC<VoiceClonePanelProps> = ({ onNotification }) => {
  const [text, setText] = useState('');
  const [style, setStyle] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
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
      const url = await generateSpeech({
        model: 'mimo-v2.5-tts-voiceclone',
        text: text.trim(),
        style: style.trim() || undefined,
      });
      setGeneratedUrl(url);
    } catch (err: any) {
      onNotification(err.message || 'Failed to generate speech', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Mic size={18} style={{ color: 'var(--neon-color)' }} />
        <span className="text-sm font-medium text-gray-300">Voice Clone</span>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Reference Voice Sample</label>
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
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-gray-200 border border-dashed border-white/20 hover:border-white/40 rounded-lg transition-colors w-full justify-center"
          >
            <Upload size={16} />
            Upload audio sample
          </button>
        ) : (
          <div className="flex items-center gap-2 p-2 border border-white/10 rounded-lg bg-white/5">
            <Mic size={16} className="text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-300 truncate flex-1">{audioFile.name}</span>
            <button onClick={handleRemoveFile} className="p-1 hover:bg-white/10 rounded">
              <X size={14} className="text-gray-500" />
            </button>
          </div>
        )}
        {audioPreview && (
          <audio src={audioPreview} controls className="w-full mt-2 rounded-lg" />
        )}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter text to synthesize with cloned voice..."
        rows={3}
        className="w-full bg-transparent text-gray-100 placeholder-gray-500 px-3 py-2 resize-none outline-none border border-white/10 rounded-lg focus:border-white/30 transition-colors text-sm"
      />

      <div>
        <label className="block text-xs text-gray-500 mb-1">Style (optional)</label>
        <input
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          placeholder="e.g. Whisper softly, speak excitedly"
          className="w-full bg-[#1a1a1a] text-gray-200 text-sm px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-white/30"
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={!text.trim() || !audioFile || isGenerating}
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: text.trim() && audioFile ? 'var(--neon-color)' : undefined,
          color: text.trim() && audioFile ? '#000' : undefined,
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
          <label className="block text-xs text-gray-500 mb-1">Cloned Output</label>
          <audio ref={audioRef} src={generatedUrl} controls className="w-full rounded-lg" />
        </div>
      )}
    </div>
  );
};

export default VoiceClonePanel;
