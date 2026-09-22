import { useCallback, useRef, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { toast } from 'sonner';
import { MAX_UNDO_STACK_SIZE } from '../constants';

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
  label: string;
}

interface UndoRedoState {
  undoStack: Snapshot[];
  redoStack: Snapshot[];
}

export function useUndoRedo() {
  const [state, setState] = useState<UndoRedoState>({ undoStack: [], redoStack: [] });
  const isUndoRedoRef = useRef(false);

  const pushSnapshot = useCallback((nodes: Node[], edges: Edge[], label: string) => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    setState(prev => ({
      undoStack: [...prev.undoStack.slice(-(MAX_UNDO_STACK_SIZE - 1)), { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)), label }],
      redoStack: [],
    }));
  }, []);

  const undo = useCallback((
    currentNodes: Node[],
    currentEdges: Edge[],
    setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void,
    setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void,
  ) => {
    setState(prev => {
      if (prev.undoStack.length === 0) return prev;
      const snapshot = prev.undoStack[prev.undoStack.length - 1];
      isUndoRedoRef.current = true;
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      toast.success(`Undo: ${snapshot.label}`, { duration: 1500 });
      return {
        undoStack: prev.undoStack.slice(0, -1),
        redoStack: [...prev.redoStack, {
          nodes: JSON.parse(JSON.stringify(currentNodes)),
          edges: JSON.parse(JSON.stringify(currentEdges)),
          label: snapshot.label,
        }],
      };
    });
  }, []);

  const redo = useCallback((
    currentNodes: Node[],
    currentEdges: Edge[],
    setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void,
    setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void,
  ) => {
    setState(prev => {
      if (prev.redoStack.length === 0) return prev;
      const snapshot = prev.redoStack[prev.redoStack.length - 1];
      isUndoRedoRef.current = true;
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      toast.success(`Redo: ${snapshot.label}`, { duration: 1500 });
      return {
        undoStack: [...prev.undoStack, {
          nodes: JSON.parse(JSON.stringify(currentNodes)),
          edges: JSON.parse(JSON.stringify(currentEdges)),
          label: snapshot.label,
        }],
        redoStack: prev.redoStack.slice(0, -1),
      };
    });
  }, []);

  return {
    canUndo: state.undoStack.length > 0,
    canRedo: state.redoStack.length > 0,
    pushSnapshot,
    undo,
    redo,
    isUndoRedoRef,
  };
}
