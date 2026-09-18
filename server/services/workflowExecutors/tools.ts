export async function executeGuardrailsNode(
  data: Record<string, any>,
  state: any
): Promise<any> {
  const checks = data.checks || {};
  const {
    piiEnabled = checks.pii ?? false,
    moderationEnabled = checks.moderation ?? false,
    jailbreakEnabled = checks.jailbreak ?? false,
    hallucinationEnabled = false,
    guardrailType = 'moderation',
    actionOnViolation = data.action || 'block',
  } = data;

  const variables = state.variables || {};
  const input = typeof variables.lastOutput === 'string'
    ? variables.lastOutput
    : JSON.stringify(variables.lastOutput || '');

  const violations: string[] = [];

  if (piiEnabled || guardrailType === 'pii') {
    const piiPatterns = [
      { name: 'email', pattern: /[\w.-]+@[\w.-]+\.\w+/g },
      { name: 'phone', pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g },
      { name: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
      { name: 'credit_card', pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g },
      { name: 'ip_address', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g },
    ];
    for (const { name, pattern } of piiPatterns) {
      if (pattern.test(input)) {
        violations.push(`PII detected: ${name}`);
      }
    }
  }

  if (moderationEnabled || guardrailType === 'moderation') {
    const flagged = /\b(hack|exploit|malware|phishing|spam)\b/i.test(input);
    if (flagged) violations.push('Content moderation: flagged terms detected');
  }

  if (jailbreakEnabled || guardrailType === 'jailbreak') {
    const jailbreakPatterns = [
      /ignore\s+(previous|all|above)\s+instructions/i,
      /you\s+are\s+now\s+(?:a|an)\s+(?:evil|unrestricted)/i,
      /DAN\s+mode/i,
      /jailbreak/i,
    ];
    for (const pattern of jailbreakPatterns) {
      if (pattern.test(input)) {
        violations.push('Jailbreak attempt detected');
        break;
      }
    }
  }

  const passed = violations.length === 0;

  return {
    passed,
    violations,
    action: passed ? 'allow' : actionOnViolation,
    input: passed ? input : (actionOnViolation === 'block' ? '[BLOCKED]' : input),
    scanType: guardrailType,
  };
}
