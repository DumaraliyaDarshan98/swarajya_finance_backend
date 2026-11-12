/**
 * Maps portal catalog rows (title/url) → scrape strategy used by OCR/digital enrichment.
 * Only strategies with real ScrappingService implementations return field data.
 */

export type PortalScrapeStrategy =
  | 'gst-knowyourgst'
  | 'gst-portal'
  | 'whois'
  | 'pincode'
  | 'reachability';

export type PortalInputField = {
  key: string;
  label: string;
  type: 'text' | 'password';
  required: boolean;
  placeholder?: string;
  pattern?: string;
  hint?: string;
};

export type PortalScrapeDefinition = {
  strategy: PortalScrapeStrategy;
  /** Human label for Admin Test Portal */
  label: string;
  /** Match against portal title (case-insensitive substring) */
  titleIncludes?: string[];
  /** Match against portal URL (case-insensitive substring) */
  urlIncludes?: string[];
  requiredInputs: PortalInputField[];
  /** Field labels that must be present (non-empty) for a successful field scrape */
  expectedFields: string[];
  /** At least this many expected fields must match (default: all) */
  minExpectedMatches?: number;
  apiPath: string;
  supportsFieldScrape: boolean;
};

export const PORTAL_SCRAPE_DEFINITIONS: PortalScrapeDefinition[] = [
  {
    strategy: 'gst-knowyourgst',
    label: 'GST Search (KnowYourGST)',
    titleIncludes: ['knowyourgst', 'gst number search', 'gst search'],
    urlIncludes: ['knowyourgst.com'],
    requiredInputs: [
      {
        key: 'gstNumber',
        label: 'GSTIN',
        type: 'text',
        required: true,
        placeholder: '27AAACR5055K1Z7',
        pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$',
        hint: '15-character GSTIN',
      },
    ],
    expectedFields: [
      'Legal Name of Business',
      'Legal Name',
      'Trade Name',
      'GSTIN',
      'GSTIN / UIN',
      'Status',
      'Taxpayer Type',
      'State',
      'Centre Jurisdiction',
      'State Jurisdiction',
    ],
    minExpectedMatches: 2,
    apiPath: 'POST /scrapping/gst-search',
    supportsFieldScrape: true,
  },
  {
    strategy: 'gst-portal',
    label: 'GST Portal (services.gst.gov.in)',
    titleIncludes: [
      'gst taxpayer search',
      'gst portal',
      'find gst number by pan',
      'searchtp',
    ],
    urlIncludes: ['services.gst.gov.in'],
    requiredInputs: [
      {
        key: 'gstNumber',
        label: 'GSTIN',
        type: 'text',
        required: true,
        placeholder: '27AAACR5055K1Z7',
        pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$',
      },
      {
        key: 'captchaCode',
        label: 'Captcha',
        type: 'text',
        required: false,
        placeholder: 'Enter captcha after init',
        hint: 'Leave blank on first call to fetch captcha image (init). Provide captcha + sessionId to complete search.',
      },
      {
        key: 'sessionId',
        label: 'Session ID',
        type: 'text',
        required: false,
        placeholder: 'From init response',
        hint: 'Filled automatically after captcha init',
      },
    ],
    expectedFields: ['Legal Name', 'Trade Name', 'GSTIN', 'Principal Place of Business'],
    minExpectedMatches: 1,
    apiPath: 'POST /scrapping/gst-portal/init|search',
    supportsFieldScrape: true,
  },
  {
    strategy: 'whois',
    label: 'Domain WHOIS',
    titleIncludes: ['who.is', 'whois', 'domain lookup', 'domain whois'],
    urlIncludes: ['who.is', 'whois.com'],
    requiredInputs: [
      {
        key: 'domain',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'example.com',
        hint: 'Hostname without protocol',
      },
    ],
    expectedFields: [
      'Registrar',
      'Creation Date',
      'Registered On',
      'Registry Expiry Date',
      'Expires On',
      'Updated Date',
      'Name Server',
      'Domain Status',
      'Registrant Organization',
    ],
    minExpectedMatches: 2,
    apiPath: 'POST /scrapping/whois-search',
    supportsFieldScrape: true,
  },
  {
    strategy: 'pincode',
    label: 'India Post Pincode',
    titleIncludes: ['pincode', 'postal pincode', 'post office'],
    urlIncludes: ['postalpincode.in', 'indiapost.gov.in'],
    requiredInputs: [
      {
        key: 'pincode',
        label: 'Pincode',
        type: 'text',
        required: true,
        placeholder: '380001',
        pattern: '^[1-9][0-9]{5}$',
        hint: '6-digit Indian PIN code',
      },
    ],
    expectedFields: [
      'Post Office',
      'District',
      'State',
      'Pincode',
      'Country',
      'Branch Type',
    ],
    minExpectedMatches: 3,
    apiPath: 'POST /scrapping/pincode-search',
    supportsFieldScrape: true,
  },
];

export const REACHABILITY_DEFINITION: PortalScrapeDefinition = {
  strategy: 'reachability',
  label: 'HTTP reachability check',
  requiredInputs: [],
  expectedFields: [],
  minExpectedMatches: 0,
  apiPath: 'GET portal-check',
  supportsFieldScrape: false,
};

export function resolvePortalScrapeDefinition(portal: {
  title?: string | null;
  url?: string | null;
}): PortalScrapeDefinition {
  const title = String(portal.title || '').toLowerCase();
  const url = String(portal.url || '').toLowerCase();

  for (const def of PORTAL_SCRAPE_DEFINITIONS) {
    const titleHit = (def.titleIncludes ?? []).some((t) => title.includes(t.toLowerCase()));
    const urlHit = (def.urlIncludes ?? []).some((u) => url.includes(u.toLowerCase()));
    if (titleHit || urlHit) return def;
  }
  return REACHABILITY_DEFINITION;
}

/** Flexible expected-field match (label aliases / partial). */
export function matchExpectedFields(
  fields: Record<string, unknown> | null | undefined,
  expectedFields: string[],
  minExpectedMatches?: number,
): {
  matched: string[];
  missing: string[];
  ok: boolean;
} {
  const entries = Object.entries(fields ?? {}).filter(
    ([, v]) => v != null && String(v).trim() !== '',
  );
  const presentKeys = entries.map(([k]) => k.toLowerCase());
  const matched: string[] = [];
  const missing: string[] = [];

  for (const expected of expectedFields) {
    const e = expected.toLowerCase();
    const hit = presentKeys.some(
      (k) => k === e || k.includes(e) || e.includes(k),
    );
    if (hit) matched.push(expected);
    else missing.push(expected);
  }

  const need =
    minExpectedMatches != null
      ? Math.max(1, minExpectedMatches)
      : expectedFields.length;
  const ok = expectedFields.length === 0 ? entries.length > 0 : matched.length >= need;

  return { matched, missing, ok };
}
