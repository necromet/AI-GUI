import { useState, useEffect, useCallback } from 'react';
import * as db from '../../services/apiDatabaseAdapter';
import type { Note, NoteBlock } from '../../types';

const generateId = () => Math.random().toString(36).substring(2, 15);

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      const tree = await db.getNotes();
      setNotes(tree);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const createNote = useCallback(async (parentId?: string | null, title?: string, icon?: string) => {
    const note = await db.createNote(title || 'Untitled', icon || '📄', parentId || null);
    await loadNotes();
    return note;
  }, [loadNotes]);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    const note = await db.saveNote(id, {
      title: updates.title,
      icon: updates.icon,
      coverUrl: updates.coverUrl,
      parentId: updates.parentId,
      sortOrder: updates.sortOrder,
      blocks: updates.blocks,
      isFavorite: updates.isFavorite,
    });
    await loadNotes();
    return note;
  }, [loadNotes]);

  const deleteNote = useCallback(async (id: string) => {
    await db.deleteNote(id);
    await loadNotes();
  }, [loadNotes]);

  const moveNote = useCallback(async (id: string, newParentId: string | null, sortOrder?: number) => {
    await db.moveNote(id, newParentId, sortOrder);
    await loadNotes();
  }, [loadNotes]);

  const toggleFavorite = useCallback(async (id: string, current: boolean) => {
    await db.saveNote(id, { isFavorite: !current });
    await loadNotes();
  }, [loadNotes]);

  const findNote = useCallback((id: string, tree: Note[] = notes): Note | null => {
    for (const note of tree) {
      if (note.id === id) return note;
      if (note.children) {
        const found = findNote(id, note.children);
        if (found) return found;
      }
    }
    return null;
  }, [notes]);

  return {
    notes,
    loading,
    loadNotes,
    createNote,
    updateNote,
    deleteNote,
    moveNote,
    toggleFavorite,
    findNote,
  };
}
