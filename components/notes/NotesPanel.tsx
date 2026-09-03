import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StickyNote } from 'lucide-react';
import { NoteEditor } from './NoteEditor';
import { useNotes } from './useNotes';
import * as db from '../../services/apiDatabaseAdapter';
import type { Note } from '../../types';

export interface NotesControls {
  notes: Note[];
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCreateNote: (parentId?: string | null) => void;
  onDeleteNote: (id: string) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onRenameNote: (id: string, newTitle: string) => void;
  loading: boolean;
}

interface NotesPanelProps {
  theme?: 'dark' | 'light';
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  onControlsChange?: (controls: NotesControls | null) => void;
}

const EMOJI_LIST = ['📄', '📝', '📌', '📚', '🎯', '💡', '🔥', '⭐', '🚀', '🎨', '📊', '🔧', '🌟', '🎵', '🏠', '💻', '🎮', '📷', '✈️', '🍕'];

export const NotesPanel: React.FC<NotesPanelProps> = ({ theme, onNotification, onControlsChange }) => {
  const navigate = useNavigate();
  const { noteId } = useParams<{ noteId: string }>();
  const { notes, loading, loadNotes, createNote, updateNote, deleteNote, toggleFavorite, findNote } = useNotes();
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [loadingNote, setLoadingNote] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    if (onControlsChange) {
      onControlsChange({
        notes,
        selectedNoteId: noteId || null,
        onSelectNote: (id: string) => navigate(`/notes/${id}`),
        onCreateNote: handleCreateNote,
        onDeleteNote: handleDeleteNote,
        onToggleFavorite: handleToggleFavorite,
        onRenameNote: handleRenameNote,
        loading,
      });
    }
    return () => { onControlsChange?.(null); };
  }, [notes, noteId, loading]);

  useEffect(() => {
    const loadNoteData = async () => {
      if (!noteId) {
        setSelectedNote(null);
        return;
      }
      try {
        setLoadingNote(true);
        const note = await db.getNote(noteId);
        setSelectedNote(note);
      } catch (err) {
        console.error('Failed to load note:', err);
        onNotification?.('Failed to load note', 'error');
        setSelectedNote(null);
      } finally {
        setLoadingNote(false);
      }
    };
    loadNoteData();
  }, [noteId]);

  const handleCreateNote = useCallback(async (parentId?: string | null) => {
    try {
      const note = await createNote(parentId || null);
      navigate(`/notes/${note.id}`);
      onNotification?.('Page created', 'success');
    } catch (err) {
      onNotification?.('Failed to create page', 'error');
    }
  }, [createNote, navigate, onNotification]);

  const handleDeleteNote = useCallback(async (id: string) => {
    try {
      await deleteNote(id);
      if (noteId === id) {
        navigate('/notes');
      }
      onNotification?.('Page deleted', 'success');
    } catch (err) {
      onNotification?.('Failed to delete page', 'error');
    }
  }, [deleteNote, noteId, navigate, onNotification]);

  const handleToggleFavorite = useCallback(async (id: string, current: boolean) => {
    try {
      await toggleFavorite(id, current);
    } catch (err) {
      onNotification?.('Failed to update favorite', 'error');
    }
  }, [toggleFavorite, onNotification]);

  const handleRenameNote = useCallback(async (id: string, newTitle: string) => {
    try {
      await updateNote(id, { title: newTitle });
      if (selectedNote?.id === id) {
        setSelectedNote(prev => prev ? { ...prev, title: newTitle } : null);
      }
    } catch (err) {
      onNotification?.('Failed to rename page', 'error');
    }
  }, [updateNote, selectedNote, onNotification]);

  const handleSave = useCallback(async (id: string, updates: Partial<Note>) => {
    try {
      await updateNote(id, updates);
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  }, [updateNote]);

  const handleIconChange = useCallback(async (emoji: string) => {
    if (!selectedNote) return;
    try {
      await updateNote(selectedNote.id, { icon: emoji });
      setSelectedNote(prev => prev ? { ...prev, icon: emoji } : null);
      setShowEmojiPicker(false);
    } catch (err) {
      onNotification?.('Failed to update icon', 'error');
    }
  }, [selectedNote, updateNote, onNotification]);

  const handleTitleChange = useCallback(async (newTitle: string) => {
    if (!selectedNote) return;
    try {
      await updateNote(selectedNote.id, { title: newTitle });
      setSelectedNote(prev => prev ? { ...prev, title: newTitle } : null);
    } catch (err) {
      onNotification?.('Failed to update title', 'error');
    }
  }, [selectedNote, updateNote, onNotification]);

  if (!noteId) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.12), rgba(var(--neon-rgb), 0.04))' }}>
          <StickyNote size={28} style={{ color: 'var(--neon-color)' }} />
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-100)' }}>Notes</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-500)' }}>
          Select a page from the sidebar or create a new one
        </p>
        <button
          onClick={() => handleCreateNote(null)}
          className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
          style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
        >
          Create a page
        </button>
      </div>
    );
  }

  if (loadingNote) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--neon-color)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!selectedNote) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--text-500)' }}>Note not found</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Cover image placeholder */}
        {selectedNote.coverUrl && (
          <div className="w-full h-48 rounded-lg mb-6 overflow-hidden" style={{ backgroundColor: 'var(--bg-200)' }}>
            <img src={selectedNote.coverUrl} alt="Cover" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Icon + Title */}
        <div className="mb-6">
          <div className="relative inline-block mb-2">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-4xl cursor-pointer hover:opacity-80 transition-opacity"
              title="Change icon"
            >
              {selectedNote.icon}
            </button>
            {showEmojiPicker && (
              <div
                className="absolute left-0 top-full z-50 p-2 rounded-lg border shadow-lg grid grid-cols-10 gap-1"
                style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)' }}
              >
                {EMOJI_LIST.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleIconChange(emoji)}
                    className="w-8 h-8 rounded flex items-center justify-center hover:bg-[var(--bg-200)] cursor-pointer text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            value={selectedNote.title}
            onChange={(e) => {
              setSelectedNote(prev => prev ? { ...prev, title: e.target.value } : null);
            }}
            onBlur={(e) => handleTitleChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-full text-4xl font-bold bg-transparent border-none outline-none"
            style={{ color: 'var(--text-100)' }}
            placeholder="Untitled"
          />
        </div>

        {/* Block editor */}
        <NoteEditor
          key={selectedNote.id}
          note={selectedNote}
          onSave={handleSave}
        />
      </div>
    </div>
  );
};
