import type {
  ConditionEvaluationResult,
  ConditionMode,
  ConditionOperator,
  ConditionRule,
  ConditionalNodeData,
} from './types.js';

export const UNARY_CONDITION_OPERATORS = new Set<ConditionOperator>([
  'empty', 'not_empty', 'truthy', 'falsy',
]);

export const CONDITION_OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: 'equals',
  neq: 'does not equal',
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
  empty: 'is empty',
  not_empty: 'is not empty',
  truthy: 'is true',
  falsy: 'is false',
  gt: 'is greater than',
  gte: 'is greater than or equal to',
  lt: 'is less than',
  lte: 'is less than or equal to',
  matches: 'matches regex',
};

export interface WorkflowConditionState {
  variables?: Record<string, any>;
  [key: string]: any;
}

export function resolveConditionMode(data: ConditionalNodeData): ConditionMode | null {
  if (data.conditionMode === 'simple' || data.conditionMode === 'expression') return data.conditionMode;
  if (data.conditionRule) return 'simple';
  if (String(data.condition || '').trim()) return 'expression';
  return null;
}

export function validateConditionRule(rule?: ConditionRule): string | null {
  if (!rule) return 'Choose a condition rule';
  if (!String(rule.left || '').trim()) return 'Choose a value to check';
  if (!CONDITION_OPERATOR_LABELS[rule.op]) return 'Choose a valid operator';
  if (!UNARY_CONDITION_OPERATORS.has(rule.op) && !String(rule.right ?? '').trim()) return 'Enter a comparison value';
  return null;
}

export function validateConditionNode(data: ConditionalNodeData): string | null {
  const mode = resolveConditionMode(data);
  if (!mode) return 'needs a condition';
  if (mode === 'simple') return validateConditionRule(data.conditionRule);
  return String(data.condition || '').trim() ? null : 'Enter a JavaScript expression';
}

export function resolveConditionValue(path: string, state: WorkflowConditionState): unknown {
  const cleanPath = String(path || '').trim().replace(/^\{\{\s*|\s*\}\}$/g, '');
  if (!cleanPath) return undefined;
  const variables = state.variables || {};
  let root: unknown;
  let rest: string[];

  const parts = tokenizePath(cleanPath);
  const first = parts[0];
  if (first === 'input') {
    root = variables.input;
    rest = parts.slice(1);
  } else if (first === 'lastOutput') {
    root = variables.lastOutput;
    rest = parts.slice(1);
  } else if (first === 'variables') {
    root = variables;
    rest = parts.slice(1);
  } else if (first === 'state') {
    if (parts[1] === 'variables') {
      root = variables;
      rest = parts.slice(2);
    } else {
      root = variables;
      rest = parts.slice(1);
    }
  } else {
    root = variables[first];
    rest = parts.slice(1);
    if (rest[0] === 'output') rest = rest.slice(1);
  }

  return rest.reduce<unknown>((value, key) => value == null ? undefined : (value as any)[key], root);
}

export function formatConditionRule(rule?: ConditionRule): string {
  if (!rule) return 'Set condition';
  const operator = CONDITION_OPERATOR_LABELS[rule.op] || rule.op;
  if (UNARY_CONDITION_OPERATORS.has(rule.op)) return `${rule.left || 'value'} ${operator}`;
  const right = /^\{\{.*\}\}$/.test(String(rule.right || '').trim())
    ? String(rule.right).trim()
    : `"${String(rule.right ?? '')}"`;
  return `${rule.left || 'value'} ${operator} ${right}`;
}

export function evaluateConditionRule(rule: ConditionRule, state: WorkflowConditionState): ConditionEvaluationResult {
  const validationError = validateConditionRule(rule);
  const summary = formatConditionRule(rule);
  if (validationError) return failure(summary, validationError);

  const leftValue = resolveConditionValue(rule.left, state);
  const rightText = String(rule.right ?? '').trim();
  const rightValue = /^\{\{[\s\S]+\}\}$/.test(rightText)
    ? resolveConditionValue(rightText, state)
    : rule.right;

  try {
    const result = applyOperator(rule.op, leftValue, rightValue, Boolean(rule.caseSensitive));
    return {
      result,
      branch: result ? 'if' : 'else',
      source: 'simple',
      summary,
      leftValue,
      rightValue,
    };
  } catch (error: any) {
    return failure(summary, error?.message || 'Condition evaluation failed', leftValue, rightValue);
  }
}

function applyOperator(op: ConditionOperator, left: unknown, right: unknown, caseSensitive: boolean): boolean {
  if (op === 'empty' || op === 'not_empty') {
    const isEmpty = left == null || left === '' || (Array.isArray(left) && left.length === 0);
    return op === 'empty' ? isEmpty : !isEmpty;
  }
  if (op === 'truthy') return Boolean(left);
  if (op === 'falsy') return !left;

  if (['gt', 'gte', 'lt', 'lte'].includes(op)) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) throw new Error('Numeric comparison requires valid numbers');
    if (op === 'gt') return leftNumber > rightNumber;
    if (op === 'gte') return leftNumber >= rightNumber;
    if (op === 'lt') return leftNumber < rightNumber;
    return leftNumber <= rightNumber;
  }

  const normalize = (value: unknown) => {
    const text = String(value ?? '');
    return caseSensitive ? text : text.toLocaleLowerCase();
  };
  const leftText = normalize(left);
  const rightText = normalize(right);
  if (op === 'eq') return leftText === rightText;
  if (op === 'neq') return leftText !== rightText;
  if (op === 'contains') return leftText.includes(rightText);
  if (op === 'not_contains') return !leftText.includes(rightText);
  if (op === 'starts_with') return leftText.startsWith(rightText);
  if (op === 'ends_with') return leftText.endsWith(rightText);
  if (op === 'matches') {
    const regex = new RegExp(String(right ?? ''), caseSensitive ? '' : 'i');
    return regex.test(String(left ?? ''));
  }
  throw new Error(`Unsupported condition operator: ${op}`);
}

function failure(summary: string, error: string, leftValue?: unknown, rightValue?: unknown): ConditionEvaluationResult {
  return { result: false, branch: 'else', source: 'simple', summary, leftValue, rightValue, error };
}

function tokenizePath(path: string): string[] {
  return path.replace(/\[(\d+)\]/g, '.$1').split('.').map(part => part.trim()).filter(Boolean);
}
