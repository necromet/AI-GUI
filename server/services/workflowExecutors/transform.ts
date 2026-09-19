export async function executeTransformNode(
  data: Record<string, any>,
  state: any
): Promise<any> {
  const { code = 'return input;', transformScript, transformType = 'javascript' } = data;
  const script = transformScript || code;
  const variables = state.variables || {};

  try {
    const fn = new Function('input', 'lastOutput', 'state', 'variables', 'JSON', 'Math', 'Date', 'String', 'Number', 'Boolean', 'Array', 'Object', script);
    const result = fn(
      variables.lastOutput || variables.input,
      variables.lastOutput,
      state,
      variables,
      JSON, Math, Date, String, Number, Boolean, Array, Object
    );

    if (result && typeof result.then === 'function') {
      const awaited = await result;
      return typeof awaited === 'object' && awaited !== null ? awaited : { result: awaited };
    }

    return typeof result === 'object' && result !== null ? result : { result };
  } catch (err: any) {
    return { error: `Transform failed: ${err.message}`, code: script };
  }
}
