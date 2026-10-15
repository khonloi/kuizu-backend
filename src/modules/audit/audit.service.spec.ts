import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { AuditService } from './audit.service';
import { AuditLogRepository } from './repositories/audit-log.repository';

describe('AuditService', () => {
  let service: AuditService;
  let mockRepository: any;

  beforeEach(() => {
    mockRepository = {
      create: vi.fn().mockImplementation((doc) => ({
        _id: new Types.ObjectId(),
        createdAt: new Date(),
        ...doc,
      })),
      findRecent: vi.fn().mockResolvedValue([]),
      findByEntity: vi.fn().mockResolvedValue([]),
    };

    service = new AuditService(mockRepository as AuditLogRepository);
  });

  describe('logAction', () => {
    it('should create an audit log entry with correct fields', async () => {
      const userId = new Types.ObjectId().toString();
      const params = {
        userId,
        userEmail: 'admin@kuizu.io',
        action: 'USER_ROLE_UPDATED',
        targetEntity: 'User',
        targetId: 'target-123',
        details: { newRole: 'admin' },
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
      };

      const result = await service.logAction(params);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(Types.ObjectId),
          userEmail: 'admin@kuizu.io',
          action: 'USER_ROLE_UPDATED',
          targetEntity: 'User',
          targetId: 'target-123',
          details: { newRole: 'admin' },
          ipAddress: '127.0.0.1',
          userAgent: 'vitest',
        }),
      );
      expect(result).toBeDefined();
      expect(result?.action).toBe('USER_ROLE_UPDATED');
    });

    it('should catch errors gracefully and return null', async () => {
      mockRepository.create.mockRejectedValue(
        new Error('Database write error'),
      );

      const result = await service.logAction({
        action: 'FAILED_ACTION',
        targetEntity: 'User',
      });

      expect(result).toBeNull();
    });
  });

  describe('getRecentLogs', () => {
    it('should delegate to repository.findRecent', async () => {
      await service.getRecentLogs(25);
      expect(mockRepository.findRecent).toHaveBeenCalledWith(25);
    });
  });

  describe('getLogsForEntity', () => {
    it('should delegate to repository.findByEntity', async () => {
      await service.getLogsForEntity('Quiz', 'quiz-99');
      expect(mockRepository.findByEntity).toHaveBeenCalledWith(
        'Quiz',
        'quiz-99',
      );
    });
  });
});
