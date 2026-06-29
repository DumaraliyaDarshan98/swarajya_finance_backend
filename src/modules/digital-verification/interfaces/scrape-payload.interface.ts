export type DigitalVerificationStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'REPORT_GENERATED'
  | 'FAILED';

export interface ScrapeResultEntry {
  source: string;
  scrapedAt: string;
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

/** Extensible JSON store for government / scraping API responses. */
export interface ScrapePayload {
  gst?: ScrapeResultEntry;
  [key: string]: ScrapeResultEntry | undefined;
}
