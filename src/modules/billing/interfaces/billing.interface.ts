export type BillingLineCategory =
  | 'OCR_DOCUMENT'
  | 'OCR_SERVER'
  | 'SCRAPE_SITE'
  | 'SCRAPE_SERVER'
  | 'TRIANGULATION'
  | 'PHYSICAL_VERIFICATION'
  | 'MONTHLY_SMS'
  | 'MONTHLY_EMAIL'
  | 'MONTHLY_OTHER';

export interface BillingRatesView {
  id: string | null;
  ocrDocumentCharge: number;
  scrapeSiteCharge: number;
  serverCostPerDocument: number;
  serverCostPerScrape: number;
  triangulationCost: number;
  physicalVerificationCost: number;
  monthlySmsCost: number;
  monthlyEmailCost: number;
  monthlyOtherCost: number;
  currency: string;
  updatedAt: string | null;
}

export interface BillingLineItem {
  id: string;
  category: BillingLineCategory;
  categoryLabel: string;
  occurredAt: string;
  quantity: number;
  unitRate: number;
  amount: number;
  description: string;
  referenceType: 'ocr' | 'digital' | 'physical' | 'monthly' | null;
  referenceId: string | null;
  meta?: Record<string, unknown>;
}

export interface BillingUsageCounts {
  successfulOcrDocuments: number;
  successfulScrapes: number;
  triangulationCases: number;
  physicalVerifications: number;
  monthsCovered: number;
}

export interface ClientBillSummary {
  clientId: string;
  companyName: string;
  email: string | null;
  currency: string;
  currentMonthTotal: number;
  lifetimeTotal: number;
  usage: BillingUsageCounts;
}

export interface ClientBillDetail {
  clientId: string;
  companyName: string;
  email: string | null;
  currency: string;
  periodFrom: string;
  periodTo: string;
  rates: BillingRatesView;
  usage: BillingUsageCounts;
  totalsByCategory: Record<string, number>;
  totalAmount: number;
  lineItems: BillingLineItem[];
}

export interface ClientBillHistoryMonth {
  year: number;
  month: number;
  label: string;
  periodFrom: string;
  periodTo: string;
  totalAmount: number;
  usage: BillingUsageCounts;
}
