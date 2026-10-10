import { describe, it, expect } from 'vitest';
import {
  paginationQuerySchema,
  cursorPaginationQuerySchema,
  createOffsetPaginatedResponse,
  createCursorPaginatedResponse,
} from './pagination.dto';

describe('Pagination DTO & Helpers', () => {
  describe('paginationQuerySchema', () => {
    it('should parse default values when empty object is passed', () => {
      const parsed = paginationQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.sortOrder).toBe('desc');
      expect(parsed.cursor).toBeUndefined();
      expect(parsed.mode).toBeUndefined();
    });

    it('should coerce string numbers to integers', () => {
      const parsed = paginationQuerySchema.parse({
        page: '3',
        limit: '15',
        sortBy: 'title',
        sortOrder: 'asc',
      });
      expect(parsed.page).toBe(3);
      expect(parsed.limit).toBe(15);
      expect(parsed.sortBy).toBe('title');
      expect(parsed.sortOrder).toBe('asc');
    });

    it('should cap limit to 100 max and min 1', () => {
      expect(() => paginationQuerySchema.parse({ limit: 150 })).toThrow();
      expect(() => paginationQuerySchema.parse({ limit: 0 })).toThrow();
    });
  });

  describe('cursorPaginationQuerySchema', () => {
    it('should parse cursor and limit', () => {
      const parsed = cursorPaginationQuerySchema.parse({
        limit: '10',
        cursor: '60d0fe4f5311236168a109ca',
      });
      expect(parsed.limit).toBe(10);
      expect(parsed.cursor).toBe('60d0fe4f5311236168a109ca');
    });
  });

  describe('createOffsetPaginatedResponse', () => {
    it('should correctly calculate pagination metadata for middle page', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const res = createOffsetPaginatedResponse(data, 50, 2, 10);

      expect(res.data).toBe(data);
      expect(res.total).toBe(50);
      expect(res.page).toBe(2);
      expect(res.limit).toBe(10);
      expect(res.totalPages).toBe(5);
      expect(res.meta.hasNextPage).toBe(true);
      expect(res.meta.hasPrevPage).toBe(true);
      expect(res.meta.nextCursor).toBeNull();
    });

    it('should correctly flag hasNextPage as false on the last page', () => {
      const data = [{ id: 1 }];
      const res = createOffsetPaginatedResponse(data, 10, 2, 5);

      expect(res.totalPages).toBe(2);
      expect(res.meta.hasNextPage).toBe(false);
      expect(res.meta.hasPrevPage).toBe(true);
    });

    it('should handle empty dataset', () => {
      const res = createOffsetPaginatedResponse([], 0, 1, 20);

      expect(res.data).toEqual([]);
      expect(res.total).toBe(0);
      expect(res.totalPages).toBe(0);
      expect(res.meta.hasNextPage).toBe(false);
      expect(res.meta.hasPrevPage).toBe(false);
    });
  });

  describe('createCursorPaginatedResponse', () => {
    it('should return sliced items and nextCursor when items.length > limit', () => {
      const items = [
        { _id: 'id-1', name: 'Item 1' },
        { _id: 'id-2', name: 'Item 2' },
        { _id: 'id-3', name: 'Item 3' },
      ];
      const res = createCursorPaginatedResponse(items, 2);

      expect(res.data).toHaveLength(2);
      expect(res.data[0]._id).toBe('id-1');
      expect(res.data[1]._id).toBe('id-2');
      expect(res.meta.hasNextPage).toBe(true);
      expect(res.meta.nextCursor).toBe('id-2');
    });

    it('should return all items and nextCursor=null when items.length <= limit', () => {
      const items = [
        { _id: 'id-1', name: 'Item 1' },
        { _id: 'id-2', name: 'Item 2' },
      ];
      const res = createCursorPaginatedResponse(items, 2);

      expect(res.data).toHaveLength(2);
      expect(res.meta.hasNextPage).toBe(false);
      expect(res.meta.nextCursor).toBeNull();
    });

    it('should handle items with id instead of _id', () => {
      const items = [
        { id: 'custom-1' },
        { id: 'custom-2' },
        { id: 'custom-3' },
      ];
      const res = createCursorPaginatedResponse(items, 2);

      expect(res.meta.hasNextPage).toBe(true);
      expect(res.meta.nextCursor).toBe('custom-2');
    });

    it('should handle empty items array', () => {
      const res = createCursorPaginatedResponse([], 10);

      expect(res.data).toEqual([]);
      expect(res.meta.hasNextPage).toBe(false);
      expect(res.meta.nextCursor).toBeNull();
    });
  });
});
