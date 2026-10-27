import type { ScrapePayload } from '../../digital-verification/interfaces/scrape-payload.interface';

/** Normalized identity / address inputs used to drive public scrapes. */
export interface ScrapeInput {
  applicantName?: string | null;
  mobileNumber?: string | null;
  emailId?: string | null;
  panNumber?: string | null;
  aadhaarNumber?: string | null;
  companyName?: string | null;
  companyDomain?: string | null;
  gstNumber?: string | null;
  businessPan?: string | null;
  residential?: {
    address?: string | null;
    landmark?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
  } | null;
  office?: {
    address?: string | null;
    landmark?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
  } | null;
}

export interface EnrichmentResult {
  scrapePayload: ScrapePayload;
  /**
   * True when one or more attempted scrapes had soft failures (site down / mismatch data).
   * Does NOT mean report generation should be marked FAILED — always persist scrapePayload
   * and generate the report; surface per-site success flags in the UI instead.
   */
  hasFailure: boolean;
  /** Fields that were used (after OCR derivation or form entry). */
  derivedFrom: ScrapeInput;
  cascadeNotes: string[];
}
