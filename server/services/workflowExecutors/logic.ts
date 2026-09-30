import vm from 'node:vm';
import {
  evaluateConditionRule,
  resolveConditionMode,
  validateConditionNode,
} from '../../../lib/workflow/conditions.js';
import type { ConditionalNodeData } from '../../../lib/workflow/types.js';

export async function executeIfElseNode(
  data: Record<string, any>,
  state: any
): Promise<any> {
  const variables = state.variables || {};
  const conditionData = data as ConditionalNodeData;
  const mode = resolveConditionMode(conditionData);
  const validationError = validateConditionNode(conditionData);

  if (!mode || validationError) {
    return {
      branch: 'else',
      conditionResult: false,
      conditionSource: mode || 'simple',
      conditionSummary: mode === 'expression' ? String(data.condition || '') : 'Set condition',
      evaluationError: validationError || 'Condition is incomplete',
    };
  }

  if (mode === 'simple') {
    const evaluation = evaluateConditionRule(conditionData.conditionRule!, state);
    return {
      branch: evaluation.branch,
      conditionResult: evaluation.result,
      conditionSource: evaluation.source,
      conditionSummary: evaluation.summary,
      leftValue: evaluation.leftValue,
      rightValue: evaluation.rightValue,
      evaluationError: evaluation.error,
    };
  }

  const condition = String(conditionData.condition || '').trim();

  try {
    const result = vm.runInNewContext(`Boolean(${condition})`, evaluationContext(state, variables, 0), { timeout: 1000 });
    return {
      branch: result ? 'if' : 'else',
      conditionResult: Boolean(result),
      conditionSource: 'expression',
      conditionSummary: condition,
      evaluatedExpression: condition,
    };
  } catch (err: any) {
    return {
      branch: 'else',
      conditionResult: false,
      conditionSource: 'expression',
      conditionSummary: condition,
      evaluatedExpression: condition,
      evaluationError: `Condition evaluation failed: ${err.message}`,
    };
  }
}

export async function executeWhileNode(
  data: Record<string, any>,
  state: any
): Promise<any> {
  const { condition = 'false', maxIterations = 10 } = data;
  const ABSOLUTE_MAX = 100;
  const effectiveMax = Math.min(Number(maxIterations) || 10, ABSOLUTE_MAX);
  const variables = state.variables || {};

  try {
    const iteration = Number(data.__iteration ?? variables.__iteration ?? 0);
    const shouldContinue = Boolean(
      vm.runInNewContext(`Boolean(${condition})`, evaluationContext(state, variables, iteration), { timeout: 1000 })
    );

    if (!shouldContinue) {
      return {
        shouldContinue: false,
        condition: false,
        iteration,
        stoppedReason: 'condition_false',
      };
    }

    if (iteration >= effectiveMax) {
      return {
        shouldContinue: false,
        condition: false,
        iteration,
        stoppedReason: 'max_iterations',
      };
    }

    return {
      shouldContinue: true,
      condition: true,
      index: iteration,
      iteration: iteration + 1,
      __iteration: iteration + 1,
    };
  } catch (err: any) {
    return {
      shouldContinue: false,
      condition: false,
      error: `While condition failed: ${err.message}`,
      stoppedReason: 'error',
    };
  }
}

const ABSOLUTE_MAX_ITEMS = 1000;

export async function executeForEachNode(
  data: Record<string, any>,
  state: any
): Promise<any> {
  const variables = state.variables || {};
  const nodeKey = data.__nodeId ? `${data.__nodeId}__` : '';
  const itemVar = String(data.itemVar || 'item').trim() || 'item';
  const indexVar = String(data.indexVar || 'index').trim() || 'index';
  const maxItems = Math.min(Number(data.maxItems) || 100, ABSOLUTE_MAX_ITEMS);
  const index = Math.max(0, Number(data.__index ?? 0) || 0);
  const priorResults: any[] = Array.isArray(variables[`${nodeKey}results`])
    ? variables[`${nodeKey}results`]
    : [];

  try {
    const items = Array.isArray(data.__items)
      ? data.__items
      : toArrayItems(resolveItemsExpression(data.items ?? data.forEachItems, state, variables, index));

    const results = [...priorResults];
    if (index > 0) results.push(variables.lastOutput);

    if (index >= items.length) {
      return {
        output: {
          shouldContinue: false,
          total: items.length,
          processed: results.length,
          results,
          stoppedReason: items.length === 0 ? 'empty' : 'done',
        },
        variableUpdates: { [`${nodeKey}results`]: results },
      };
    }

    if (index >= maxItems) {
      return {
        output: {
          shouldContinue: false,
          total: items.length,
          processed: results.length,
          results,
          stoppedReason: 'max_items',
        },
        variableUpdates: { [`${nodeKey}results`]: results },
      };
    }

    const item = items[index];
    return {
      output: {
        shouldContinue: true,
        item,
        index,
        total: items.length,
      },
      variableUpdates: {
        [itemVar]: item,
        [indexVar]: index,
        [`${nodeKey}results`]: results,
        [`${nodeKey}index`]: index + 1,
        [`${nodeKey}items`]: items,
      },
    };
  } catch (err: any) {
    return {
      error: `For-each failed: ${err.message}`,
      stoppedReason: 'error',
    };
  }
}

function resolveItemsExpression(items: any, state: any, variables: Record<string, any>, index: number): any {
  const expression = String(items ?? '').trim();
  if (!expression) throw new Error('Items expression is empty');
  return vm.runInNewContext(expression, evaluationContext(state, variables, index), { timeout: 1000 });
}

function toArrayItems(rawItems: any): any[] {
  if (rawItems === undefined || rawItems === null) return [];
  if (Array.isArray(rawItems)) return rawItems;
  if (typeof rawItems === 'string') {
    const trimmed = rawItems.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [rawItems];
      }
    }
    return [rawItems];
  }
  if (typeof rawItems === 'object' && typeof (rawItems as any).length === 'number') {
    return Array.from(rawItems as ArrayLike<any>);
  }
  return [rawItems];
}

function evaluationContext(state: any, variables: Record<string, any>, iteration: number) {
  return {
    input: safeClone(variables.input),
    state: safeClone(state),
    lastOutput: safeClone(variables.lastOutput),
    variables: safeClone(variables),
    iteration,
  };
}

function safeClone<T>(value: T): T {
  try { return structuredClone(value); }
  catch { return JSON.parse(JSON.stringify(value)); }
}

export async function executeUserApprovalNode(
  data: Record<string, any>,
  _state: any
): Promise<any> {
  const { message = 'Approve to continue?', timeoutMinutes } = data;
  const approvalId = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    __pendingApproval: true,
    approvalId,
    message,
    status: 'pending',
    createdAt: new Date().toISOString(),
    timeoutMinutes: timeoutMinutes || undefined,
  };
}
