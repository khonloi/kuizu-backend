import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { BaseRepository } from './base.repository';

interface TestDoc {
  _id: Types.ObjectId;
  name: string;
  isDeleted?: boolean;
  deletedAt?: Date | null;
  deletedBy?: string | null;
}

class TestRepository extends BaseRepository<TestDoc> {
  constructor(model: any) {
    super(model);
  }
}

describe('BaseRepository', () => {
  let repository: TestRepository;
  let mockModel: any;

  beforeEach(() => {
    mockModel = {
      findById: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
      findByIdAndUpdate: vi.fn(),
      findOneAndUpdate: vi.fn(),
      findByIdAndDelete: vi.fn(),
      deleteMany: vi.fn(),
      countDocuments: vi.fn(),
      db: {
        startSession: vi.fn(),
      },
    };
    repository = new TestRepository(mockModel);
  });

  describe('softDelete', () => {
    it('should set isDeleted to true and populate deletedAt and deletedBy', async () => {
      const id = new Types.ObjectId();
      const updatedDoc = {
        _id: id,
        name: 'Item 1',
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: 'admin-1',
      };

      mockModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(updatedDoc),
      });

      const res = await repository.softDelete(id, 'admin-1');

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        expect.objectContaining({
          $set: expect.objectContaining({
            isDeleted: true,
            deletedBy: 'admin-1',
          }),
        }),
        { new: true },
      );
      expect(res).toEqual(updatedDoc);
    });

    it('should handle softDelete without deletedBy', async () => {
      const id = new Types.ObjectId();
      mockModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: id, isDeleted: true }),
      });

      await repository.softDelete(id);

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        expect.objectContaining({
          $set: expect.objectContaining({
            isDeleted: true,
          }),
        }),
        { new: true },
      );
    });
  });

  describe('restore', () => {
    it('should set isDeleted to false and clear deletedAt and deletedBy', async () => {
      const id = new Types.ObjectId();
      const restoredDoc = {
        _id: id,
        name: 'Item 1',
        isDeleted: false,
        deletedAt: null,
      };

      mockModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(restoredDoc),
      });

      const res = await repository.restore(id);

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        {
          $set: {
            isDeleted: false,
            deletedAt: null,
          },
          $unset: {
            deletedBy: 1,
          },
        },
        { new: true },
      );
      expect(res).toEqual(restoredDoc);
    });
  });

  describe('paginate', () => {
    let queryMock: any;

    beforeEach(() => {
      queryMock = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockModel.find.mockReturnValue(queryMock);
      mockModel.countDocuments.mockReturnValue({
        exec: vi.fn().mockResolvedValue(0),
      });
    });

    describe('offset-based pagination', () => {
      it('should paginate with default options when no query params are provided', async () => {
        const mockData = [
          { _id: new Types.ObjectId(), name: 'Doc 1' },
          { _id: new Types.ObjectId(), name: 'Doc 2' },
        ];
        queryMock.exec.mockResolvedValue(mockData);
        mockModel.countDocuments.mockReturnValue({
          exec: vi.fn().mockResolvedValue(2),
        });

        const result = await repository.paginate();

        expect(mockModel.find).toHaveBeenCalledWith({}, undefined);
        expect(queryMock.sort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(queryMock.skip).toHaveBeenCalledWith(0);
        expect(queryMock.limit).toHaveBeenCalledWith(20);
        expect(result).toEqual({
          data: mockData,
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
          meta: {
            total: 2,
            page: 1,
            limit: 20,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
            nextCursor: null,
          },
        });
      });

      it('should calculate skip correctly for custom page and limit', async () => {
        queryMock.exec.mockResolvedValue([]);
        mockModel.countDocuments.mockReturnValue({
          exec: vi.fn().mockResolvedValue(45),
        });

        const result = await repository.paginate({}, { page: 3, limit: 15 });

        expect(queryMock.skip).toHaveBeenCalledWith(30);
        expect(queryMock.limit).toHaveBeenCalledWith(15);
        expect(result.meta.page).toBe(3);
        expect(result.meta.limit).toBe(15);
        expect(result.meta.total).toBe(45);
        expect(result.meta.totalPages).toBe(3);
        expect(result.meta.hasNextPage).toBe(false);
        expect(result.meta.hasPrevPage).toBe(true);
      });

      it('should apply search filter across specified searchFields', async () => {
        await repository.paginate(
          { isDeleted: false },
          { search: 'hello' },
          { searchFields: ['name', 'description'] },
        );

        expect(mockModel.find).toHaveBeenCalledWith(
          {
            isDeleted: false,
            $or: [
              { name: { $regex: 'hello', $options: 'i' } },
              { description: { $regex: 'hello', $options: 'i' } },
            ],
          },
          undefined,
        );
      });

      it('should accept allowed sortBy field and direction', async () => {
        await repository.paginate(
          {},
          { sortBy: 'name', sortOrder: 'asc' },
          { allowedSortFields: ['name', 'createdAt'] },
        );

        expect(queryMock.sort).toHaveBeenCalledWith({ name: 1 });
      });

      it('should fallback to defaultSortField if sortBy is not in allowedSortFields', async () => {
        await repository.paginate(
          {},
          { sortBy: 'maliciousField' },
          {
            allowedSortFields: new Set(['name']),
            defaultSortField: 'name',
            defaultSortOrder: 'asc',
          },
        );

        expect(queryMock.sort).toHaveBeenCalledWith({ name: 1 });
      });

      it('should apply populate options correctly', async () => {
        await repository.paginate(
          {},
          {},
          {
            populate: [
              { path: 'author', select: 'username' },
              ['comments', 'content'],
            ],
          },
        );

        expect(queryMock.populate).toHaveBeenCalledWith({
          path: 'author',
          select: 'username',
        });
        expect(queryMock.populate).toHaveBeenCalledWith('comments', 'content');
      });
    });

    describe('cursor-based pagination', () => {
      it('should query with limit + 1 and order by _id: -1 in cursor mode', async () => {
        const cursorId = new Types.ObjectId();
        const id1 = new Types.ObjectId();
        const id2 = new Types.ObjectId();
        const mockItems = [
          { _id: id1, name: 'Item 1' },
          { _id: id2, name: 'Item 2' },
        ];
        queryMock.exec.mockResolvedValue(mockItems);

        const result = await repository.paginate(
          {},
          { mode: 'cursor', cursor: cursorId.toString(), limit: 1 },
        );

        expect(mockModel.find).toHaveBeenCalledWith(
          { _id: { $lt: cursorId } },
          undefined,
        );
        expect(queryMock.sort).toHaveBeenCalledWith({ _id: -1 });
        expect(queryMock.limit).toHaveBeenCalledWith(2);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual(mockItems[0]);
        expect(result.meta.nextCursor).toBe(mockItems[0]._id.toString());
        expect(result.meta.hasNextPage).toBe(true);
      });

      it('should handle last page in cursor mode when items <= limit', async () => {
        const id1 = new Types.ObjectId();
        const mockItems = [{ _id: id1, name: 'Item 1' }];
        queryMock.exec.mockResolvedValue(mockItems);

        const result = await repository.paginate(
          {},
          { mode: 'cursor', limit: 5 },
        );

        expect(result.data).toHaveLength(1);
        expect(result.meta.nextCursor).toBeNull();
        expect(result.meta.hasNextPage).toBe(false);
      });
    });
  });

  describe('CRUD and Lean Queries', () => {
    it('deleteMany should call model.deleteMany and return result', async () => {
      mockModel.deleteMany.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ deletedCount: 3 }),
      });
      const res = await repository.deleteMany({ isDeleted: true });
      expect(mockModel.deleteMany).toHaveBeenCalledWith({ isDeleted: true });
      expect(res).toEqual({ deletedCount: 3 });
    });

    it('countDocuments should call model.countDocuments', async () => {
      mockModel.countDocuments.mockReturnValue({
        exec: vi.fn().mockResolvedValue(42),
      });
      const count = await repository.countDocuments({ isDeleted: false });
      expect(mockModel.countDocuments).toHaveBeenCalledWith({
        isDeleted: false,
      });
      expect(count).toBe(42);
    });

    it('findLean should return plain lean documents', async () => {
      const leanQuery = {
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([{ name: 'Lean1' }]),
        }),
      };
      mockModel.find.mockReturnValue(leanQuery);

      const docs = await repository.findLean({ isDeleted: false });
      expect(mockModel.find).toHaveBeenCalledWith(
        { isDeleted: false },
        undefined,
        undefined,
      );
      expect(leanQuery.lean).toHaveBeenCalled();
      expect(docs).toEqual([{ name: 'Lean1' }]);
    });

    it('findOneLean should return single plain lean document', async () => {
      const leanQuery = {
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({ name: 'Lean1' }),
        }),
      };
      mockModel.findOne.mockReturnValue(leanQuery);

      const doc = await repository.findOneLean({ name: 'Lean1' });
      expect(mockModel.findOne).toHaveBeenCalledWith(
        { name: 'Lean1' },
        undefined,
        undefined,
      );
      expect(leanQuery.lean).toHaveBeenCalled();
      expect(doc).toEqual({ name: 'Lean1' });
    });

    it('findByIdLean should return document by ID as lean', async () => {
      const id = new Types.ObjectId();
      const leanQuery = {
        lean: vi
          .fn()
          .mockReturnValue({ exec: vi.fn().mockResolvedValue({ _id: id }) }),
      };
      mockModel.findById.mockReturnValue(leanQuery);

      const doc = await repository.findByIdLean(id);
      expect(mockModel.findById).toHaveBeenCalledWith(id, undefined, undefined);
      expect(leanQuery.lean).toHaveBeenCalled();
      expect(doc).toEqual({ _id: id });
    });
  });

  describe('withTransaction', () => {
    it('should execute inside transaction and commit session', async () => {
      const mockSession: any = {
        withTransaction: vi.fn().mockImplementation(async (cb) => cb()),
        endSession: vi.fn().mockResolvedValue(undefined),
      };
      mockModel.db.startSession.mockResolvedValue(mockSession);

      const result = await repository.withTransaction(async (session) => {
        expect(session).toBe(mockSession);
        return 'success';
      });

      expect(result).toBe('success');
      expect(mockSession.withTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should always end session even if transaction throws', async () => {
      const mockSession: any = {
        withTransaction: vi.fn().mockRejectedValue(new Error('Tx error')),
        endSession: vi.fn().mockResolvedValue(undefined),
      };
      mockModel.db.startSession.mockResolvedValue(mockSession);

      await expect(
        repository.withTransaction(async () => 'never'),
      ).rejects.toThrow('Tx error');

      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });
});
