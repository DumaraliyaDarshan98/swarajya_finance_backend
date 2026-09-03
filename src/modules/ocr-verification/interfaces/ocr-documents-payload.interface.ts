export type OcrVerificationStatus =
  | 'DRAFT'
  | 'UPLOADING'
  | 'OCR_PROCESSING'
  | 'IN_PROGRESS'
  | 'REPORT_GENERATED'
  | 'FAILED';

export interface OcrTriggerResult {
  field: string;
  triggerType: string;
  status: 'passed' | 'failed';
  message: string;
  text?: string;
}

export interface OcrCheck {
  id: string;
  label: string;
  source: string;
  status: 'passed' | 'failed' | 'skipped';
  details?: string;
}

export interface OcrForensicSignal {
  code: string;
  threatCode: string;
  severity: 'low' | 'medium' | 'high';
  score: number;
  status: 'passed' | 'failed' | 'info';
  title: string;
  description: string;
  evidence?: Record<string, unknown>;
}

export type OcrForensicVerdict =
  | 'GENUINE'
  | 'LIKELY_GENUINE'
  | 'SUSPICIOUS'
  | 'TEMP'
  | 'MANUAL_REVIEW';

export interface OcrForensicSummary {
  riskScore: number;
  verdict: OcrForensicVerdict;
  verdictLabel: string;
  reasons: string[];
  failedSignalCount: number;
  failedTriggerCount: number;
}

export interface OcrDocumentEntry {
  key: string;
  label: string;
  placeholder?: string;
  fileName: string | null;
  storedFileName: string | null;
  mimeType: string | null;
  documentType: string;
  extractedData: Record<string, unknown> | null;
  extractedText: string | null;
  confidence: Record<string, number> | null;
  triggerResults: OcrTriggerResult[] | null;
  checks: OcrCheck[] | null;
  isValid: boolean | null;
  ocrSuccess: boolean;
  ocrError: string | null;
  uploadedAt: string | null;
  /** Phase-1 forensics */
  fileHash?: string | null;
  fileSizeBytes?: number | null;
  pdfMetadata?: Record<string, unknown> | null;
  forensicSignals?: OcrForensicSignal[] | null;
  forensicSummary?: OcrForensicSummary | null;
}

export interface OcrMergedFileEntry {
  fileName: string;
  storedFileName: string;
  uploadedAt: string;
}

export interface OcrCaseForensicSummary {
  riskScore: number;
  verdict: OcrForensicVerdict;
  verdictLabel: string;
  reasons: string[];
  documentCount: number;
  worstDocumentKey: string | null;
}

export interface OcrDocumentsPayload {
  documents: OcrDocumentEntry[];
  extraDocuments: OcrDocumentEntry[];
  mergedFile: OcrMergedFileEntry | null;
  caseForensicSummary?: OcrCaseForensicSummary | null;
}
