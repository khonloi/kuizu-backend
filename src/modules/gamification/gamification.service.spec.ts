import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { GamificationService } from './gamification.service';
import { UserRepository } from '../users/repositories';

describe('GamificationService', () => {
  let service: GamificationService;
  let mockUserRepository: any;

  const mockUser = {
    _id: new Types.ObjectId(),
    email: 'test@example.com',
    username: 'testuser',
    xp: 150,
    streak: { count: 3, lastActiveDate: new Date() },
    streakFreezes: 0,
    isActive: true,
    hearts: 5,
    gems: 100,
    league: 'bronze',
  };

  beforeEach(() => {
    mockUserRepository = {
      findById: vi.fn(),
      updateActivityStreak: vi.fn(),
      refillHearts: vi.fn(),
      consumeHeart: vi.fn(),
      buyStreakFreeze: vi.fn(),
      addXp: vi.fn(),
      getLeaderboard: vi.fn(),
    };

    service = new GamificationService(
      mockUserRepository as unknown as UserRepository,
    );
  });

  describe('recordActivity', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);
      await expect(service.recordActivity('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should start streak at 1 if user has no prior activity', async () => {
      const userNoStreak = { ...mockUser, streak: null, streakFreezes: 0 };
      mockUserRepository.findById.mockResolvedValue(userNoStreak);
      mockUserRepository.updateActivityStreak.mockResolvedValue({
        streak: { count: 1 },
        streakFreezes: 0,
      });

      const result = await service.recordActivity(mockUser._id.toString());
      expect(result.streak?.count).toBe(1);
      expect(result.message).toContain('First activity recorded');
      expect(mockUserRepository.updateActivityStreak).toHaveBeenCalledWith(
        mockUser._id.toString(),
        1,
        expect.any(Date),
        0,
      );
    });

    it('should maintain streak if activity was already recorded today', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.updateActivityStreak.mockResolvedValue({
        streak: { count: 3 },
        streakFreezes: 0,
      });

      const result = await service.recordActivity(mockUser._id.toString());
      expect(result.streak?.count).toBe(3);
      expect(result.message).toContain('Activity already recorded today');
    });

    it('should increment streak if activity is on consecutive day', async () => {
      const yesterday = new Date(Date.now() - 86400000);
      const userYesterday = {
        ...mockUser,
        streak: { count: 3, lastActiveDate: yesterday },
      };
      mockUserRepository.findById.mockResolvedValue(userYesterday);
      mockUserRepository.updateActivityStreak.mockResolvedValue({
        streak: { count: 4 },
        streakFreezes: 0,
      });

      const result = await service.recordActivity(mockUser._id.toString());
      expect(result.streak?.count).toBe(4);
      expect(result.message).toContain('Streak extended to 4 days');
    });

    it('should consume streak freeze if gap is greater than 1 day and freeze is available', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
      const userFreeze = {
        ...mockUser,
        streak: { count: 5, lastActiveDate: threeDaysAgo },
        streakFreezes: 1,
      };
      mockUserRepository.findById.mockResolvedValue(userFreeze);
      mockUserRepository.updateActivityStreak.mockResolvedValue({
        streak: { count: 6 },
        streakFreezes: 0,
      });

      const result = await service.recordActivity(mockUser._id.toString());
      expect(result.streak?.count).toBe(6);
      expect(result.streakFreezes).toBe(0);
      expect(result.message).toContain('Streak freeze consumed');
    });

    it('should reset streak to 1 if gap is greater than 1 day and no freeze is available', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
      const userBroken = {
        ...mockUser,
        streak: { count: 10, lastActiveDate: threeDaysAgo },
        streakFreezes: 0,
      };
      mockUserRepository.findById.mockResolvedValue(userBroken);
      mockUserRepository.updateActivityStreak.mockResolvedValue({
        streak: { count: 1 },
        streakFreezes: 0,
      });

      const result = await service.recordActivity(mockUser._id.toString());
      expect(result.streak?.count).toBe(1);
      expect(result.message).toContain('Streak was broken');
    });
  });

  describe('refillHearts', () => {
    it('should refill hearts to 5 and deduct gems if eligible', async () => {
      const userLowHearts = { ...mockUser, hearts: 1, gems: 100 };
      mockUserRepository.findById.mockResolvedValue(userLowHearts);
      mockUserRepository.refillHearts.mockResolvedValue({
        hearts: 5,
        gems: 50,
      });

      const result = await service.refillHearts(mockUser._id.toString(), 50);
      expect(result.hearts).toBe(5);
      expect(result.gems).toBe(50);
      expect(result.message).toContain('Hearts successfully refilled');
    });

    it('should throw BadRequestException if hearts are already full (5)', async () => {
      const userFullHearts = { ...mockUser, hearts: 5, gems: 100 };
      mockUserRepository.findById.mockResolvedValue(userFullHearts);

      await expect(
        service.refillHearts(mockUser._id.toString()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user lacks enough gems', async () => {
      const userLowGems = { ...mockUser, hearts: 2, gems: 10 };
      mockUserRepository.findById.mockResolvedValue(userLowGems);

      await expect(
        service.refillHearts(mockUser._id.toString(), 50),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('consumeHeart', () => {
    it('should consume a heart if hearts > 0', async () => {
      const userWithHearts = { ...mockUser, hearts: 3 };
      mockUserRepository.findById.mockResolvedValue(userWithHearts);
      mockUserRepository.consumeHeart.mockResolvedValue({
        hearts: 2,
      });

      const result = await service.consumeHeart(mockUser._id.toString());
      expect(result.hearts).toBe(2);
      expect(result.message).toBe('Heart consumed');
    });

    it('should throw BadRequestException if hearts are 0', async () => {
      const userZeroHearts = { ...mockUser, hearts: 0 };
      mockUserRepository.findById.mockResolvedValue(userZeroHearts);

      await expect(
        service.consumeHeart(mockUser._id.toString()),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('buyStreakFreeze', () => {
    it('should purchase streak freeze and decrement gems', async () => {
      const userCanBuy = { ...mockUser, streakFreezes: 0, gems: 150 };
      mockUserRepository.findById.mockResolvedValue(userCanBuy);
      mockUserRepository.buyStreakFreeze.mockResolvedValue({
        streakFreezes: 1,
        gems: 50,
      });

      const result = await service.buyStreakFreeze(
        mockUser._id.toString(),
        100,
        2,
      );
      expect(result.streakFreezes).toBe(1);
      expect(result.gems).toBe(50);
      expect(result.message).toContain('purchased successfully');
    });

    it('should throw BadRequestException if max streak freezes already reached', async () => {
      const userMaxFreezes = { ...mockUser, streakFreezes: 2, gems: 200 };
      mockUserRepository.findById.mockResolvedValue(userMaxFreezes);

      await expect(
        service.buyStreakFreeze(mockUser._id.toString(), 100, 2),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user does not have enough gems', async () => {
      const userPoor = { ...mockUser, streakFreezes: 0, gems: 50 };
      mockUserRepository.findById.mockResolvedValue(userPoor);

      await expect(
        service.buyStreakFreeze(mockUser._id.toString(), 100, 2),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addXp', () => {
    it('should increment xp for user', async () => {
      mockUserRepository.addXp.mockResolvedValue({
        ...mockUser,
        xp: 170,
      });

      const result = await service.addXp(mockUser._id.toString(), 20);
      expect(mockUserRepository.addXp).toHaveBeenCalledWith(
        mockUser._id.toString(),
        20,
      );
      expect(result.xp).toBe(170);
    });
  });

  describe('getLeaderboard', () => {
    it('should return top users sorted by xp', async () => {
      const mockLeaderboard = [
        { username: 'top1', xp: 500 },
        { username: 'top2', xp: 400 },
      ];
      mockUserRepository.getLeaderboard.mockResolvedValue(mockLeaderboard);

      const result = await service.getLeaderboard(10);
      expect(mockUserRepository.getLeaderboard).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockLeaderboard);
    });
  });
});
