import React, { useState, useRef } from 'react';
import { Mic, Loader2, Upload, X, FileText } from 'lucide-react';
import { transcribeAudio } from '../services/mimoService';

interface ASRPanelProps {
  onNotification: (msg: string, type: 'success' | 'error') => void;
  theme?: 'dark' | 'light';
}

const ASRPanel: React.FC<ASRPanelProps> = ({ onNotification, theme = 'dark' }) => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      onNotification('Please select an audio file', 'error');
      return;
    }
    setAudioFile(file);
    setAudioPreview(URL.createObjectURL(file));
    setTranscription('');
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
    setTranscription('');
  };

  const handleRemoveFile = () => {
    if (audioPreview) URL.revokeObjectURL(audioPreview);
    setAudioFile(null);
    setAudioPreview(null);
    setTranscription('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTranscribe = async () => {
    if (!audioFile) return;
    setIsTranscribing(true);
    setTranscription('');

    try {
      const text = await transcribeAudio({
        model: 'mimo-v2.5-asr',
        audioFile,
      });
      setTranscription(text);
    } catch (err: any) {
      onNotification(err.message || 'Failed to transcribe audio', 'error');
    } finally {
      setIsTranscribing(false);
    }
  };

  const borderColor = isDragOver ? 'rgba(var(--neon-rgb), 0.4)' : (theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.15)');

  return (
    <div className="flex flex-col gap-3.5 p-4">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg" style={{ background: 'rgba(var(--neon-rgb), 0.08)' }}>
          <FileText size={15} style={{ color: 'var(--neon-color)' }} />
        </div>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-200">Speech Recognition</span>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Audio File</label>
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
            {isDragOver ? 'Drop audio here' : 'Upload audio to transcribe'}
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

      <button
        onClick={handleTranscribe}
        disabled={!audioFile || isTranscribing}
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          background: audioFile ? 'var(--neon-color)' : (theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'),
          color: audioFile ? '#000' : (theme === 'dark' ? '#555' : '#999'),
          boxShadow: audioFile ? '0 0 20px rgba(var(--neon-rgb), 0.3)' : 'none',
        }}
      >
        {isTranscribing ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Transcribing...
          </>
        ) : (
          <>
            <FileText size={15} />
            Transcribe
          </>
        )}
      </button>

      {transcription && (
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Transcription</label>
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-gray-200 whitespace-pre-wrap leading-relaxed border border-gray-300 dark:border-white/[0.06]">
            {transcription}
          </div>
        </div>
      )}
    </div>
  );
};

export default ASRPanel;