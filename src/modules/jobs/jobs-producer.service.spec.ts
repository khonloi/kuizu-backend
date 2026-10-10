import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobsProducerService } from './jobs-producer.service';
import { RedisService } from '../../common/redis/redis.service';
import { EmailProcessor } from './processors/email.processor';
import { GameReportsProcessor } from './processors/game-reports.processor';
import { GamificationProcessor } from './processors/gamification.processor';

describe('JobsProducerService', () => {
  let service: JobsProducerService;
  let mockEmailQueue: any;
  let mockGameReportsQueue: any;
  let mockGamificationQueue: any;
  let mockRedisService: any;
  let mockEmailProcessor: any;
  let mockGameReportsProcessor: any;
  let mockGamificationProcessor: any;

  beforeEach(() => {
    mockEmailQueue = {
      add: vi.fn().mockResolvedValue({ id: 'mock-email-job' }),
    };

    mockGameReportsQueue = {
      add: vi.fn().mockResolvedValue({ id: 'mock-report-job' }),
    };

    mockGamificationQueue = {
      add: vi.fn().mockResolvedValue({ id: 'mock-gamification-job' }),
    };

    mockRedisService = {
      isAvailable: vi.fn().mockReturnValue(true),
    };

    mockEmailProcessor = {
      handleVerificationEmail: vi
        .fn()
        .mockResolvedValue({ sent: true, type: 'verification' }),
      handlePasswordResetEmail: vi
        .fn()
        .mockResolvedValue({ sent: true, type: 'password-reset' }),
    };

    mockGameReportsProcessor = {
      handleSaveGameSession: vi
        .fn()
        .mockResolvedValue({ saved: true, pin: '123456' }),
    };

    mockGamificationProcessor = {
      handleLeagueCalculation: vi
        .fn()
        .mockResolvedValue({ promoted: 1, demoted: 0, evaluated: 5 }),
    };

    service = new JobsProducerService(
      mockEmailQueue as any,
      mockGameReportsQueue as any,
      mockGamificationQueue as any,
      mockRedisService as unknown as RedisService,
      mockEmailProcessor as unknown as EmailProcessor,
      mockGameReportsProcessor as unknown as GameReportsProcessor,
      mockGamificationProcessor as unknown as GamificationProcessor,
    );
  });

  describe('When Redis is connected', () => {
    it('sendVerificationEmail should add job to emailQueue', async () => {
      const payload = {
        to: 'test@example.com',
        username: 'Test',
        token: 'token-123',
      };
      await service.sendVerificationEmail(payload);

      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        'send-verification-email',
        payload,
        expect.any(Object),
      );
      expect(mockEmailProcessor.handleVerificationEmail).not.toHaveBeenCalled();
    });

    it('sendPasswordResetEmail should add job to emailQueue', async () => {
      const payload = {
        to: 'test@example.com',
        username: 'Test',
        token: 'reset-123',
      };
      await service.sendPasswordResetEmail(payload);

      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        'send-password-reset-email',
        payload,
        expect.any(Object),
      );
      expect(
        mockEmailProcessor.handlePasswordResetEmail,
      ).not.toHaveBeenCalled();
    });

    it('saveGameSessionReport should add job to gameReportsQueue', async () => {
      const payload = {
        pin: '123456',
        quizId: '60d0fe4f5311236168a109ca',
        quizTitle: 'Quiz',
        players: [],
      };
      await service.saveGameSessionReport(payload);

      expect(mockGameReportsQueue.add).toHaveBeenCalledWith(
        'save-game-session',
        payload,
        expect.any(Object),
      );
      expect(
        mockGameReportsProcessor.handleSaveGameSession,
      ).not.toHaveBeenCalled();
    });

    it('calculateLeagueStandings should add job to gamificationQueue', async () => {
      await service.calculateLeagueStandings({ timestamp: 'now' });

      expect(mockGamificationQueue.add).toHaveBeenCalledWith(
        'calculate-league-standings',
        { timestamp: 'now' },
        expect.any(Object),
      );
      expect(
        mockGamificationProcessor.handleLeagueCalculation,
      ).not.toHaveBeenCalled();
    });
  });

  describe('When Redis is disconnected / fallback mode', () => {
    beforeEach(() => {
      mockRedisService.isAvailable.mockReturnValue(false);
    });

    it('sendVerificationEmail should execute processor directly', async () => {
      const payload = {
        to: 'test@example.com',
        username: 'Test',
        token: 'token-123',
      };
      await service.sendVerificationEmail(payload);

      expect(mockEmailQueue.add).not.toHaveBeenCalled();
      expect(mockEmailProcessor.handleVerificationEmail).toHaveBeenCalledWith(
        payload,
      );
    });

    it('sendPasswordResetEmail should execute processor directly', async () => {
      const payload = {
        to: 'test@example.com',
        username: 'Test',
        token: 'reset-123',
      };
      await service.sendPasswordResetEmail(payload);

      expect(mockEmailQueue.add).not.toHaveBeenCalled();
      expect(mockEmailProcessor.handlePasswordResetEmail).toHaveBeenCalledWith(
        payload,
      );
    });

    it('saveGameSessionReport should execute processor directly', async () => {
      const payload = {
        pin: '123456',
        quizId: '60d0fe4f5311236168a109ca',
        quizTitle: 'Quiz',
        players: [],
      };
      await service.saveGameSessionReport(payload);

      expect(mockGameReportsQueue.add).not.toHaveBeenCalled();
      expect(
        mockGameReportsProcessor.handleSaveGameSession,
      ).toHaveBeenCalledWith(payload);
    });

    it('calculateLeagueStandings should execute processor directly', async () => {
      await service.calculateLeagueStandings();

      expect(mockGamificationQueue.add).not.toHaveBeenCalled();
      expect(
        mockGamificationProcessor.handleLeagueCalculation,
      ).toHaveBeenCalled();
    });
  });

  describe('When queue.add fails', () => {
    it('should catch queue error and execute in-process fallback', async () => {
      mockRedisService.isAvailable.mockReturnValue(true);
      mockEmailQueue.add.mockRejectedValue(
        new Error('Queue connection refused'),
      );

      const payload = {
        to: 'fallback@example.com',
        username: 'Fallback',
        token: 'fb-token',
      };
      await service.sendVerificationEmail(payload);

      expect(mockEmailProcessor.handleVerificationEmail).toHaveBeenCalledWith(
        payload,
      );
    });
  });
});
