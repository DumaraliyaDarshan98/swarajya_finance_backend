/**
 * Maps OCR-identified document types → portal-list category names/keys.
 * Used to fetch only relevant government portals after document detection.
 */

const DOC_TYPE_PORTAL_CATEGORIES: Array<{
  match: RegExp;
  categories: string[];
}> = [
  {
    match: /aadhaar|aadhar/i,
    categories: ['Identity & Aadhaar'],
  },
  {
    match: /\bpan\b/i,
    categories: ['Identity & Aadhaar', 'Income Tax & TDS'],
  },
  {
    match: /voter/i,
    categories: ['Voter & Election', 'Identity & Aadhaar'],
  },
  {
    match: /driving/i,
    categories: ['Driving & Vehicle'],
  },
  {
    match: /passport/i,
    categories: ['Passport & Travel'],
  },
  {
    match: /\bgst\b|udyam|msme|trade\s*licen/i,
    categories: ['GST', 'Business & Company', 'Labour & Licences'],
  },
  {
    match: /form\s*16|tds|itr|income\s*tax/i,
    categories: ['Income Tax & TDS'],
  },
  {
    match: /salary|payslip|employment|epfo/i,
    categories: ['Employment & EPFO'],
  },
  {
    match: /bank/i,
    categories: ['Banking & Finance'],
  },
  {
    match: /leaving\s*certificate|marksheet|education|school/i,
    categories: ['Education & School'],
  },
  {
    match: /address\s*proof|electricity|utility|gas\s*bill|mobile\s*bill/i,
    categories: ['Electricity & Bills', 'Panchayat & Municipal'],
  },
  {
    match: /ownership|deed|land|property|agreement/i,
    categories: ['Land & Property', 'E-Stamping & Challan'],
  },
];

/** Extra categories when derived scrape fields are present. */
export function categoriesFromScrapeFields(input: {
  panNumber?: string | null;
  aadhaarNumber?: string | null;
  gstNumber?: string | null;
  companyDomain?: string | null;
}): string[] {
  const cats: string[] = [];
  if (input.aadhaarNumber) cats.push('Identity & Aadhaar');
  if (input.panNumber) cats.push('Identity & Aadhaar', 'Income Tax & TDS');
  if (input.gstNumber) cats.push('GST', 'Business & Company');
  if (input.companyDomain) cats.push('Business & Company', 'Tools & Utilities');
  return cats;
}

export function portalCategoriesForDocumentTypes(
  documentTypes: string[] | undefined | null,
): string[] | null {
  const types = (documentTypes ?? [])
    .map((t) => String(t || '').trim())
    .filter(Boolean);
  if (!types.length) return null; // null = no filter (digital / unknown)

  const set = new Set<string>();
  for (const type of types) {
    for (const row of DOC_TYPE_PORTAL_CATEGORIES) {
      if (row.match.test(type)) {
        row.categories.forEach((c) => set.add(c.toLowerCase()));
      }
    }
  }
  // Always allow generic tools when we have at least one mapped type
  if (set.size > 0) {
    set.add('tools & utilities');
  }
  return set.size ? [...set] : null;
}

export function isCategoryAllowedForOcr(
  categoryName: string | undefined | null,
  categoryKey: string | undefined | null,
  allowedLower: string[] | null,
): boolean {
  if (!allowedLower || !allowedLower.length) return true;
  const name = String(categoryName || '').trim().toLowerCase();
  const key = String(categoryKey || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  return allowedLower.some(
    (a) =>
      a === name ||
      a === key ||
      name.includes(a) ||
      a.includes(name) ||
      key.includes(a) ||
      a.includes(key),
  );
}

export type ExecutedScrapeApi = {
  api: string;
  name: string;
  source: string;
  success: boolean;
  scrapedAt: string;
  url?: string | null;
  error?: string | null;
  durationMs?: number | null;
  documentTypes?: string[];
};
