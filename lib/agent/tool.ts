import { z } from 'zod';

export interface ToolContext {
  sessionId: string;
  agent: string;
  abort: AbortSignal;
  metadata(data: Record<string, any>): void;
  ask(question: string): Promise<string>;
}

export interface ToolResult {
  title: string;
  output: string;
  metadata?: Record<string, any>;
  error?: string;
}

export interface ToolDef<P extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  parameters: P;
  execute: (args: z.infer<P>, ctx: ToolContext) => Promise<ToolResult>;
  permission?: string;
}

export interface ToolInfo {
  name: string;
  description: string;
  parameters: P;
  execute: (args: any, ctx: ToolContext) => Promise<ToolResult>;
  permission: string;
  jsonSchema: Record<string, any>;
}

export function defineTool<P extends z.ZodTypeAny>(config: {
  name: string;
  description: string;
  parameters: P;
  execute: (args: z.infer<P>, ctx: ToolContext) => Promise<ToolResult>;
  permission?: string;
}): ToolInfo {
  return {
    name: config.name,
    description: config.description,
    parameters: config.parameters,
    execute: config.execute,
    permission: config.permission || config.name,
    jsonSchema: zodToJsonSchema(config.parameters),
  };
}

function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, any> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodFieldToJsonSchema(value as z.ZodTypeAny);
      if (!(value as any).isOptional()) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  return { type: 'object', properties: {} };
}

function zodFieldToJsonSchema(field: z.ZodTypeAny): Record<string, any> {
  if (field instanceof z.ZodString) return { type: 'string' };
  if (field instanceof z.ZodNumber) return { type: 'number' };
  if (field instanceof z.ZodBoolean) return { type: 'boolean' };
  if (field instanceof z.ZodArray) {
    return { type: 'array', items: zodFieldToJsonSchema(field._def.type) };
  }
  if (field instanceof z.ZodOptional) {
    return zodFieldToJsonSchema(field._def.innerType);
  }
  if (field instanceof z.ZodEnum) {
    return { type: 'string', enum: field._def.values };
  }
  if (field instanceof z.ZodUnion) {
    const options = field._def.options as z.ZodTypeAny[];
    return { oneOf: options.map(zodFieldToJsonSchema) };
  }
  return { type: 'string' };
}

export function toolsToOpenAI(tools: ToolInfo[]): any[] {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.jsonSchema,
    },
  }));
}
