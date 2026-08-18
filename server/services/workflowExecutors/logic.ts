import { runInNewContext } from 'vm';
import { substituteVariables } from './variables.js';

export async function executeTransformNode(data: Record<string, any>, state: any) {
  const { code } = data;
  if (!code) return { output: state.variables };

  const sandbox: Record<string, any> = {
    input: state.variables,
    lastOutput: state.variables?.lastOutput,
    ...state.variables,
  };

  try {
    runInNewContext(code, sandbox, { timeout: 5000 });
    return { output: sandbox.result ?? sandbox };
  } catch (err: any) {
    throw new Error(`Transform error: ${err.message}`);
  }
}

export async function executeIfElseNode(data: Record<string, any>, state: any) {
  const { condition } = data;
  if (!condition) return { branch: 'if' };

  const resolved = substituteVariables(condition, state);

  try {
    const result = new Function('state', `return ${resolved}`)(state.variables);
    return { branch: result ? 'if' : 'else', conditionResult: result };
  } catch {
    return { branch: 'else', conditionResult: false };
  }
}

export async function executeWhileNode(data: Record<string, any>, state: any) {
  const { condition, maxIterations } = data;
  const max = maxIterations || 10;
  const currentIteration = (state.nodeResults?.[data.nodeId]?.output?.iteration || 0) + 1;

  if (currentIteration > max) {
    return { shouldContinue: false, iteration: currentIteration, reason: 'max iterations reached' };
  }

  if (!condition) return { shouldContinue: true, iteration: currentIteration };

  const resolved = substituteVariables(condition, state);
  try {
    const result = new Function('state', `return ${resolved}`)(state.variables);
    return { shouldContinue: !!result, iteration: currentIteration };
  } catch {
    return { shouldContinue: false, iteration: currentIteration };
  }
}

export async function executeUserApprovalNode(data: Record<string, any>, _state: any) {
  const approvalId = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  return {
    __pendingApproval: true,
    approvalId,
    message: data.message || 'This action requires your approval.',
    nodeId: data.nodeId,
  };
}
