import type { ScrapeInput } from '../interfaces/scrape-input.interface';

type FlatKv = { key: string; value: string };

function flattenUnknown(
  data: unknown,
  prefix = '',
  out: FlatKv[] = [],
): FlatKv[] {
  if (data == null) return out;
  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
    if (prefix) out.push({ key: prefix, value: String(data) });
    return out;
  }
  if (Array.isArray(data)) {
    data.forEach((item, i) => flattenUnknown(item, prefix ? `${prefix}.${i}` : String(i), out));
    return out;
  }
  if (typeof data === 'object') {
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      const next = prefix ? `${prefix}.${k}` : k;
      flattenUnknown(v, next, out);
    }
  }
  return out;
}

function normKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findByAliases(flat: FlatKv[], aliases: string[]): string | null {
  const targets = aliases.map(normKey);
  for (const row of flat) {
    const k = normKey(row.key);
    if (targets.some((t) => k === t || k.endsWith(` ${t}`) || k.includes(t))) {
      const v = row.value?.trim();
      if (v) return v;
    }
  }
  return null;
}

function findRegex(flat: FlatKv[], re: RegExp): string | null {
  for (const row of flat) {
    const m = String(row.value || '').match(re);
    if (m?.[0]) return m[0].toUpperCase();
  }
  // also scan keys that look like the field
  for (const row of flat) {
    if (re.test(row.value || '')) {
      const m = String(row.value).match(re);
      if (m?.[0]) return m[0].toUpperCase();
    }
  }
  return null;
}

const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const GST_RE = /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/i;
const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PIN_RE = /\b[1-9][0-9]{5}\b/;
const DOMAIN_RE =
  /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/i;

/**
 * Build scrape inputs from one or more OCR extractedData blobs.
 * Prefers explicit field labels; falls back to regex on values.
 */
export function scrapeInputFromExtractedDocs(
  docs: Array<{ extractedData?: Record<string, unknown> | null; documentType?: string }>,
): ScrapeInput {
  const flat: FlatKv[] = [];
  for (const doc of docs) {
    flattenUnknown(doc.extractedData, '', flat);
  }

  const pan =
    findByAliases(flat, ['pan', 'pan number', 'permanent account number', 'business pan']) ||
    findRegex(flat, PAN_RE);

  const gst =
    findByAliases(flat, ['gstin', 'gst', 'gst number', 'gstin number']) ||
    findRegex(flat, GST_RE);

  const aadhaar =
    findByAliases(flat, ['aadhaar', 'aadhar', 'uid', 'aadhaar number']) ||
    findRegex(flat, AADHAAR_RE);

  const name = findByAliases(flat, [
    'applicant name',
    'full name',
    'name of the holder',
    'account holder name',
    'name',
    'legal name',
    'trade name',
  ]);

  const mobile = findByAliases(flat, ['mobile', 'mobile number', 'phone', 'contact number']);
  const email = findByAliases(flat, ['email', 'email id', 'e mail']);

  const companyName = findByAliases(flat, [
    'company name',
    'business name',
    'legal name of business',
    'trade name',
    'organization',
    'employer name',
  ]);

  const domainRaw =
    findByAliases(flat, ['domain', 'website', 'company domain', 'web site', 'url']) ||
    findRegex(flat, DOMAIN_RE);
  const companyDomain = domainRaw
    ? domainRaw
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .split('/')[0]
        .toLowerCase()
    : null;

  const address = findByAliases(flat, [
    'address',
    'residential address',
    'permanent address',
    'correspondence address',
    'principal place of business',
    'registered address',
  ]);
  const city = findByAliases(flat, ['city', 'district']);
  const state = findByAliases(flat, ['state']);
  const pincode =
    findByAliases(flat, ['pincode', 'pin code', 'pin']) || findRegex(flat, PIN_RE);

  const officeAddress = findByAliases(flat, [
    'office address',
    'business address',
    'work address',
  ]);

  return {
    applicantName: name,
    mobileNumber: mobile,
    emailId: email,
    panNumber: pan,
    aadhaarNumber: aadhaar,
    companyName,
    companyDomain,
    gstNumber: gst,
    businessPan: gst && gst.length >= 12 ? gst.slice(2, 12) : pan,
    residential: address || pincode || city || state
      ? { address, city, state, pincode }
      : null,
    office: officeAddress
      ? { address: officeAddress, city, state, pincode }
      : null,
  };
}

/** Pull secondary clues out of a GST fields map for cascade scrapes. */
export function cascadeHintsFromGstFields(fields: Record<string, string>): {
  address?: string;
  pincode?: string;
  state?: string;
  city?: string;
  tradeName?: string;
  website?: string;
} {
  const flat = Object.entries(fields).map(([key, value]) => ({ key, value: String(value ?? '') }));
  return {
    address:
      findByAliases(flat, [
        'principal place of business',
        'address',
        'registered address',
        'additional place of business',
      ]) ?? undefined,
    pincode: findByAliases(flat, ['pincode', 'pin code']) ?? findRegex(flat, PIN_RE) ?? undefined,
    state: findByAliases(flat, ['state']) ?? undefined,
    city: findByAliases(flat, ['city', 'district']) ?? undefined,
    tradeName:
      findByAliases(flat, ['trade name', 'legal name of business', 'legal name']) ?? undefined,
    website:
      findByAliases(flat, ['website', 'domain', 'url']) ??
      findRegex(flat, DOMAIN_RE) ??
      undefined,
  };
}
