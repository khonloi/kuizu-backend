import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, JwtPayload } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockConfigService: any;
  let mockUsersService: any;

  const validPayload: JwtPayload = {
    sub: 'user-123',
    email: 'user@example.com',
    username: 'validuser',
    role: 'user',
    sid: 'session-abc',
  };

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn().mockReturnValue('test_access_secret_12345'),
    };
    mockUsersService = {
      findById: vi.fn(),
    };

    strategy = new JwtStrategy(mockConfigService, mockUsersService);
  });

  it('should validate and return user payload for active user with valid session', async () => {
    const mockUser = {
      _id: 'user-123',
      email: 'user@example.com',
      username: 'validuser',
      role: 'user',
      isActive: true,
      sessions: [
        {
          sessionId: 'session-abc',
          expiresAt: new Date(Date.now() + 100000),
        },
      ],
    };
    mockUsersService.findById.mockResolvedValue(mockUser);

    const result = await strategy.validate(validPayload);
    expect(result).toEqual({
      id: 'user-123',
      email: 'user@example.com',
      username: 'validuser',
      role: 'user',
      sid: 'session-abc',
    });
  });

  it('should throw UnauthorizedException if user does not exist', async () => {
    mockUsersService.findById.mockResolvedValue(null);

    await expect(strategy.validate(validPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException if user isActive is false', async () => {
    const inactiveUser = {
      _id: 'user-123',
      email: 'user@example.com',
      username: 'validuser',
      role: 'user',
      isActive: false,
    };
    mockUsersService.findById.mockResolvedValue(inactiveUser);

    await expect(strategy.validate(validPayload)).rejects.toThrow(
      'User account has been deactivated',
    );
  });

  it('should throw UnauthorizedException if session is revoked', async () => {
    const userWithDifferentSession = {
      _id: 'user-123',
      email: 'user@example.com',
      username: 'validuser',
      role: 'user',
      isActive: true,
      sessions: [
        {
          sessionId: 'other-session',
          expiresAt: new Date(Date.now() + 100000),
        },
      ],
    };
    mockUsersService.findById.mockResolvedValue(userWithDifferentSession);

    await expect(strategy.validate(validPayload)).rejects.toThrow(
      'Session has been revoked',
    );
  });

  it('should throw UnauthorizedException if session is expired', async () => {
    const userWithExpiredSession = {
      _id: 'user-123',
      email: 'user@example.com',
      username: 'validuser',
      role: 'user',
      isActive: true,
      sessions: [
        {
          sessionId: 'session-abc',
          expiresAt: new Date(Date.now() - 5000),
        },
      ],
    };
    mockUsersService.findById.mockResolvedValue(userWithExpiredSession);

    await expect(strategy.validate(validPayload)).rejects.toThrow(
      'Session has expired',
    );
  });

  it('should throw UnauthorizedException if session is blocklisted in Redis', async () => {
    const mockRedisService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'token:revoked:session:session-abc') return 'true';
        return null;
      }),
    };
    const strategyWithRedis = new JwtStrategy(
      mockConfigService,
      mockUsersService,
      mockRedisService as any,
    );

    await expect(strategyWithRedis.validate(validPayload)).rejects.toThrow(
      'Token has been revoked',
    );
  });

  it('should throw UnauthorizedException if user is blocklisted in Redis', async () => {
    const mockRedisService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'token:revoked:user:user-123') return 'true';
        return null;
      }),
    };
    const strategyWithRedis = new JwtStrategy(
      mockConfigService,
      mockUsersService,
      mockRedisService as any,
    );

    await expect(strategyWithRedis.validate(validPayload)).rejects.toThrow(
      'Token has been revoked',
    );
  });
});
