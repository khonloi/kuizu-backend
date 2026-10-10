import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  mode: z.enum(['offset', 'cursor']).optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQueryDto = z.infer<typeof paginationQuerySchema>;

export interface PaginationQueryInputDto {
  page?: number | string;
  limit?: number | string;
  cursor?: string;
  mode?: 'offset' | 'cursor';
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const cursorPaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CursorPaginationQueryDto = z.infer<
  typeof cursorPaginationQuerySchema
>;

export interface PaginationMeta {
  total?: number;
  page?: number;
  limit: number;
  totalPages?: number;
  hasNextPage: boolean;
  hasPrevPage?: boolean;
  nextCursor?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export function createOffsetPaginatedResponse<T>(
  data: T[],
  total: number,
  page = 1,
  limit = 20,
): PaginatedResponse<T> {
  const safeLimit = Math.max(1, limit);
  const safePage = Math.max(1, page);
  const totalPages = Math.ceil(total / safeLimit);

  return {
    data,
    meta: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1,
      nextCursor: null,
    },
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
  };
}

export function createCursorPaginatedResponse<
  T extends { _id?: any; id?: any },
>(items: T[], limit = 20): PaginatedResponse<T> {
  const safeLimit = Math.max(1, limit);
  const hasNextPage = items.length > safeLimit;
  const data = hasNextPage ? items.slice(0, safeLimit) : items;
  const lastItem = data.length > 0 ? data[data.length - 1] : null;

  let nextCursor: string | null = null;
  if (hasNextPage && lastItem) {
    if (lastItem._id !== undefined && lastItem._id !== null) {
      nextCursor =
        typeof lastItem._id.toString === 'function'
          ? lastItem._id.toString()
          : String(lastItem._id);
    } else if (lastItem.id !== undefined && lastItem.id !== null) {
      nextCursor = String(lastItem.id);
    }
  }

  return {
    data,
    meta: {
      limit: safeLimit,
      hasNextPage,
      nextCursor,
    },
    limit: safeLimit,
  };
}
