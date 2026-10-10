import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisThrottlerStorageService } from './redis-throttler-storage.service';
import { RedisService } from '../redis/redis.service';

describe('RedisThrottlerStorageService', () => {
  let storage: RedisThrottlerStorageService;
  let mockRedisService: {
    getClient: ReturnType<typeof vi.fn>;
    isAvailable: ReturnType<typeof vi.fn>;
  };
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      pttl: vi.fn(),
      incr: vi.fn(),
      pexpire: vi.fn(),
      set: vi.fn(),
    };

    mockRedisService = {
      getClient: vi.fn().mockReturnValue(mockRedisClient),
      isAvailable: vi.fn().mockReturnValue(true),
    };

    storage = new RedisThrottlerStorageService(
      mockRedisService as unknown as RedisService,
    );
  });

  it('should fall back to in-memory storage when Redis is not available', async () => {
    mockRedisService.isAvailable.mockReturnValue(false);
    mockRedisService.getClient.mockReturnValue(null);

    const record = await storage.increment('test-ip', 60000, 5, 0, 'default');
    expect(record.totalHits).toBe(1);
    expect(record.isBlocked).toBe(false);
  });

  it('should increment hits in Redis and set TTL on new key', async () => {
    mockRedisClient.pttl.mockResolvedValueOnce(-2); // blocked key does not exist
    mockRedisClient.incr.mockResolvedValueOnce(1); // first hit
    mockRedisClient.pttl.mockResolvedValueOnce(-1); // hit key needs TTL
    mockRedisClient.pexpire.mockResolvedValueOnce(1);

    const record = await storage.increment('test-ip', 60000, 5, 0, 'default');

    expect(mockRedisClient.incr).toHaveBeenCalledWith(
      'kuizu:throttle:default:test-ip:hits',
    );
    expect(mockRedisClient.pexpire).toHaveBeenCalledWith(
      'kuizu:throttle:default:test-ip:hits',
      60000,
    );
    expect(record.totalHits).toBe(1);
    expect(record.isBlocked).toBe(false);
  });

  it('should block requests and set block key when limit is exceeded with blockDuration', async () => {
    mockRedisClient.pttl.mockResolvedValueOnce(-2); // not yet blocked
    mockRedisClient.incr.mockResolvedValueOnce(6); // 6th hit, exceeds limit 5
    mockRedisClient.pttl.mockResolvedValueOnce(45000); // 45s left
    mockRedisClient.set.mockResolvedValueOnce('OK');

    const record = await storage.increment(
      'test-ip',
      60000,
      5,
      30000,
      'default',
    );

    expect(record.totalHits).toBe(6);
    expect(record.isBlocked).toBe(true);
    expect(record.timeToBlockExpire).toBe(30);
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'kuizu:throttle:default:test-ip:blocked',
      '1',
      'PX',
      30000,
    );
  });

  it('should return blocked record immediately if already blocked', async () => {
    mockRedisClient.pttl.mockResolvedValueOnce(25000); // 25s left on block key

    const record = await storage.increment(
      'test-ip',
      60000,
      5,
      30000,
      'default',
    );

    expect(record.isBlocked).toBe(true);
    expect(record.timeToBlockExpire).toBe(25);
    expect(mockRedisClient.incr).not.toHaveBeenCalled();
  });
});
