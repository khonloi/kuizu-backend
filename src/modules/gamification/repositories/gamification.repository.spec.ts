import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GamificationRepository } from './gamification.repository';
import { GAMIFICATION_CONSTANTS } from '../../../common/constants';

describe('GamificationRepository', () => {
  let repository: GamificationRepository;
  let mockUserModel: any;

  beforeEach(() => {
    mockUserModel = {
      findById: vi.fn(),
      findByIdAndUpdate: vi.fn(),
      findOneAndUpdate: vi.fn(),
      find: vi.fn(),
    };
    repository = new GamificationRepository(mockUserModel);
  });

  describe('updateActivityStreak', () => {
    it('should update streak and streakFreezes', async () => {
      const now = new Date();
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: 'u-1', streak: { count: 5 } }),
      });

      const res = await repository.updateActivityStreak('u-1', 5, now, 1);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'u-1',
        {
          $set: {
            'streak.count': 5,
            'streak.lastActiveDate': now,
            streakFreezes: 1,
          },
        },
        { new: true },
      );
      expect(res?.streak.count).toBe(5);
    });
  });

  describe('refillHearts', () => {
    it('should findOneAndUpdate with heart constraint and gem deduction', async () => {
      mockUserModel.findOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: 'u-1', hearts: 5, gems: 50 }),
      });

      const res = await repository.refillHearts('u-1', 50);
      expect(mockUserModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: 'u-1',
          gems: { $gte: 50 },
          hearts: { $lt: GAMIFICATION_CONSTANTS.MAX_HEARTS },
        },
        {
          $set: { hearts: GAMIFICATION_CONSTANTS.MAX_HEARTS },
          $inc: { gems: -50 },
        },
        { new: true, runValidators: true },
      );
      expect(res?.hearts).toBe(5);
    });
  });

  describe('consumeHeart', () => {
    it('should decrement hearts when hearts > 0', async () => {
      mockUserModel.findOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: 'u-1', hearts: 4 }),
      });

      const res = await repository.consumeHeart('u-1');
      expect(mockUserModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'u-1', hearts: { $gt: 0 } },
        { $inc: { hearts: -1 } },
        { new: true, runValidators: true },
      );
      expect(res?.hearts).toBe(4);
    });
  });

  describe('buyStreakFreeze', () => {
    it('should increment streakFreezes and deduct gems', async () => {
      mockUserModel.findOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: 'u-1', streakFreezes: 1 }),
      });

      const res = await repository.buyStreakFreeze('u-1', 100, 2);
      expect(mockUserModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: 'u-1',
          gems: { $gte: 100 },
          streakFreezes: { $lt: 2 },
        },
        {
          $inc: { streakFreezes: 1, gems: -100 },
        },
        { new: true, runValidators: true },
      );
      expect(res?.streakFreezes).toBe(1);
    });
  });

  describe('addXp', () => {
    it('should increment xp', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: 'u-1', xp: 120 }),
      });

      const res = await repository.addXp('u-1', 20);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'u-1',
        { $inc: { xp: 20 } },
        { new: true },
      );
      expect(res?.xp).toBe(120);
    });
  });

  describe('getLeaderboard', () => {
    it('should query active users ordered by xp descending', async () => {
      const mockQuery = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([{ username: 'top1', xp: 500 }]),
      };
      mockUserModel.find.mockReturnValue(mockQuery);

      const res = await repository.getLeaderboard(10);
      expect(mockUserModel.find).toHaveBeenCalledWith(
        { isActive: true },
        { username: 1, avatarUrl: 1, xp: 1, streak: 1, league: 1 },
      );
      expect(mockQuery.sort).toHaveBeenCalledWith({ xp: -1 });
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(res).toEqual([{ username: 'top1', xp: 500 }]);
    });
  });
});
