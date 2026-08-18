export function substituteVariables(template: string, state: any): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const parts = path.trim().split('.');
    let value: any = state;
    for (const part of parts) {
      if (value === undefined || value === null) return match;
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        value = value[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
      } else {
        value = value[part];
      }
    }
    return typeof value === 'string' ? value : JSON.stringify(value ?? match);
  });
}
