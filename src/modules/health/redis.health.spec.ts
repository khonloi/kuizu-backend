import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisHealthIndicator } from './redis.health';
import { HealthIndicatorService } from '@nestjs/terminus';

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let mockRedisService: {
    isAvailable: ReturnType<typeof vi.fn>;
    ping: ReturnType<typeof vi.fn>;
  };
  let mockHealthIndicatorService: Partial<HealthIndicatorService>;
  let mockSession: {
    up: ReturnType<typeof vi.fn>;
    down: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRedisService = {
      isAvailable: vi.fn(),
      ping: vi.fn(),
    };

    mockSession = {
      up: vi.fn().mockImplementation((data) => ({
        redis: { status: 'up', ...data },
      })),
      down: vi.fn().mockImplementation((data) => ({
        redis: { status: 'down', ...data },
      })),
    };

    mockHealthIndicatorService = {
      check: vi.fn().mockReturnValue(mockSession),
    };

    indicator = new RedisHealthIndicator(
      mockRedisService as any,
      mockHealthIndicatorService as HealthIndicatorService,
    );
  });

  it('should return up with in-memory-fallback mode if Redis is not available', async () => {
    mockRedisService.isAvailable.mockReturnValue(false);

    const result = await indicator.isHealthy('redis');

    expect(mockHealthIndicatorService.check).toHaveBeenCalledWith('redis');
    expect(mockSession.up).toHaveBeenCalledWith({ mode: 'in-memory-fallback' });
    expect(result).toEqual({
      redis: {
        status: 'up',
        mode: 'in-memory-fallback',
      },
    });
    expect(mockRedisService.ping).not.toHaveBeenCalled();
  });

  it('should return up with redis-connected mode when Redis ping returns PONG', async () => {
    mockRedisService.isAvailable.mockReturnValue(true);
    mockRedisService.ping.mockResolvedValue(true);

    const result = await indicator.isHealthy('redis');

    expect(mockHealthIndicatorService.check).toHaveBeenCalledWith('redis');
    expect(mockSession.up).toHaveBeenCalledWith({ mode: 'redis-connected' });
    expect(result).toEqual({
      redis: {
        status: 'up',
        mode: 'redis-connected',
      },
    });
    expect(mockRedisService.ping).toHaveBeenCalled();
  });

  it('should return down status when Redis ping returns false', async () => {
    mockRedisService.isAvailable.mockReturnValue(true);
    mockRedisService.ping.mockResolvedValue(false);

    const result = await indicator.isHealthy('redis');

    expect(mockSession.down).toHaveBeenCalledWith({
      message: 'Redis ping did not return PONG',
    });
    expect(result).toEqual({
      redis: {
        status: 'down',
        message: 'Redis ping did not return PONG',
      },
    });
  });

  it('should return down status when Redis ping throws an error', async () => {
    mockRedisService.isAvailable.mockReturnValue(true);
    mockRedisService.ping.mockRejectedValue(new Error('Connection lost'));

    const result = await indicator.isHealthy('redis');

    expect(mockSession.down).toHaveBeenCalledWith({
      message: 'Connection lost',
    });
    expect(result).toEqual({
      redis: {
        status: 'down',
        message: 'Connection lost',
      },
    });
  });
});
