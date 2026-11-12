import * as dns from 'dns/promises';
import * as https from 'https';

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const DOMAIN_PATTERN = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const CIN_PATTERN = /^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;

export function normalizeGstin(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidGstin(value: string): boolean {
  return GSTIN_PATTERN.test(normalizeGstin(value));
}

export function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
}

export function isValidDomain(value: string): boolean {
  const domain = normalizeDomain(value);
  return !!domain && DOMAIN_PATTERN.test(domain);
}

export function isValidBusinessPan(value: string): boolean {
  const pan = value.trim().toUpperCase();
  return !pan || PAN_PATTERN.test(pan);
}

export function isValidCin(value: string): boolean {
  const cin = value.trim().toUpperCase();
  return !cin || CIN_PATTERN.test(cin);
}

export function normalizeBusinessName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function businessNamesMatch(a: string, b: string): boolean {
  const left = normalizeBusinessName(a);
  const right = normalizeBusinessName(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

export type DomainVerificationResult = {
  domain: string;
  dnsResolved: boolean;
  hasMx: boolean;
  resolvedIps: string[];
  httpReachable: boolean;
  checkedAt: string;
};

function checkHttpsReachable(host: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.request(
      { host, path: '/', method: 'HEAD', timeout: timeoutMs, rejectUnauthorized: false },
      (res) => {
        resolve((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 500);
        res.resume();
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

export async function verifyCompanyDomain(domainInput: string): Promise<DomainVerificationResult> {
  const domain = normalizeDomain(domainInput);
  const result: DomainVerificationResult = {
    domain,
    dnsResolved: false,
    hasMx: false,
    resolvedIps: [],
    httpReachable: false,
    checkedAt: new Date().toISOString(),
  };

  try {
    const ips = await dns.resolve4(domain).catch(() => [] as string[]);
    result.resolvedIps = ips;
    result.dnsResolved = ips.length > 0;
  } catch {
    result.dnsResolved = false;
  }

  try {
    const mx = await dns.resolveMx(domain);
    result.hasMx = mx.length > 0;
  } catch {
    result.hasMx = false;
  }

  result.httpReachable = await checkHttpsReachable(domain);
  return result;
}
