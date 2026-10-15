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
});
