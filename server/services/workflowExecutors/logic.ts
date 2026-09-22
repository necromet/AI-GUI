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
