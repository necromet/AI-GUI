export function exampleExecutionInput(nodes: any[], message: string): string | Record<string, string> {
  const startNode = nodes.find(node => (node.data?.nodeType || node.type) === 'start');
  const variables = Array.isArray(startNode?.data?.inputVariables) ? startNode.data.inputVariables : [];
  const names = variables.map((variable: any) => variable.name).filter((name: unknown): name is string => typeof name === 'string' && name.trim().length > 0);
  return names.length > 0 ? Object.fromEntries(names.map(name => [name, message])) : message;
}
