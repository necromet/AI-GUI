import React, { useState, useRef } from 'react';
import { Loader2, Upload, X, FileText, Mic, Copy, Check } from 'lucide-react';
import { transcribeAudio } from '../services/mimoService';
import { ModelConfig } from '../types';
import { AIVoiceInput } from './AIVoiceInput';

type InputMode = 'upload' | 'record';

interface ASRPanelProps {
  onNotification: (msg: string, type: 'success' | 'error') => void;
  theme?: 'dark' | 'light';
  modelConfig?: ModelConfig;
}

const ASRPanel: React.FC<ASRPanelProps> = ({ onNotification, theme = 'dark', modelConfig }) => {
  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.start();
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  };

  const handleStopRecording = async (duration: number) => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        setAudioFile(file);
        setAudioPreview(URL.createObjectURL(file));
        setTranscription('');
      };
    }
  };

  const handleTranscribe = async () => {
    if (!audioFile) return;
    setIsTranscribing(true);
    setTranscription('');

    try {
      const text = await transcribeAudio({
        model: modelConfig?.apiModelId || modelConfig?.id || 'mimo-v2.5-asr',
        audioFile,
        provider: modelConfig?.provider,
      });
      setTranscription(text);
    } catch (err: any) {
      onNotification(err.message || 'Failed to transcribe audio', 'error');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const borderColor = isDragOver ? 'rgba(var(--neon-rgb), 0.4)' : (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)');

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ background: 'rgba(var(--neon-rgb), 0.1)', boxShadow: '0 0 20px rgba(var(--neon-rgb), 0.08)' }}>
          <FileText size={22} style={{ color: 'var(--neon-color)' }} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Speech Recognition</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{modelConfig?.name || 'MiMo ASR'}</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.04]">
        <button
          onClick={() => setInputMode('upload')}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
          style={{
            background: inputMode === 'upload' ? (theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)') : 'transparent',
            color: inputMode === 'upload' ? 'var(--neon-color)' : (theme === 'dark' ? '#888' : '#666'),
            boxShadow: inputMode === 'upload' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <Upload size={15} />
          Upload
        </button>
        <button
          onClick={() => setInputMode('record')}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
          style={{
            background: inputMode === 'record' ? (theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)') : 'transparent',
            color: inputMode === 'record' ? 'var(--neon-color)' : (theme === 'dark' ? '#888' : '#666'),
            boxShadow: inputMode === 'record' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <Mic size={15} />
          Record
        </button>
      </div>

      {inputMode === 'upload' ? (
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Audio File</label>
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
              <span>{isDragOver ? 'Drop audio here' : 'Drag & drop or click to upload audio'}</span>
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
      ) : (
        <div className="flex flex-col items-center gap-4">
          {!audioFile ? (
            <AIVoiceInput
              onStart={handleStartRecording}
              onStop={handleStopRecording}
              visualizerBars={48}
            />
          ) : (
            <div className="w-full flex flex-col gap-3">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.04]">
                <Mic size={16} style={{ color: 'var(--neon-color)' }} className="flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{audioFile.name}</span>
                <button onClick={handleRemoveFile} className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/[0.06] rounded-lg transition-colors text-gray-500 hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
              {audioPreview && (
                <audio src={audioPreview} controls className="w-full rounded-xl" />
              )}
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleTranscribe}
        disabled={!audioFile || isTranscribing}
        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          background: audioFile ? 'var(--neon-color)' : (theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'),
          color: audioFile ? '#000' : (theme === 'dark' ? '#555' : '#999'),
          boxShadow: audioFile ? '0 0 25px rgba(var(--neon-rgb), 0.3)' : 'none',
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
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Transcription</label>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all duration-200"
            >
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-gray-200 whitespace-pre-wrap leading-relaxed border border-gray-200 dark:border-white/[0.04]">
            {transcription}
          </div>
        </div>
      )}
    </div>
  );
};

export default ASRPanel;
