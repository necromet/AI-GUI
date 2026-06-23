import React, { useState, useRef } from 'react';
import { Mic, Loader2, Upload, X } from 'lucide-react';
import { generateSpeech } from '../services/mimoService';

interface VoiceClonePanelProps {
  onNotification: (msg: string, type: 'success' | 'error') => void;
  theme?: 'dark' | 'light';
}

const VoiceClonePanel: React.FC<VoiceClonePanelProps> = ({ onNotification, theme = 'dark' }) => {
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

  const canGenerate = text.trim().length > 0 && !!audioFile;

  const borderColor = isDragOver ? 'rgba(var(--neon-rgb), 0.4)' : (theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.15)');

  return (
    <div className="flex flex-col gap-3.5 p-4">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg" style={{ background: 'rgba(var(--neon-rgb), 0.08)' }}>
          <Mic size={15} style={{ color: 'var(--neon-color)' }} />
        </div>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-200">Voice Clone</span>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Reference Voice Sample</label>
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
            className="flex items-center gap-2 px-4 py-4 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-xl transition-all duration-200 w-full justify-center"
            style={{
              border: `2px dashed ${borderColor}`,
              background: isDragOver ? 'rgba(var(--neon-rgb), 0.04)' : 'transparent',
            }}
          >
            <Upload size={16} />
            {isDragOver ? 'Drop audio here' : 'Upload audio sample'}
          </button>
        ) : (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-300 dark:border-white/[0.06]">
            <Mic size={14} style={{ color: 'var(--neon-color)' }} className="flex-shrink-0" />
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{audioFile.name}</span>
            <button onClick={handleRemoveFile} className="p-1 hover:bg-gray-200 dark:hover:bg-white/[0.06] rounded-lg transition-colors text-gray-500 hover:text-red-400">
              <X size={14} />
            </button>
          </div>
        )}
        {audioPreview && (
          <audio src={audioPreview} controls className="w-full mt-2 rounded-xl" />
        )}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter text to synthesize with cloned voice..."
        rows={3}
        className="w-full bg-gray-50 dark:bg-white/[0.02] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 px-3.5 py-2.5 resize-none outline-none rounded-xl text-sm transition-all duration-200 focus:bg-gray-100 dark:focus:bg-white/[0.04] border border-gray-300 dark:border-white/[0.06] focus:border-gray-400 dark:focus:border-white/20"
      />

      <div>
        <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Style (optional)</label>
        <input
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          placeholder="e.g. Whisper softly, speak excitedly"
          className="w-full bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 text-sm px-3.5 py-2.5 rounded-xl outline-none transition-all duration-200 border border-gray-300 dark:border-white/[0.06] focus:border-gray-400 dark:focus:border-white/20"
        />
      </div>

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
            Cloning voice...
          </>
        ) : (
          <>
            <Mic size={15} />
            Clone & Generate
          </>
        )}
      </button>

      {generatedUrl && (
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Cloned Output</label>
          <audio ref={audioRef} src={generatedUrl} controls className="w-full rounded-xl" />
        </div>
      )}
    </div>
  );
};

export default VoiceClonePanel;