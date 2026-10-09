import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserModel: any;

  const mockUser = {
    _id: new Types.ObjectId(),
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashedpass',
    role: 'user',
    avatarUrl: 'https://example.com/avatar.png',
    isEmailVerified: false,
    emailVerificationToken: 'verify-tok-123',
    emailVerificationExpires: new Date(Date.now() + 86400000),
    passwordResetToken: 'reset-tok-123',
    passwordResetExpires: new Date(Date.now() + 3600000),
    xp: 150,
    streak: { count: 3, lastActiveDate: new Date() },
    streakFreezes: 0,
    isActive: true,
    hearts: 5,
    gems: 100,
    league: 'bronze',
  };

  beforeEach(() => {
    mockUserModel = vi.fn().mockImplementation(function (this: any, dto: any) {
      Object.assign(this, dto);
      this.save = vi
        .fn()
        .mockResolvedValue({ _id: new Types.ObjectId(), ...dto });
    });
    mockUserModel.findById = vi.fn();
    mockUserModel.findOne = vi.fn();
    mockUserModel.findByIdAndUpdate = vi.fn();
    mockUserModel.findByIdAndDelete = vi.fn();
    mockUserModel.find = vi.fn();
    mockUserModel.countDocuments = vi.fn();

    service = new UsersService(mockUserModel);
  });

  describe('create', () => {
    it('should create and save a new user', async () => {
      const userData = {
        email: 'new@example.com',
        username: 'newuser',
        passwordHash: 'hash',
      };
      const result = await service.create(userData);

      expect(result).toBeDefined();
      expect(result.email).toBe(userData.email);
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      });

      const result = await service.findById(mockUser._id.toString());
      expect(result).toEqual(mockUser);
      expect(mockUserModel.findById).toHaveBeenCalledWith(
        mockUser._id.toString(),
      );
    });
  });

  describe('findByEmail', () => {
    it('should find user by lowercase email', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      });

      const result = await service.findByEmail('TEST@Example.com');
      expect(result).toEqual(mockUser);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: 'test@example.com',
      });
    });
  });

  describe('findByUsername', () => {
    it('should find user by username', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      });

      const result = await service.findByUsername('testuser');
      expect(result).toEqual(mockUser);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        username: 'testuser',
      });
    });
  });

  describe('getProfile', () => {
    it('should return sanitized profile with isEmailVerified for valid user', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      });

      const profile = await service.getProfile(mockUser._id.toString());
      expect(profile).toEqual({
        id: mockUser._id,
        email: mockUser.email,
        username: mockUser.username,
        role: mockUser.role,
        avatarUrl: mockUser.avatarUrl,
        isActive: true,
        isEmailVerified: false,
        xp: mockUser.xp,
        streak: mockUser.streak,
        streakFreezes: 0,
        hearts: mockUser.hearts,
        gems: mockUser.gems,
        league: mockUser.league,
      });

      expect(profile).not.toHaveProperty('passwordHash');
      expect(profile).not.toHaveProperty('emailVerificationToken');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(service.getProfile('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should update profile when username is available', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });
      const updatedUserDoc = {
        ...mockUser,
        username: 'newname',
        avatarUrl: 'https://newavatar.com/pic.png',
      };
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(updatedUserDoc),
      });

      const result = await service.updateProfile(mockUser._id.toString(), {
        username: 'newname',
        avatarUrl: 'https://newavatar.com/pic.png',
      });

      expect(result.username).toBe('newname');
      expect(result.avatarUrl).toBe('https://newavatar.com/pic.png');
      expect(result.isEmailVerified).toBe(false);
    });

    it('should throw ConflictException if updated username is already taken by another user', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      });
      const otherUser = { _id: new Types.ObjectId(), username: 'taken_name' };
      mockUserModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(otherUser),
      });

      await expect(
        service.updateProfile(mockUser._id.toString(), {
          username: 'taken_name',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should not throw ConflictException if username is unchanged', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      });
      const updatedUserDoc = {
        ...mockUser,
        avatarUrl: 'https://updated.com/pic.png',
      };
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(updatedUserDoc),
      });

      const result = await service.updateProfile(mockUser._id.toString(), {
        username: 'testuser',
        avatarUrl: 'https://updated.com/pic.png',
      });

      expect(result.avatarUrl).toBe('https://updated.com/pic.png');
    });

    it('should throw NotFoundException if user to update does not exist', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateProfile('nonexistent-id', { username: 'newname' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByVerificationToken', () => {
    it('should find user by verification token', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      });

      const result = await service.findByVerificationToken('verify-tok-123');
      expect(result).toEqual(mockUser);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        emailVerificationToken: 'verify-tok-123',
      });
    });
  });

  describe('findByPasswordResetToken', () => {
    it('should find user by password reset token', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      });

      const result = await service.findByPasswordResetToken('reset-tok-123');
      expect(result).toEqual(mockUser);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        passwordResetToken: 'reset-tok-123',
      });
    });
  });

  describe('setEmailVerificationToken', () => {
    it('should set email verification token and expiration', async () => {
      const expires = new Date();
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi
          .fn()
          .mockResolvedValue({
            ...mockUser,
            emailVerificationToken: 'token',
            emailVerificationExpires: expires,
          }),
      });

      const result = await service.setEmailVerificationToken(
        mockUser._id.toString(),
        'token',
        expires,
      );
      expect(result?.emailVerificationToken).toBe('token');
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUser._id.toString(),
        {
          $set: {
            emailVerificationToken: 'token',
            emailVerificationExpires: expires,
          },
        },
        { new: true },
      );
    });
  });

  describe('markEmailAsVerified', () => {
    it('should mark email as verified and clear verification tokens', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          ...mockUser,
          isEmailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        }),
      });

      const result = await service.markEmailAsVerified(mockUser._id.toString());
      expect(result?.isEmailVerified).toBe(true);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUser._id.toString(),
        {
          $set: {
            isEmailVerified: true,
            emailVerificationToken: null,
            emailVerificationExpires: null,
          },
        },
        { new: true },
      );
    });
  });

  describe('setPasswordResetToken', () => {
    it('should set password reset token and expiration', async () => {
      const expires = new Date();
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi
          .fn()
          .mockResolvedValue({
            ...mockUser,
            passwordResetToken: 'reset-tok',
            passwordResetExpires: expires,
          }),
      });

      const result = await service.setPasswordResetToken(
        mockUser._id.toString(),
        'reset-tok',
        expires,
      );
      expect(result?.passwordResetToken).toBe('reset-tok');
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUser._id.toString(),
        {
          $set: {
            passwordResetToken: 'reset-tok',
            passwordResetExpires: expires,
          },
        },
        { new: true },
      );
    });
  });

  describe('resetPassword', () => {
    it('should update password and clear reset tokens', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          ...mockUser,
          passwordHash: 'new_hashed',
          passwordResetToken: null,
          passwordResetExpires: null,
        }),
      });

      const result = await service.resetPassword(
        mockUser._id.toString(),
        'new_hashed',
      );
      expect(result?.passwordHash).toBe('new_hashed');
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUser._id.toString(),
        {
          $set: {
            passwordHash: 'new_hashed',
            passwordResetToken: null,
            passwordResetExpires: null,
          },
        },
        { new: true },
      );
    });
  });

  describe('updatePassword', () => {
    it('should update password hash', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi
          .fn()
          .mockResolvedValue({ ...mockUser, passwordHash: 'newhash' }),
      });

      const result = await service.updatePassword(
        mockUser._id.toString(),
        'newhash',
      );
      expect(result.passwordHash).toBe('newhash');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(
        service.updatePassword('nonexistent-id', 'newhash'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAccount', () => {
    it('should delete user and return success message', async () => {
      mockUserModel.findByIdAndDelete.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      });

      const result = await service.deleteAccount(mockUser._id.toString());
      expect(result).toEqual({
        success: true,
        message: 'Account deleted successfully',
      });
    });

    it('should throw NotFoundException if user to delete is not found', async () => {
      mockUserModel.findByIdAndDelete.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(service.deleteAccount('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addXp', () => {
    it('should increment xp for user', async () => {
      mockUserModel.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        xp: 170,
      });

      const result = await service.addXp(mockUser._id.toString(), 20);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUser._id.toString(),
        { $inc: { xp: 20 } },
        { new: true },
      );
      expect(result?.xp).toBe(170);
    });
  });

  describe('getLeaderboard', () => {
    it('should return top users sorted by xp', async () => {
      const mockList = [
        { username: 'top1', xp: 500 },
        { username: 'top2', xp: 400 },
      ];
      mockUserModel.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(mockList),
          }),
        }),
      });

      const result = await service.getLeaderboard(10);
      expect(result).toEqual(mockList);
    });
  });

  describe('recordActivity', () => {
    it('should start streak at 1 if user has no prior activity', async () => {
      const userWithoutStreak = {
        ...mockUser,
        streak: { count: 0, lastActiveDate: null },
      };
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(userWithoutStreak),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          ...userWithoutStreak,
          streak: { count: 1, lastActiveDate: new Date() },
        }),
      });

      const result = await service.recordActivity(mockUser._id.toString());
      expect(result.streak?.count).toBe(1);
      expect(result.message).toContain('First activity recorded');
    });

    it('should maintain streak if activity was already recorded today', async () => {
      const userActiveToday = {
        ...mockUser,
        streak: { count: 5, lastActiveDate: new Date() },
      };
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(userActiveToday),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(userActiveToday),
      });

      const result = await service.recordActivity(mockUser._id.toString());
      expect(result.streak?.count).toBe(5);
      expect(result.message).toContain('already recorded today');
    });

    it('should increment streak if activity is on consecutive day', async () => {
      const yesterday = new Date(Date.now() - 86400000);
      const userActiveYesterday = {
        ...mockUser,
        streak: { count: 4, lastActiveDate: yesterday },
      };
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(userActiveYesterday),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          ...userActiveYesterday,
          streak: { count: 5, lastActiveDate: new Date() },
        }),
      });

      const result = await service.recordActivity(mockUser._id.toString());
      expect(result.streak?.count).toBe(5);
      expect(result.message).toContain('Streak extended to 5 days');
    });

    it('should consume streak freeze if gap is greater than 1 day and freeze is available', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
      const userWithFreeze = {
        ...mockUser,
        streak: { count: 10, lastActiveDate: threeDaysAgo },
        streakFreezes: 1,
      };
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(userWithFreeze),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          ...userWithFreeze,
          streak: { count: 11, lastActiveDate: new Date() },
          streakFreezes: 0,
        }),
      });

      const result = await service.recordActivity(mockUser._id.toString());
      expect(result.streak?.count).toBe(11);
      expect(result.streakFreezes).toBe(0);
      expect(result.message).toContain('Streak freeze consumed');
    });

    it('should reset streak to 1 if gap is greater than 1 day and no freeze is available', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
      const userWithoutFreeze = {
        ...mockUser,
        streak: { count: 10, lastActiveDate: threeDaysAgo },
        streakFreezes: 0,
      };
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(userWithoutFreeze),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          ...userWithoutFreeze,
          streak: { count: 1, lastActiveDate: new Date() },
        }),
      });

      const result = await service.recordActivity(mockUser._id.toString());
      expect(result.streak?.count).toBe(1);
      expect(result.message).toContain('Streak was broken');
    });
  });

  describe('refillHearts', () => {
    it('should refill hearts to 5 and deduct gems if eligible', async () => {
      const userLowHearts = { ...mockUser, hearts: 2, gems: 100 };
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(userLowHearts),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi
          .fn()
          .mockResolvedValue({ ...userLowHearts, hearts: 5, gems: 50 }),
      });

      const result = await service.refillHearts(mockUser._id.toString(), 50);
      expect(result.hearts).toBe(5);
      expect(result.gems).toBe(50);
      expect(result.message).toContain('Hearts successfully refilled');
    });

    it('should throw BadRequestException if hearts are already full (5)', async () => {
      const userFullHearts = { ...mockUser, hearts: 5, gems: 100 };
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(userFullHearts),
      });

      await expect(
        service.refillHearts(mockUser._id.toString()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user lacks enough gems', async () => {
      const userLowGems = { ...mockUser, hearts: 2, gems: 10 };
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(userLowGems),
      });

      await expect(
        service.refillHearts(mockUser._id.toString(), 50),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('consumeHeart', () => {
    it('should consume a heart if hearts > 0', async () => {
      const userWithHearts = { ...mockUser, hearts: 4 };
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(userWithHearts),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ ...userWithHearts, hearts: 3 }),
      });

      const result = await service.consumeHeart(mockUser._id.toString());
      expect(result.hearts).toBe(3);
    });

    it('should throw BadRequestException if hearts are 0', async () => {
      const userZeroHearts = { ...mockUser, hearts: 0 };
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(userZeroHearts),
      });

      await expect(
        service.consumeHeart(mockUser._id.toString()),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('buyStreakFreeze', () => {
    it('should purchase streak freeze and decrement gems', async () => {
      const userEligible = { ...mockUser, streakFreezes: 0, gems: 200 };
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(userEligible),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi
          .fn()
          .mockResolvedValue({ ...userEligible, streakFreezes: 1, gems: 100 }),
      });

      const result = await service.buyStreakFreeze(
        mockUser._id.toString(),
        100,
      );
      expect(result.streakFreezes).toBe(1);
      expect(result.gems).toBe(100);
    });

    it('should throw BadRequestException if max streak freezes already reached', async () => {
      const userMaxFreezes = { ...mockUser, streakFreezes: 2, gems: 200 };
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(userMaxFreezes),
      });

      await expect(
        service.buyStreakFreeze(mockUser._id.toString(), 100, 2),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user does not have enough gems', async () => {
      const userNoGems = { ...mockUser, streakFreezes: 0, gems: 50 };
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(userNoGems),
      });

      await expect(
        service.buyStreakFreeze(mockUser._id.toString(), 100),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllAdmin', () => {
    it('should query users with filters, search, and pagination', async () => {
      mockUserModel.countDocuments.mockReturnValue({
        exec: vi.fn().mockResolvedValue(1),
      });
      mockUserModel.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              exec: vi.fn().mockResolvedValue([mockUser]),
            }),
          }),
        }),
      });

      const result = await service.findAllAdmin({
        page: 1,
        limit: 10,
        role: 'user',
        isActive: true,
        search: 'test',
      });

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(mockUserModel.countDocuments).toHaveBeenCalled();
    });
  });

  describe('findAdminUserById', () => {
    it('should return user for valid id', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      });

      const result = await service.findAdminUserById(mockUser._id.toString());
      expect(result).toBe(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(service.findAdminUserById('unknown_id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUserRole', () => {
    it('should update role of user', async () => {
      const updatedUser = { ...mockUser, role: 'teacher' };
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(updatedUser),
        }),
      });

      const result = await service.updateUserRole(
        mockUser._id.toString(),
        'teacher',
      );
      expect(result.role).toBe('teacher');
    });

    it('should throw NotFoundException if user to update does not exist', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.updateUserRole('unknown_id', 'teacher'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserStatus', () => {
    it('should update active/suspended status of user', async () => {
      const suspendedUser = { ...mockUser, isActive: false };
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(suspendedUser),
        }),
      });

      const result = await service.updateUserStatus(
        mockUser._id.toString(),
        false,
      );
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException if user to update status does not exist', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.updateUserStatus('unknown_id', false),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
