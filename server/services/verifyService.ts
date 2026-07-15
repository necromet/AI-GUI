const verifyResults = new Map<string, { errors: string[]; success: boolean; timestamp: number }>();

export function setVerifyResult(componentId: string, errors: string[], success: boolean): void {
  verifyResults.set(componentId, { errors: errors || [], success, timestamp: Date.now() });
}

export function waitForVerifyResult(componentId: string, timeoutMs: number): Promise<{ errors: string[]; success: boolean } | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const result = verifyResults.get(componentId);
      if (result && result.timestamp >= start) {
        verifyResults.delete(componentId);
        resolve({ errors: result.errors, success: result.success });
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolve(null);
        return;
      }
      setTimeout(check, 200);
    };
    check();
  });
}
