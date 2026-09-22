import { timingSafeEqual } from 'node:crypto';

export function canExecutePublishedWorkflow(authorization: string | undefined, workflow: any): boolean {
  if (!authorization?.startsWith('Bearer ')) return true;
  if (!workflow?.published || !workflow?.api_key) return false;
  const provided = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(String(workflow.api_key));
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
