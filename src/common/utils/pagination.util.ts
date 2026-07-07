import { Pagination } from '../interfaces/response.interface';

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface ParsedPagination {
  page: number;
  limit: number;
  skip: number;
}

export function parsePagination(
  query: PaginationInput,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {},
): ParsedPagination {
  const page = Math.max(1, query.page ?? defaults.page ?? 1);
  const maxLimit = defaults.maxLimit ?? 100;
  const limit = Math.min(maxLimit, Math.max(1, query.limit ?? defaults.limit ?? 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function buildPagination(
  total: number,
  page: number,
  limit: number,
): Pagination {
  return { total, page, pagePerRecord: limit };
}
