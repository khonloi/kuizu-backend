import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RedisThrottlerStorageService implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorageService.name);
  private readonly inMemoryFallback = new ThrottlerStorageService();

  constructor(private readonly redisService: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redis = this.redisService.getClient();

    if (!redis || !this.redisService.isAvailable()) {
      return this.inMemoryFallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }

    try {
      const hitKey = `kuizu:throttle:${throttlerName}:${key}:hits`;
      const blockKey = `kuizu:throttle:${throttlerName}:${key}:blocked`;

      // Check if blocked
      const blockedTtlMs = await redis.pttl(blockKey);
      if (blockedTtlMs > 0) {
        const timeToBlockExpire = Math.ceil(blockedTtlMs / 1000);
        return {
          totalHits: limit + 1,
          timeToExpire: timeToBlockExpire,
          isBlocked: true,
          timeToBlockExpire,
        };
      }

      // Increment hits
      const totalHits = await redis.incr(hitKey);
      let pttl = await redis.pttl(hitKey);

      // If key had no TTL (newly created or lost), set it
      if (pttl < 0) {
        await redis.pexpire(hitKey, ttl);
        pttl = ttl;
      }

      const timeToExpire = Math.max(0, Math.ceil(pttl / 1000));
      const isBlocked = totalHits > limit;

      let timeToBlockExpire = 0;
      if (isBlocked && blockDuration > 0) {
        await redis.set(blockKey, '1', 'PX', blockDuration);
        timeToBlockExpire = Math.ceil(blockDuration / 1000);
      }

      return {
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire,
      };
    } catch (err: any) {
      this.logger.warn(
        `Redis error during throttling (${err?.message || err}). Falling back to in-memory.`,
      );
      return this.inMemoryFallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
  }
}
