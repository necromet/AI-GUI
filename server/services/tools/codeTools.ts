import { runInNewContext } from 'vm';

export async function toolExecuteCode(code: string): Promise<string> {
  if (!code) return 'Error: No code provided';

  const logs: string[] = [];
  const context = {
    console: {
      log: (...args: any[]) => {
        logs.push(args.map(a => {
          if (typeof a === 'object') {
            try { return JSON.stringify(a, null, 2); } catch { return String(a); }
          }
          return String(a);
        }).join(' '));
      },
      error: (...args: any[]) => {
        logs.push('[error] ' + args.map(String).join(' '));
      },
      warn: (...args: any[]) => {
        logs.push('[warn] ' + args.map(String).join(' '));
      },
    },
    Math,
    Date,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Promise,
  };

  try {
    runInNewContext(code, context, { timeout: 5000 });
    return logs.length > 0 ? logs.join('\n') : '(no output)';
  } catch (err: any) {
    const errorMsg = err.message || 'Execution error';
    return logs.length > 0
      ? logs.join('\n') + `\n[error] ${errorMsg}`
      : `Error: ${errorMsg}`;
  }
}
