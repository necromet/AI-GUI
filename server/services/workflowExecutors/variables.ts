export function substituteVariables(template: string, state: any): string {
  if (!template || typeof template !== 'string') return template;
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
    const parts = path.split('.');
    let value: any = state;
    for (const part of parts) {
      if (value === undefined || value === null) return `{{${path}}}`;
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        value = value[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
      } else {
        value = value[part];
      }
    }
    if (value === undefined) return `{{${path}}}`;
    return typeof value === 'string' ? value : JSON.stringify(value);
  });
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
  const { variables: varDefs = {} } = data;
  const updates: Record<string, any> = {};
  const variables = state.variables || {};

  for (const [key, value] of Object.entries(varDefs)) {
    if (typeof value === 'string') {
      updates[key] = substituteVariables(value, state);
    } else {
      updates[key] = value;
    }
  }

  return { stateUpdates: updates };
}
