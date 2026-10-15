import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditLogRepository } from './audit-log.repository';

describe('AuditLogRepository', () => {
  let repository: AuditLogRepository;
  let mockModel: any;

  beforeEach(() => {
    mockModel = {
      find: vi.fn(),
    };
    repository = new AuditLogRepository(mockModel);
  });

  describe('findRecent', () => {
    it('should query logs sorted descending with limit', async () => {
      const execMock = vi.fn().mockResolvedValue([{ action: 'TEST_ACTION' }]);
      const limitMock = vi.fn().mockReturnValue({ exec: execMock });
      const sortMock = vi.fn().mockReturnValue({ limit: limitMock });
      mockModel.find.mockReturnValue({ sort: sortMock });

      const result = await repository.findRecent(20);

      expect(mockModel.find).toHaveBeenCalledWith();
      expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
      expect(limitMock).toHaveBeenCalledWith(20);
      expect(result).toHaveLength(1);
    });
  });

  describe('findByEntity', () => {
    it('should filter by targetEntity and targetId when both are provided', async () => {
      const execMock = vi
        .fn()
        .mockResolvedValue([{ targetEntity: 'User', targetId: 'u-1' }]);
      const sortMock = vi.fn().mockReturnValue({ exec: execMock });
      mockModel.find.mockReturnValue({ sort: sortMock });

      const result = await repository.findByEntity('User', 'u-1');

      expect(mockModel.find).toHaveBeenCalledWith({
        targetEntity: 'User',
        targetId: 'u-1',
      });
      expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toHaveLength(1);
    });

    it('should filter only by targetEntity when targetId is omitted', async () => {
      const execMock = vi.fn().mockResolvedValue([{ targetEntity: 'Quiz' }]);
      const sortMock = vi.fn().mockReturnValue({ exec: execMock });
      mockModel.find.mockReturnValue({ sort: sortMock });

      const result = await repository.findByEntity('Quiz');

      expect(mockModel.find).toHaveBeenCalledWith({ targetEntity: 'Quiz' });
      expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toHaveLength(1);
    });
  });
});
