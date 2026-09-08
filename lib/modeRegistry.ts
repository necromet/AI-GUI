import type { Mode } from '../types';

export interface ModeDefinition {
  id: Mode;
  label: string;
  pathPrefix: string;
  sessionKey: string;
  hasSidebar: boolean;
  hasHeader: boolean;
}

export const MODES: ModeDefinition[] = [
  { id: 'chat', label: 'Chat', pathPrefix: '/chat', sessionKey: 'edward:labs_chat_session', hasSidebar: true, hasHeader: true },
  { id: 'rag', label: 'RAG', pathPrefix: '/rag', sessionKey: 'edward:labs_rag_session', hasSidebar: true, hasHeader: true },
  { id: 'skema', label: 'Skema', pathPrefix: '/skema', sessionKey: 'edward:labs_skema_session', hasSidebar: true, hasHeader: true },
  { id: 'python', label: 'Python', pathPrefix: '/python', sessionKey: 'edward:labs_python_session', hasSidebar: true, hasHeader: true },
  { id: 'library', label: 'Library', pathPrefix: '/library', sessionKey: 'edward:labs_library_session', hasSidebar: true, hasHeader: true },
  { id: 'database', label: 'Database', pathPrefix: '/database', sessionKey: 'edward:labs_database_session', hasSidebar: true, hasHeader: true },
  { id: 'agent-builder', label: 'Agent Builder', pathPrefix: '/agent-builder', sessionKey: 'edward:labs_agent-builder_session', hasSidebar: true, hasHeader: true },
  { id: 'notes', label: 'Notes', pathPrefix: '/notes', sessionKey: 'edward:labs_notes_session', hasSidebar: true, hasHeader: true },
];

/**
 * Get the mode definition for a given pathname.
 * Returns null for the selector ('/') and settings ('/settings') pages.
 */
export function getModeFromPath(pathname: string): ModeDefinition | null {
  if (pathname === '/' || pathname === '/settings') return null;

  for (const mode of MODES) {
    if (pathname.startsWith(mode.pathPrefix)) {
      return mode;
    }
  }

  return null;
}

/**
 * Get the current mode ID from a pathname.
 * Returns 'selector' for '/', 'settings' for '/settings', or the mode ID.
 */
export function getCurrentMode(pathname: string): Mode {
  if (pathname === '/') return 'selector';
  if (pathname === '/settings') return 'settings' as Mode;

  const mode = getModeFromPath(pathname);
  return mode?.id ?? 'library';
}

/**
 * Check if a pathname matches a specific mode.
 */
export function isModePath(pathname: string, modeId: string): boolean {
  const mode = MODES.find(m => m.id === modeId);
  return mode ? pathname.startsWith(mode.pathPrefix) : false;
}
