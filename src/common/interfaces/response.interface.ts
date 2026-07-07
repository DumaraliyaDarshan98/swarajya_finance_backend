// Common response interface
export interface APIResponseInterface<T> {
  code?: number;
  message?: string;
  data?: T;
  pagination?: Pagination;
}

export interface Pagination {
  total: number;
  page: number;
  pagePerRecord: number;
}

export interface UploadUrlData {
  url: string;
}

export type UploadDocumentResponse = APIResponseInterface<UploadUrlData>;
