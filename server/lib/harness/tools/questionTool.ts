import { randomUUID } from 'node:crypto';
import type { HarnessTool, HarnessEvent, ToolContext, ToolResult } from '../types';

export type PendingAnswer = {
  decision?: 'allow' | 'allow_always' | 'deny';
  answer?: string;
};

export type PendingEntry = {
  id: string;
  kind: 'question' | 'permission';
  event: HarnessEvent;
  resolve: (answer: PendingAnswer) => void;
  createdAt: number;
};

/** Global pending store keyed by pendingId. Route-level singleton. */
const pendingMap = new Map<string, PendingEntry>();

export function getPendingStore(): Map<string, PendingEntry> {
  return pendingMap;
}

export function createPendingId(): string {
  return 'pend_' + randomUUID().slice(0, 12);
}

export function resolvePending(id: string, answer: PendingAnswer): boolean {
  const entry = pendingMap.get(id);
  if (!entry) return false;
  pendingMap.delete(id);
  entry.resolve(answer);
  return true;
}

/** Helper: create a Promise that blocks until a resume POST resolves it. */
export function createPendingPromise(
  kind: PendingEntry['kind'],
  event: HarnessEvent,
  emitEvent?: (event: HarnessEvent) => void,
): Promise<PendingAnswer> {
  const id = createPendingId();
  return new Promise<PendingAnswer>(resolve => {
    const entry: PendingEntry = {
      id,
      kind,
      event: { ...event, id } as any,
      resolve,
      createdAt: Date.now(),
    };
    pendingMap.set(id, entry);
    try { emitEvent?.(entry.event); } catch { /* */ }
  });
}

function questionExecute(
  args: Record<string, any>,
  _ctx: ToolContext,
  emitEvent?: (event: HarnessEvent) => void,
): Promise<ToolResult> {
  const question = String(args.question || '');
  if (!question) return Promise.resolve({ output: '', error: 'question is required' });
  const options = args.options ? (Array.isArray(args.options) ? args.options.map(String) : []) : undefined;

  return createPendingPromise(
    'question',
    { type: 'question', id: '', question, options },
    emitEvent,
  ).then(answer => {
    return { output: 'User answered: ' + (answer.answer || '(no answer)') };
  });
}

/** Factory that binds the emitEvent for question events. */
export function createQuestionTool(
  emitEvent?: (event: HarnessEvent) => void,
): HarnessTool[] {
  return [
    {
      name: 'question',
      description: 'Ask the user a question and wait for their answer. Use when you need clarification or a decision from the user.',
      capability: 'meta',
      modes: ['build', 'plan'],
      defaultAction: 'allow',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'Question text to present to the user' },
          options: { type: 'array', items: { type: 'string' }, description: 'Optional list of suggested answers' },
        },
        required: ['question'],
      },
      execute: (args, ctx) => questionExecute(args, ctx, emitEvent),
    },
  ];
}