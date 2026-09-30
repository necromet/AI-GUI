export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 1,
  backoffMs: 500,
  backoffMultiplier: 2,
};

export const RETRYABLE_NODE_TYPES = new Set([
  'agent',
  'mcp',
  'arcade',
  'http',
  'database',
  'web-source',
  'extract',
  'transform',
]);

const NON_RETRIABLE_PATTERNS = [
  /not configured/i,
  /no api key/i,
  /no .* key/i,
  /add .* api key/i,
  /missing required/i,
  /needs a /i,
  /unsupported/i,
  /unknown .* mode/i,
  /unknown .* action/i,
  /is empty/i,
  /unresolved variables/i,
  /select postgresql/i,
  /select a saved/i,
  /enter a read-only/i,
  /no extraction schema/i,
  /no mcp server/i,
  /authorization rejected/i,
  /validation/i,
];

const RETRIABLE_PATTERNS = [
  /network/i,
  /fetch failed/i,
  /http request failed/i,
  /web fetch failed/i,
  /web search failed/i,
  /fetch failed with status (429|5\d\d)/i,
  /status (429|5\d\d)\b/i,
  /\b(429|500|502|503|504)\b/,
  /rate limit/i,
  /too many requests/i,
  /timeout/i,
  /timed out/i,
  /etimedout/i,
  /econnreset/i,
  /econnrefused/i,
  /epipe/i,
  /enotfound/i,
  /eai_again/i,
  /socket hang up/i,
  /network error/i,
  /temporarily unavailable/i,
  /service unavailable/i,
  /bad gateway/i,
  /gateway timeout/i,
  /overloaded/i,
  /capacity/i,
  /aborted/i,
  /abort/i,
  /dns/i,
  /tls/i,
  /certificate/i,
  /postgres.* (failed|error)/i,
  /query failed/i,
  /document retrieval failed/i,
  /llm extraction failed/i,
  /firecrawl error/i,
];

export function normalizeRetryPolicy(raw: unknown): RetryPolicy {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const maxAttempts = clampInt(data.maxAttempts, 1, 5, DEFAULT_RETRY_POLICY.maxAttempts);
  const backoffMs = clampInt(data.backoffMs, 0, 30_000, DEFAULT_RETRY_POLICY.backoffMs);
  const backoffMultiplier = clampNumber(data.backoffMultiplier, 1, 5, DEFAULT_RETRY_POLICY.backoffMultiplier);
  return { maxAttempts, backoffMs, backoffMultiplier };
}

export function isRetriableFailure(message: unknown, output?: any): boolean {
  if (isRetriableStatus(output?.status)) return true;
  const text = String(message || '');
  if (!text.trim()) return false;
  if (NON_RETRIABLE_PATTERNS.some(pattern => pattern.test(text))) return false;
  return RETRIABLE_PATTERNS.some(pattern => pattern.test(text));
}

export function isRetriableStatus(status: unknown): boolean {
  const code = Number(status);
  if (!Number.isFinite(code)) return false;
  return code === 429 || code >= 500;
}

export function computeBackoffMs(policy: RetryPolicy, attempt: number): number {
  if (attempt < 1) return 0;
  const raw = policy.backoffMs * Math.pow(policy.backoffMultiplier, attempt - 1);
  return Math.min(Math.round(raw), 30_000);
}

export interface OutputFailure {
  failed: boolean;
  retriable: boolean;
  soft: boolean;
  message: string;
}

export function classifyOutputFailure(output: any): OutputFailure {
  if (output?.error) {
    const message = String(output.error);
    return {
      failed: true,
      retriable: isRetriableFailure(message, output),
      soft: false,
      message,
    };
  }
  if (output?.ok === false && isRetriableStatus(output.status)) {
    return {
      failed: true,
      retriable: true,
      soft: true,
      message: `Request failed with status ${output.status}`,
    };
  }
  return { failed: false, retriable: false, soft: false, message: '' };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}
