import type { HarnessConfig, HarnessMode, PermissionAction, PermissionRule } from './types';
import type { HarnessTool, ToolContext, ToolResult } from './types';
import { evaluatePermission, DEFAULT_PERMISSIONS } from './permissions';
import { fsTools } from './tools/fsTools';
import { shellTools } from './tools/shellTool';
import { webTools } from './tools/webTools';
import { skillTools } from './tools/skillTool';
import { memoryTools } from './tools/memoryTool';

export function builtinTools(): HarnessTool[] {
  return [...fsTools, ...shellTools, ...webTools, ...skillTools, ...memoryTools];
}

export interface OpenAIToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export class ToolRegistry {
  private tools = new Map<string, HarnessTool>();

  constructor(tools: HarnessTool[] = builtinTools()) {
    for (const t of tools) this.tools.set(t.name, t);
  }

  register(tool: HarnessTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): HarnessTool | undefined {
    return this.tools.get(name);
  }

  list(mode: HarnessMode, config?: Partial<HarnessConfig>): HarnessTool[] {
    const enabled = config?.tools;
    return [...this.tools.values()].filter(t => {
      if (!t.modes.includes(mode)) return false;
      if (enabled && enabled[t.name] === false) return false;
      return true;
    });
  }

  toOpenAITools(mode: HarnessMode, config?: Partial<HarnessConfig>): OpenAIToolDef[] {
    return this.list(mode, config).map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  permissionFor(
    name: string,
    path: string | undefined,
    rules: PermissionRule[] = [],
  ): PermissionAction {
    const tool = this.tools.get(name);
    return evaluatePermission(
      [...DEFAULT_PERMISSIONS, ...rules],
      name,
      path,
      tool ? { defaultAction: tool.defaultAction } : undefined,
    );
  }

  async execute(
    name: string,
    args: Record<string, any>,
    ctx: ToolContext,
    rules: PermissionRule[] = [],
  ): Promise<ToolResult & { permission: PermissionAction }> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { output: '', error: 'Unknown tool: ' + name, permission: 'deny' };
    }
    if (!tool.modes.includes(ctx.mode)) {
      return { output: '', error: 'Tool not available in ' + ctx.mode + ' mode: ' + name, permission: 'deny' };
    }

    const pathArg = typeof args?.path === 'string' ? args.path : undefined;
    const permission = this.permissionFor(name, pathArg, rules);

    if (permission === 'deny') {
      return { output: '', error: 'Permission denied for ' + name, permission };
    }
    // 'ask' is enforced by the runner (emits permission_request); execute assumes approval.

    try {
      const result = await tool.execute(args || {}, ctx);
      return { ...result, permission };
    } catch (err: any) {
      return { output: '', error: err?.message || String(err), permission };
    }
  }
}

export function createRegistry(tools?: HarnessTool[]): ToolRegistry {
  return new ToolRegistry(tools);
}
