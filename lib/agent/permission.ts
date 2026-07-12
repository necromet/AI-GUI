export type PermissionAction = 'allow' | 'deny' | 'ask';

export interface PermissionRule {
  permission: string;
  pattern: string;
  action: PermissionAction;
}

export type Ruleset = PermissionRule[];

export function evaluate(permission: string, pattern: string, ...rulesets: Ruleset[]): PermissionRule {
  const all = rulesets.flat();
  const match = all.findLast(
    (rule) => wildcardMatch(permission, rule.permission) && wildcardMatch(pattern, rule.pattern),
  );
  return match || { permission, pattern: '*', action: 'ask' };
}

function wildcardMatch(value: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === value) return true;

  const regex = new RegExp(
    '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
  );
  return regex.test(value);
}

export const DEFAULT_PERMISSIONS: Ruleset = [
  { permission: '*', pattern: '*', action: 'allow' },
];

export const LIBRARY_PERMISSIONS: Ruleset = [
  { permission: '*', pattern: '*', action: 'allow' },
  { permission: 'delete_component_file', pattern: '*', action: 'ask' },
  { permission: 'delete_component', pattern: '*', action: 'ask' },
];

export function mergeRulesets(...rulesets: Ruleset[]): Ruleset {
  return rulesets.flat();
}
