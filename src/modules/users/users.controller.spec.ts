import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersController } from './users.controller';

describe('UsersController', () => {
  let controller: UsersController;
  let mockUsersService: any;
  let mockResponse: any;

  beforeEach(() => {
    mockUsersService = {
      getProfile: vi.fn(),
      updateProfile: vi.fn(),
      deleteAccount: vi.fn(),
      getLeaderboard: vi.fn(),
      recordActivity: vi.fn(),
      refillHearts: vi.fn(),
      consumeHeart: vi.fn(),
      buyStreakFreeze: vi.fn(),
    };

    mockResponse = {
      clearCookie: vi.fn(),
    };

    controller = new UsersController(mockUsersService);
  });

  describe('getMyProfile', () => {
    it('should return profile of the current user', async () => {
      const mockProfile = {
        id: 'u1',
        username: 'alice',
        email: 'alice@example.com',
      };
      mockUsersService.getProfile.mockResolvedValue(mockProfile);

      const result = await controller.getMyProfile('u1');
      expect(result).toBe(mockProfile);
      expect(mockUsersService.getProfile).toHaveBeenCalledWith('u1');
    });
  });

  describe('updateMyProfile', () => {
    it('should call updateProfile with dto and return updated profile', async () => {
      const dto = {
        username: 'newalice',
        avatarUrl: 'https://example.com/a.png',
      };
      const updatedProfile = {
        id: 'u1',
        username: 'newalice',
        avatarUrl: 'https://example.com/a.png',
      };
      mockUsersService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateMyProfile('u1', dto);
      expect(result).toBe(updatedProfile);
      expect(mockUsersService.updateProfile).toHaveBeenCalledWith('u1', dto);
    });
  });

  describe('deleteMyAccount', () => {
    it('should clear cookies and delete account', async () => {
      mockUsersService.deleteAccount.mockResolvedValue({
        success: true,
        message: 'Account deleted successfully',
      });

      const result = await controller.deleteMyAccount('u1', mockResponse);
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/api/auth/refresh',
      });
      expect(mockUsersService.deleteAccount).toHaveBeenCalledWith('u1');
      expect(result).toEqual({
        success: true,
        message: 'Account deleted successfully',
      });
    });
  });

  describe('recordActivity', () => {
    it('should call usersService.recordActivity', async () => {
      const activityRes = {
        streak: { count: 3 },
        streakFreezes: 0,
        message: 'Streak extended',
      };
      mockUsersService.recordActivity.mockResolvedValue(activityRes);

      const result = await controller.recordActivity('u1');
      expect(result).toBe(activityRes);
      expect(mockUsersService.recordActivity).toHaveBeenCalledWith('u1');
    });
  });

  describe('refillHearts', () => {
    it('should call usersService.refillHearts', async () => {
      const refillRes = { hearts: 5, gems: 50, message: 'Refilled' };
      mockUsersService.refillHearts.mockResolvedValue(refillRes);

      const result = await controller.refillHearts('u1');
      expect(result).toBe(refillRes);
      expect(mockUsersService.refillHearts).toHaveBeenCalledWith('u1');
    });
  });

  describe('consumeHeart', () => {
    it('should call usersService.consumeHeart', async () => {
      const consumeRes = { hearts: 4, message: 'Heart consumed' };
      mockUsersService.consumeHeart.mockResolvedValue(consumeRes);

      const result = await controller.consumeHeart('u1');
      expect(result).toBe(consumeRes);
      expect(mockUsersService.consumeHeart).toHaveBeenCalledWith('u1');
    });
  });

  describe('buyStreakFreeze', () => {
    it('should call usersService.buyStreakFreeze', async () => {
      const freezeRes = {
        streakFreezes: 1,
        gems: 100,
        message: 'Freeze purchased',
      };
      mockUsersService.buyStreakFreeze.mockResolvedValue(freezeRes);

      const result = await controller.buyStreakFreeze('u1');
      expect(result).toBe(freezeRes);
      expect(mockUsersService.buyStreakFreeze).toHaveBeenCalledWith('u1');
    });
  });

  describe('getLeaderboard', () => {
    it('should call usersService.getLeaderboard', async () => {
      const mockLeaderboard = [{ username: 'top1', xp: 500 }];
      mockUsersService.getLeaderboard.mockResolvedValue(mockLeaderboard);

      const result = await controller.getLeaderboard();
      expect(result).toBe(mockLeaderboard);
      expect(mockUsersService.getLeaderboard).toHaveBeenCalled();
    });
  });

  describe('getUserProfile', () => {
    it('should return public profile by id', async () => {
      const mockProfile = { id: 'u2', username: 'bob' };
      mockUsersService.getProfile.mockResolvedValue(mockProfile);

      const result = await controller.getUserProfile('u2');
      expect(result).toBe(mockProfile);
      expect(mockUsersService.getProfile).toHaveBeenCalledWith('u2');
    });
  });
});
