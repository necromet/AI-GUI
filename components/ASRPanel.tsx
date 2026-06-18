import React, { useState, useRef } from 'react';
import { Mic, Loader2, Upload, X, FileText } from 'lucide-react';
import { transcribeAudio } from '../services/mimoService';

interface ASRPanelProps {
  onNotification: (msg: string, type: 'success' | 'error') => void;
}

const ASRPanel: React.FC<ASRPanelProps> = ({ onNotification }) => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
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

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <FileText size={18} style={{ color: 'var(--neon-color)' }} />
        <span className="text-sm font-medium text-gray-300">Speech Recognition</span>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Audio File</label>
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
            Upload audio to transcribe
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

      <button
        onClick={handleTranscribe}
        disabled={!audioFile || isTranscribing}
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: audioFile ? 'var(--neon-color)' : undefined,
          color: audioFile ? '#000' : undefined,
        }}
      >
        {isTranscribing ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Transcribing...
          </>
        ) : (
          <>
            <FileText size={16} />
            Transcribe
          </>
        )}
      </button>

      {transcription && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Transcription</label>
          <div className="p-3 border border-white/10 rounded-lg bg-white/5 text-sm text-gray-200 whitespace-pre-wrap">
            {transcription}
          </div>
        </div>
      )}
    </div>
  );
};

export default ASRPanel;
