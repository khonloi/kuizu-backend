import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CacheInvalidationService,
  CacheNamespace,
} from './cache-invalidation.service';
import { RedisService } from '../redis/redis.service';
import { Cache } from '@nestjs/cache-manager';

describe('CacheInvalidationService', () => {
  let service: CacheInvalidationService;
  let mockRedisService: Partial<RedisService>;
  let mockCacheManager: Partial<Cache>;

  beforeEach(() => {
    mockRedisService = {
      delPattern: vi.fn().mockResolvedValue(5),
    };
    mockCacheManager = {
      clear: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('should invalidate using Redis pattern matching when RedisService is available', async () => {
    service = new CacheInvalidationService(
      mockRedisService as RedisService,
      mockCacheManager as Cache,
    );

    await service.invalidate(CacheNamespace.QUIZZES);

    expect(mockRedisService.delPattern).toHaveBeenCalledWith('*quizzes*');
    expect(mockCacheManager.clear).not.toHaveBeenCalled();
  });

  it('should fallback to cacheManager.clear() when RedisService is not provided', async () => {
    service = new CacheInvalidationService(
      undefined,
      mockCacheManager as Cache,
    );

    await service.invalidate(CacheNamespace.COURSES);

    expect(mockCacheManager.clear).toHaveBeenCalled();
  });

  it('should safely no-op without error when neither RedisService nor CacheManager is available', async () => {
    service = new CacheInvalidationService(undefined, undefined);

    await expect(
      service.invalidate(CacheNamespace.USERS),
    ).resolves.toBeUndefined();
  });

  it('should catch and log error without throwing when delPattern fails', async () => {
    mockRedisService.delPattern = vi
      .fn()
      .mockRejectedValue(new Error('Redis connection lost'));
    service = new CacheInvalidationService(
      mockRedisService as RedisService,
      mockCacheManager as Cache,
    );

    await expect(
      service.invalidate(CacheNamespace.QUIZZES),
    ).resolves.toBeUndefined();
  });

  it('should catch and log error without throwing when cacheManager.clear fails', async () => {
    mockCacheManager.clear = vi
      .fn()
      .mockRejectedValue(new Error('Memory store failed'));
    service = new CacheInvalidationService(
      undefined,
      mockCacheManager as Cache,
    );

    await expect(
      service.invalidate(CacheNamespace.COURSES),
    ).resolves.toBeUndefined();
  });

  it('should invalidate multiple namespaces via invalidateMany', async () => {
    service = new CacheInvalidationService(
      mockRedisService as RedisService,
      mockCacheManager as Cache,
    );

    await service.invalidateMany([
      CacheNamespace.QUIZZES,
      CacheNamespace.COURSES,
    ]);

    expect(mockRedisService.delPattern).toHaveBeenCalledWith('*quizzes*');
    expect(mockRedisService.delPattern).toHaveBeenCalledWith('*courses*');
  });

  it('should invalidate specific custom patterns via invalidatePattern', async () => {
    service = new CacheInvalidationService(
      mockRedisService as RedisService,
      mockCacheManager as Cache,
    );

    await service.invalidatePattern('leaderboard:*');

    expect(mockRedisService.delPattern).toHaveBeenCalledWith('leaderboard:*');
  });

  it('should clear all caches via clearAll', async () => {
    service = new CacheInvalidationService(
      mockRedisService as RedisService,
      mockCacheManager as Cache,
    );

    await service.clearAll();

    expect(mockRedisService.delPattern).toHaveBeenCalledWith('*');
    expect(mockCacheManager.clear).toHaveBeenCalled();
  });
});
