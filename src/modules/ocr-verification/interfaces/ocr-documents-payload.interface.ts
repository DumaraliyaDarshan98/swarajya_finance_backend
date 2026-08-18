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
}

export interface OcrMergedFileEntry {
  fileName: string;
  storedFileName: string;
  uploadedAt: string;
}

export interface OcrDocumentsPayload {
  documents: OcrDocumentEntry[];
  extraDocuments: OcrDocumentEntry[];
  mergedFile: OcrMergedFileEntry | null;
}
