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
  status: 'passed' | 'failed' | 'skipped';
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
  status: 'passed' | 'failed' | 'info' | 'skipped';
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

/** Banking-grade per-document validation (identify ≠ extract ≠ validate ≠ authenticity). */
export type OcrDocumentValidationStatus =
  | 'VALID'
  | 'NEEDS_REVIEW'
  | 'INVALID'
  | 'PROCESSING_FAILED';

export interface OcrFieldValidationResult {
  field: string;
  status: 'passed' | 'failed' | 'missing' | 'skipped' | 'low_confidence';
  severity: 'error' | 'warning' | 'info';
  message: string;
  valuePreview?: string | null;
}

export interface OcrDocumentValidationReport {
  status: OcrDocumentValidationStatus;
  statusLabel: string;
  reasons: string[];
  fieldResults: OcrFieldValidationResult[];
  identification: {
    documentType: string;
    confidence: number;
    accepted: boolean;
    uncertain: boolean;
  };
  authenticityNote: string;
  trace?: Record<string, unknown>;
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
  /** Banking validation status — never treat OCR text as authenticity. */
  validationStatus?: OcrDocumentValidationStatus | null;
  validationStatusLabel?: string | null;
  validationReport?: OcrDocumentValidationReport | null;
  identifyConfidence?: number | null;
  identificationAccepted?: boolean | null;
  identificationUncertain?: boolean | null;
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
