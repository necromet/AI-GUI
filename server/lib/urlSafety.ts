import { isIPv4 } from 'net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '[::1]',
]);

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^127\./,
  /^0\./,
  /^\[fc00/i,
  /^\[fd/i,
  /^\[fe80/i,
];

export function isAllowedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (!['http:', 'https:'].includes(url.protocol)) return false;

    const hostname = url.hostname.toLowerCase();

    if (BLOCKED_HOSTNAMES.has(hostname)) return false;

    for (const pattern of PRIVATE_IP_RANGES) {
      if (pattern.test(hostname)) return false;
    }

    if (isIPv4(hostname)) {
      const parts = hostname.split('.').map(Number);
      if (parts[0] === 10) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
      if (parts[0] === 169 && parts[1] === 254) return false;
      if (parts[0] === 127) return false;
      if (parts[0] === 0) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function safeFetchUrl(urlStr: string, options: RequestInit = {}): Promise<Response> {
  if (!isAllowedUrl(urlStr)) {
    throw new Error(`Blocked: URL ${urlStr} targets a private/internal address`);
  }

  return fetch(urlStr, {
    ...options,
    redirect: 'manual',
    signal: options.signal || AbortSignal.timeout(15000),
  });
}
