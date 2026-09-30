import type { TaskNode } from '../../../lib/harnessTypes';

export type TaskStatus = TaskNode['status'];

export interface TaskStore {
  create(summary: string, parentId?: string | null): TaskNode;
  start(id: string): TaskNode | null;
  done(id: string, summary?: string): TaskNode | null;
  block(id: string, reason?: string): TaskNode | null;
  unblock(id: string): TaskNode | null;
  abandon(id: string, reason?: string): TaskNode | null;
  rename(id: string, summary: string): TaskNode | null;
  get(id: string): TaskNode | null;
  list(): TaskNode[];
  dump(): string;
}

let seq = 0;

function nextId(): string {
  return 'T' + (++seq);
}

export function createTaskStore(): TaskStore {
  const tasks = new Map<string, TaskNode>();

  function getOrThrow(id: string): TaskNode {
    const t = tasks.get(id);
    if (!t) throw new Error('Task not found: ' + id);
    return t;
  }

  return {
    create(summary: string, parentId: string | null = null): TaskNode {
      if (parentId !== null) getOrThrow(parentId);
      const id = nextId();
      const node: TaskNode = {
        id,
        parentId: parentId ?? null,
        summary,
        status: 'open',
      };
      tasks.set(id, node);
      return { ...node };
    },

    start(id: string): TaskNode | null {
      const t = getOrThrow(id);
      t.status = 'in_progress';
      return { ...t };
    },

    done(id: string, summary?: string): TaskNode | null {
      const t = getOrThrow(id);
      t.status = 'done';
      if (summary) t.summary = summary;
      return { ...t };
    },

    block(id: string, reason?: string): TaskNode | null {
      const t = getOrThrow(id);
      t.status = 'blocked';
      if (reason) t.summary = t.summary + ' [blocked: ' + reason + ']';
      return { ...t };
    },

    unblock(id: string): TaskNode | null {
      const t = getOrThrow(id);
      t.status = 'open';
      return { ...t };
    },

    abandon(id: string, reason?: string): TaskNode | null {
      const t = getOrThrow(id);
      t.status = 'abandoned';
      if (reason) t.summary = t.summary + ' [abandoned: ' + reason + ']';
      return { ...t };
    },

    rename(id: string, summary: string): TaskNode | null {
      const t = getOrThrow(id);
      t.summary = summary;
      return { ...t };
    },

    get(id: string): TaskNode | null {
      const t = tasks.get(id);
      return t ? { ...t } : null;
    },

    list(): TaskNode[] {
      return [...tasks.values()].map(t => ({ ...t }));
    },

    dump(): string {
      const all = [...tasks.values()];
      if (all.length === 0) return '';
      const byParent = new Map<string | null, TaskNode[]>();
      for (const t of all) {
        const list = byParent.get(t.parentId) ?? [];
        list.push(t);
        byParent.set(t.parentId, list);
      }

      function render(parentId: string | null, depth: number): string {
        const children = byParent.get(parentId) ?? [];
        return children
          .map(t => {
            const indent = '  '.repeat(depth);
            const status = t.status === 'done' ? '[done]' : t.status === 'blocked' ? '[blocked]' : t.status === 'in_progress' ? '[active]' : t.status === 'abandoned' ? '[abandoned]' : '';
            const line = indent + '- ' + t.id + ' ' + (status ? status + ' ' : '') + t.summary;
            return line + '\n' + render(t.id, depth + 1);
          })
          .join('');
      }

      return render(null, 0).trimEnd();
    },
  };
}