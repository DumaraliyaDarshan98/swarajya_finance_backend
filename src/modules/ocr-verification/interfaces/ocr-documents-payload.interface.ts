export type OcrVerificationStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'REPORT_GENERATED'
  | 'FAILED';

export interface OcrDocumentEntry {
  key: string;
  label: string;
  placeholder?: string;
  fileName: string | null;
  storedFileName: string | null;
  documentType: string;
  extractedData: Record<string, unknown> | null;
  extractedText: string | null;
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
