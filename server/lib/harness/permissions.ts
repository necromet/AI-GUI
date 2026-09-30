import type { PermissionAction, PermissionRule, ToolMeta } from './types';

const REGEX_SPECIAL = new Set(['.', '+', '^', '$', '{', '}', '(', ')', '|', '[', ']', String.fromCharCode(92)]);

/** Minimal glob: star matches within a path segment, double-star matches across slashes. Double-star slash also matches zero dirs. */
export function globToRegExp(pattern: string): RegExp {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      if (pattern[i + 2] === '/') {
        out += '(?:.*/)?';
        i += 2;
      } else {
        out += '.*';
        i++;
      }
    } else if (c === '*') {
      out += '[^/]*';
    } else if (c === '?') {
      out += '[^/]';
    } else if (REGEX_SPECIAL.has(c)) {
      out += String.fromCharCode(92) + c;
    } else {
      out += c;
    }
  }
  return new RegExp('^' + out + '$', 'i');
}

export function matchGlob(pattern: string, value: string): boolean {
  return globToRegExp(pattern).test(value);
}

/**
 * Evaluate the effective permission for a tool invocation.
 * Later rules win over earlier ones when both match.
 */
export function evaluatePermission(
  rules: PermissionRule[],
  tool: string,
  path: string | undefined,
  toolMeta?: Pick<ToolMeta, 'defaultAction'>,
): PermissionAction {
  let action: PermissionAction = toolMeta?.defaultAction ?? 'ask';

  for (const rule of rules) {
    if (!matchGlob(rule.tool, tool)) continue;
    if (rule.pattern !== undefined) {
      if (path === undefined) continue;
      if (!matchGlob(rule.pattern, path)) continue;
    }
    action = rule.action;
  }

  return action;
}

export const DEFAULT_PERMISSIONS: PermissionRule[] = [
  { tool: 'read', action: 'allow' },
  { tool: 'glob', action: 'allow' },
  { tool: 'grep', action: 'allow' },
  { tool: 'webfetch', action: 'allow' },
  { tool: 'websearch', action: 'allow' },
  { tool: 'write', action: 'ask' },
  { tool: 'edit', action: 'ask' },
  { tool: 'bash', action: 'ask' },
];
