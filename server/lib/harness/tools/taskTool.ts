import type { HarnessTool, HarnessEvent, ToolContext, ToolResult } from '../types';
import type { TaskStore } from '../tasks';

/** Task tools require a live TaskStore bound at execute time. */
export function createTaskTool(
  store: TaskStore,
  emitEvent?: (event: HarnessEvent) => void,
): HarnessTool[] {
  function emitTasks(): void {
    try { emitEvent?.({ type: 'task_update', tasks: store.list() }); } catch { /* */ }
  }

  async function taskExecute(
    args: Record<string, any>,
    _ctx: ToolContext,
  ): Promise<ToolResult> {
    const action = String(args.action || 'list');

    try {
      if (action === 'list') {
        const tasks = store.list();
        if (tasks.length === 0) return { output: 'No tasks.' };
        return { output: store.dump() };
      }

      if (action === 'create') {
        const summary = String(args.summary || '');
        if (!summary) return { output: '', error: 'summary is required' };
        const parentId = args.parent_id ? String(args.parent_id) : null;
        const t = store.create(summary, parentId);
        emitTasks();
        return { output: 'Created ' + t.id + ': ' + t.summary };
      }

      if (action === 'start') {
        const id = String(args.id || '');
        if (!id) return { output: '', error: 'id is required' };
        const t = store.start(id);
        if (t) emitTasks();
        return { output: t ? t.id + ' started: ' + t.summary : 'not found' };
      }

      if (action === 'done') {
        const id = String(args.id || '');
        if (!id) return { output: '', error: 'id is required' };
        const summary = args.summary ? String(args.summary) : undefined;
        const t = store.done(id, summary);
        if (t) emitTasks();
        return { output: t ? t.id + ' done: ' + t.summary : 'not found' };
      }

      if (action === 'block') {
        const id = String(args.id || '');
        if (!id) return { output: '', error: 'id is required' };
        const reason = args.reason ? String(args.reason) : undefined;
        const t = store.block(id, reason);
        if (t) emitTasks();
        return { output: t ? t.id + ' blocked' : 'not found' };
      }

      if (action === 'unblock') {
        const id = String(args.id || '');
        if (!id) return { output: '', error: 'id is required' };
        const t = store.unblock(id);
        if (t) emitTasks();
        return { output: t ? t.id + ' unblocked' : 'not found' };
      }

      if (action === 'abandon') {
        const id = String(args.id || '');
        if (!id) return { output: '', error: 'id is required' };
        const reason = args.reason ? String(args.reason) : undefined;
        const t = store.abandon(id, reason);
        if (t) emitTasks();
        return { output: t ? t.id + ' abandoned' : 'not found' };
      }

      if (action === 'rename') {
        const id = String(args.id || '');
        const summary = String(args.summary || '');
        if (!id || !summary) return { output: '', error: 'id and summary are required' };
        const t = store.rename(id, summary);
        if (t) emitTasks();
        return { output: t ? t.id + ' renamed: ' + t.summary : 'not found' };
      }

      return { output: '', error: 'Unknown action: ' + action };
    } catch (err: any) {
      return { output: '', error: err.message };
    }
  }

  return [
    {
      name: 'task',
      description:
        'Manage a task tree. Actions: create (summary, parent_id?), start (id), done (id, summary?), block (id, reason?), unblock (id), abandon (id, reason?), rename (id, summary), list.',
      capability: 'meta' as const,
      modes: ['build' as const, 'plan' as const],
      defaultAction: 'allow' as const,
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'Action to perform',
            enum: ['create', 'start', 'done', 'block', 'unblock', 'abandon', 'rename', 'list'],
          },
          id: { type: 'string', description: 'Task ID (T1, T1.1, ...)' },
          parent_id: { type: 'string', description: 'Parent task ID for subtasks' },
          summary: { type: 'string', description: 'Task summary text' },
          reason: { type: 'string', description: 'Reason for block or abandon' },
        },
        required: [],
      },
      execute: taskExecute,
    },
  ];
}