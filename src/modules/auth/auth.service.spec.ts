import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

vi.mock('bcryptjs', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

describe('AuthService', () => {
  let service: AuthService;
  let mockUsersService: any;
  let mockJwtService: any;
  let mockConfigService: any;

  const mockUser = {
    _id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashed_password',
    role: 'user',
    isEmailVerified: false,
    emailVerificationToken: 'verify-token-123',
    emailVerificationExpires: new Date(Date.now() + 86400000),
    passwordResetToken: 'reset-token-123',
    passwordResetExpires: new Date(Date.now() + 3600000),
    xp: 100,
    streak: { count: 1, lastActiveDate: null },
    hearts: 5,
    gems: 100,
    league: 'bronze',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUsersService = {
      findByEmail: vi.fn(),
      findByUsername: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updatePassword: vi.fn(),
      findByVerificationToken: vi.fn(),
      findByPasswordResetToken: vi.fn(),
      setEmailVerificationToken: vi.fn(),
      markEmailAsVerified: vi.fn(),
      setPasswordResetToken: vi.fn(),
      resetPassword: vi.fn(),
      addSession: vi.fn(),
      removeSession: vi.fn(),
      rotateSession: vi.fn(),
      removeAllSessions: vi.fn(),
      removeAllOtherSessions: vi.fn(),
      getSessions: vi.fn(),
    };

    mockJwtService = {
      sign: vi.fn().mockReturnValue('mock_jwt_token'),
      verify: vi.fn(),
      decode: vi.fn(),
    };

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') return 'test_access_secret';
        if (key === 'JWT_REFRESH_SECRET') return 'test_refresh_secret';
        return null;
      }),
    };

    service = new AuthService(
      mockUsersService,
      mockJwtService,
      mockConfigService,
    );
  });

  describe('register', () => {
    it('should register a new user successfully with verification token', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.findByUsername.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed_new_password' as never);

      const result = await service.register({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.isEmailVerified).toBe(false);
      expect(result.verificationToken).toBeDefined();
      expect(result.accessToken).toBe('mock_jwt_token');
      expect(result.refreshToken).toBe('mock_jwt_token');
      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          username: 'testuser',
          passwordHash: 'hashed_new_password',
          role: 'user',
          isEmailVerified: false,
          emailVerificationToken: expect.any(String),
          emailVerificationExpires: expect.any(Date),
        }),
      );
    });

    it('should delegate verification email to jobsProducerService when provided', async () => {
      const mockJobsProducer = {
        sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
        sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
      };

      const customAuthService = new AuthService(
        mockUsersService,
        mockJwtService,
        mockConfigService,
        mockJobsProducer as any,
      );

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.findByUsername.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed_pwd' as never);

      await customAuthService.register({
        email: 'async-user@example.com',
        username: 'asyncuser',
        password: 'password123',
      });

      expect(mockJobsProducer.sendVerificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          username: mockUser.username,
          token: expect.any(String),
        }),
      );
    });

    it('should throw ConflictException if email is already in use', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          username: 'newuser',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if username is already taken', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.findByUsername.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'new@example.com',
          username: 'testuser',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login with valid email and password', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await service.login({
        emailOrUsername: 'test@example.com',
        password: 'password123',
      });

      expect(result.user.username).toBe('testuser');
      expect(result.user.isEmailVerified).toBe(false);
      expect(result.accessToken).toBe('mock_jwt_token');
    });

    it('should login with valid username and password', async () => {
      mockUsersService.findByUsername.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await service.login({
        emailOrUsername: 'testuser',
        password: 'password123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBe('mock_jwt_token');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findByUsername.mockResolvedValue(null);

      await expect(
        service.login({
          emailOrUsername: 'unknown_user',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      mockUsersService.findByUsername.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        service.login({
          emailOrUsername: 'testuser',
          password: 'wrong_password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user account is deactivated/suspended', async () => {
      mockUsersService.findByUsername.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        service.login({
          emailOrUsername: 'testuser',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens and rotate session for a valid refresh token', async () => {
      const validToken = 'valid_refresh_token';
      const tokenHash = (service as any).hashToken(validToken);
      const userWithSession = {
        ...mockUser,
        sessions: [
          {
            sessionId: 'sess-123',
            tokenHash,
            expiresAt: new Date(Date.now() + 86400000),
          },
        ],
      };
      mockJwtService.verify.mockReturnValue({
        sub: 'user-123',
        jti: 'sess-123',
      });
      mockUsersService.findById.mockResolvedValue(userWithSession);

      const tokens = await service.refreshToken(validToken);
      expect(tokens.accessToken).toBe('mock_jwt_token');
      expect(tokens.refreshToken).toBe('mock_jwt_token');
      expect(mockUsersService.rotateSession).toHaveBeenCalledWith(
        'user-123',
        'sess-123',
        expect.objectContaining({
          sessionId: expect.any(String),
          tokenHash: expect.any(String),
        }),
      );
    });

    it('should throw UnauthorizedException and revoke all sessions when token reuse / replay is detected', async () => {
      const stolenToken = 'stolen_refresh_token';
      const userWithSession = {
        ...mockUser,
        sessions: [
          {
            sessionId: 'sess-123',
            tokenHash: 'different_hash_from_previous_rotation',
            expiresAt: new Date(Date.now() + 86400000),
          },
        ],
      };
      mockJwtService.verify.mockReturnValue({
        sub: 'user-123',
        jti: 'sess-123',
      });
      mockUsersService.findById.mockResolvedValue(userWithSession);

      await expect(service.refreshToken(stolenToken)).rejects.toThrow(
        /Refresh token reuse detected/,
      );
      expect(mockUsersService.removeAllSessions).toHaveBeenCalledWith(
        'user-123',
      );
    });

    it('should throw UnauthorizedException if user from token payload does not exist', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-123',
        jti: 'sess-123',
      });
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.refreshToken('valid_refresh_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token verification fails', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        service.refreshToken('invalid_or_expired_token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('session management', () => {
    it('logout should remove session if refreshToken is provided', async () => {
      mockJwtService.decode.mockReturnValue({ jti: 'sess-123' });

      const res = await service.logout('user-123', 'some_token');
      expect(res.success).toBe(true);
      expect(mockUsersService.removeSession).toHaveBeenCalledWith(
        'user-123',
        'sess-123',
      );
    });

    it('getSessions should return sessions with isCurrent flag', async () => {
      const now = new Date();
      mockUsersService.getSessions.mockResolvedValue([
        {
          sessionId: 'sess-1',
          userAgent: 'Chrome',
          ipAddress: '127.0.0.1',
          createdAt: now,
          expiresAt: now,
        },
        {
          sessionId: 'sess-2',
          userAgent: 'Firefox',
          ipAddress: '127.0.0.2',
          createdAt: now,
          expiresAt: now,
        },
      ]);
      mockJwtService.decode.mockReturnValue({ jti: 'sess-1' });

      const sessions = await service.getSessions('user-123', 'current_token');
      expect(sessions).toHaveLength(2);
      expect(sessions[0].isCurrent).toBe(true);
      expect(sessions[1].isCurrent).toBe(false);
    });

    it('revokeSession should remove targeted session', async () => {
      const res = await service.revokeSession('user-123', 'sess-target');
      expect(res.success).toBe(true);
      expect(mockUsersService.removeSession).toHaveBeenCalledWith(
        'user-123',
        'sess-target',
      );
    });

    it('revokeOtherSessions should remove all other sessions', async () => {
      mockJwtService.decode.mockReturnValue({ jti: 'sess-current' });

      const res = await service.revokeOtherSessions(
        'user-123',
        'current_token',
      );
      expect(res.success).toBe(true);
      expect(mockUsersService.removeAllOtherSessions).toHaveBeenCalledWith(
        'user-123',
        'sess-current',
      );
    });

    it('revokeAllSessions should clear all sessions for user', async () => {
      const res = await service.revokeAllSessions('user-123');
      expect(res.success).toBe(true);
      expect(mockUsersService.removeAllSessions).toHaveBeenCalledWith(
        'user-123',
      );
    });
  });

  describe('changePassword', () => {
    it('should change password successfully when current password is correct', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(bcrypt.hash).mockResolvedValue('new_hashed_password' as never);
      mockUsersService.updatePassword.mockResolvedValue({
        ...mockUser,
        passwordHash: 'new_hashed_password',
      });

      const result = await service.changePassword('user-123', {
        currentPassword: 'old_password',
        newPassword: 'new_password123',
      });

      expect(result).toEqual({
        success: true,
        message: 'Password updated successfully',
      });
      expect(mockUsersService.updatePassword).toHaveBeenCalledWith(
        'user-123',
        'new_hashed_password',
      );
    });

    it('should throw NotFoundException if user is not found', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(
        service.changePassword('nonexistent-id', {
          currentPassword: 'old_password',
          newPassword: 'new_password123',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException if current password is incorrect', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        service.changePassword('user-123', {
          currentPassword: 'wrong_old_password',
          newPassword: 'new_password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully for valid token', async () => {
      mockUsersService.findByVerificationToken.mockResolvedValue(mockUser);
      mockUsersService.markEmailAsVerified.mockResolvedValue({
        ...mockUser,
        isEmailVerified: true,
      });

      const result = await service.verifyEmail({ token: 'verify-token-123' });
      expect(result).toEqual({
        success: true,
        message: 'Email successfully verified',
      });
      expect(mockUsersService.markEmailAsVerified).toHaveBeenCalledWith(
        'user-123',
      );
    });

    it('should throw BadRequestException if verification token does not match any user', async () => {
      mockUsersService.findByVerificationToken.mockResolvedValue(null);

      await expect(
        service.verifyEmail({ token: 'invalid_token' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if verification token is expired', async () => {
      const expiredUser = {
        ...mockUser,
        emailVerificationExpires: new Date(Date.now() - 10000),
      };
      mockUsersService.findByVerificationToken.mockResolvedValue(expiredUser);

      await expect(
        service.verifyEmail({ token: 'verify-token-123' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resendVerification', () => {
    it('should resend verification token if user exists and email is not verified', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.setEmailVerificationToken.mockResolvedValue(mockUser);

      const result = await service.resendVerification({
        email: 'test@example.com',
      });
      expect(result.success).toBe(true);
      expect(result.verificationToken).toBeDefined();
      expect(mockUsersService.setEmailVerificationToken).toHaveBeenCalledWith(
        'user-123',
        expect.any(String),
        expect.any(Date),
      );
    });

    it('should return neutral message if user does not exist (anti-enumeration)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.resendVerification({
        email: 'unknown@example.com',
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('If that email is registered');
      expect(mockUsersService.setEmailVerificationToken).not.toHaveBeenCalled();
    });

    it('should notify if email is already verified', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        ...mockUser,
        isEmailVerified: true,
      });

      const result = await service.resendVerification({
        email: 'test@example.com',
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Email is already verified.');
      expect(mockUsersService.setEmailVerificationToken).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('should generate reset token if user exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.setPasswordResetToken.mockResolvedValue(mockUser);

      const result = await service.forgotPassword({
        email: 'test@example.com',
      });
      expect(result.success).toBe(true);
      expect(result.resetToken).toBeDefined();
      expect(mockUsersService.setPasswordResetToken).toHaveBeenCalledWith(
        'user-123',
        expect.any(String),
        expect.any(Date),
      );
    });

    it('should return neutral message if user does not exist', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'nonexistent@example.com',
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('If an account exists with that email');
      expect(mockUsersService.setPasswordResetToken).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password for valid token', async () => {
      mockUsersService.findByPasswordResetToken.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.hash).mockResolvedValue('brand_new_hash' as never);
      mockUsersService.resetPassword.mockResolvedValue({
        ...mockUser,
        passwordHash: 'brand_new_hash',
      });

      const result = await service.resetPassword({
        token: 'reset-token-123',
        newPassword: 'new_strong_password',
      });

      expect(result).toEqual({
        success: true,
        message: 'Password has been reset successfully',
      });
      expect(mockUsersService.resetPassword).toHaveBeenCalledWith(
        'user-123',
        'brand_new_hash',
      );
    });

    it('should throw BadRequestException if reset token is invalid', async () => {
      mockUsersService.findByPasswordResetToken.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: 'invalid_token',
          newPassword: 'new_password',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if reset token is expired', async () => {
      const expiredUser = {
        ...mockUser,
        passwordResetExpires: new Date(Date.now() - 10000),
      };
      mockUsersService.findByPasswordResetToken.mockResolvedValue(expiredUser);

      await expect(
        service.resetPassword({
          token: 'reset-token-123',
          newPassword: 'new_password',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
