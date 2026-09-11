export async function executeIfElseNode(
  data: Record<string, any>,
  state: any
): Promise<any> {
  const { condition = 'true' } = data;
  const variables = state.variables || {};

  try {
    const evalFn = new Function('input', 'state', 'lastOutput', 'variables', `return ${condition}`);
    const result = evalFn(variables.input, state, variables.lastOutput, variables);
    return {
      branch: result ? 'if' : 'else',
      conditionResult: Boolean(result),
      evaluatedExpression: condition,
    };
  } catch (err: any) {
    return {
      branch: 'else',
      conditionResult: false,
      error: `Condition evaluation failed: ${err.message}`,
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
    const evalFn = new Function('input', 'state', 'lastOutput', 'variables', 'iteration', `return ${condition}`);
    const iteration = variables.__iteration || 0;
    const shouldContinue = Boolean(
      evalFn(variables.input, state, variables.lastOutput, variables, iteration)
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

export async function executeTransformNode(
  data: Record<string, any>,
  state: any
): Promise<any> {
  const { code = 'return input;', transformScript } = data;
  const script = transformScript || code;
  const variables = state.variables || {};

  try {
    const fn = new Function('input', 'lastOutput', 'state', 'variables', script);
    const result = fn(variables.lastOutput || variables.input, variables.lastOutput, state, variables);
    return typeof result === 'object' ? result : { result };
  } catch (err: any) {
    return { error: `Transform failed: ${err.message}` };
  }
}
