import vm from 'node:vm';

export async function executeTransformNode(
  data: Record<string, any>,
  state: any
): Promise<any> {
  const { code = 'return input;', transformScript, transformType = 'javascript' } = data;
  const script = transformScript || code;
  const variables = state.variables || {};

  try {
    const sandbox = {
      input: safeClone(variables.lastOutput ?? variables.input),
      lastOutput: safeClone(variables.lastOutput),
      state: safeClone(state),
      variables: safeClone(variables),
    };
    const result = vm.runInNewContext(
      `(function (input, lastOutput, state, variables) { "use strict"; ${script}\n})(input, lastOutput, state, variables)`,
      sandbox,
      { timeout: 5000 },
    );

    if (result && typeof result.then === 'function') {
      const awaited = await Promise.race([
        result,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Async transform timed out')), 5000)),
      ]);
      return typeof awaited === 'object' && awaited !== null ? awaited : { result: awaited };
    }

    return typeof result === 'object' && result !== null ? result : { result };
  } catch (err: any) {
    return { error: `Transform failed: ${err.message}`, code: script };
  }
}

function safeClone<T>(value: T): T {
  try { return structuredClone(value); }
  catch { return JSON.parse(JSON.stringify(value)); }
}
