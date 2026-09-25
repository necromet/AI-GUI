import vm from 'node:vm';

export function substituteVariables(template: string, state: any): string {
  if (!template || typeof template !== 'string') return template;
  const variables = state?.variables || {};
  const withDynamicIndexes = template.replace(/\{\{([a-zA-Z0-9_.]+)\[\{\{([a-zA-Z0-9_.]+)\}\}\]\}\}/g, (match, collectionPath, indexPath) => {
    const collection = readPath(variables, collectionPath) ?? readPath(variables.input, collectionPath);
    const index = readPath(variables, indexPath) ?? readPath(variables.input, indexPath);
    const value = collection?.[Number(index)];
    return value === undefined ? match : typeof value === 'string' ? value : JSON.stringify(value);
  });
  return withDynamicIndexes.replace(/\{\{([a-zA-Z0-9_.\[\]]+)\}\}/g, (_, path) => {
    let value = readPath(variables, path);
    if (value === undefined && variables.input && typeof variables.input === 'object') value = readPath(variables.input, path);
    if (value === undefined) value = readPath(state, path);
    if (value === undefined) return `{{${path}}}`;
    return typeof value === 'string' ? value : JSON.stringify(value);
  });
}

function readPath(root: any, path: string): any {
  const tokens = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let value = root;
  for (const token of tokens) {
    if (value === undefined || value === null) return undefined;
    value = value[token];
  }
  return value;
}

export function resolveVariableRef(ref: string, variables: Record<string, any>): any {
  if (!ref || typeof ref !== 'string') return ref;
  if (ref.startsWith('$')) {
    const path = ref.slice(1);
    return path.split('.').reduce((obj: any, key: string) => obj?.[key], variables);
  }
  return variables[ref] ?? ref;
}

export function setObjectPath(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

export async function executeSetStateNode(
  data: Record<string, any>,
  state: any
): Promise<any> {
  const { variables: varDefs = {}, variableTypes = {} } = data;
  const updates: Record<string, any> = {};
  const variables = state.variables || {};

  for (const [key, rawValue] of Object.entries(varDefs)) {
    const type = variableTypes[key] || 'string';
    let value = rawValue;

    // Apply variable substitution to string values
    if (typeof value === 'string') {
      value = substituteVariables(value, state);
    }

    // Parse based on declared type
    switch (type) {
      case 'number':
        updates[key] = Number(value);
        break;
      case 'boolean':
        updates[key] = value === true || value === 'true';
        break;
      case 'json':
        try { updates[key] = typeof value === 'string' ? JSON.parse(value) : value; }
        catch { updates[key] = value; }
        break;
      case 'expression':
        try {
          updates[key] = vm.runInNewContext(`(${value})`, {
            input: structuredClone(variables.input),
            lastOutput: structuredClone(variables.lastOutput),
            state: structuredClone(state),
            variables: structuredClone(variables),
          }, { timeout: 1000 });
        } catch { updates[key] = value; }
        break;
      default:
        updates[key] = value;
    }
  }

  return { stateUpdates: updates };
}
