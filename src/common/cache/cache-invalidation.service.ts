import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { RedisService } from '../redis/redis.service';

export enum CacheNamespace {
  QUIZZES = 'quizzes',
  COURSES = 'courses',
  USERS = 'users',
  LEADERBOARD = 'leaderboard',
}

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(
    @Optional() private readonly redisService?: RedisService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cacheManager?: Cache,
  ) {}

  /**
   * Invalidate cache for a specific namespace or domain entity.
   * If Redis is configured, uses non-blocking SCAN pattern matching to delete keys.
   * If running in in-memory fallback mode, flushes the in-memory cache store.
   */
  async invalidate(namespace: CacheNamespace | string): Promise<void> {
    const pattern = `*${namespace}*`;
    await this.invalidatePattern(pattern);
  }

  /**
   * Invalidate multiple cache namespaces in parallel.
   */
  async invalidateMany(namespaces: (CacheNamespace | string)[]): Promise<void> {
    await Promise.all(namespaces.map((ns) => this.invalidate(ns)));
  }

  /**
   * Invalidate cache keys matching a custom glob pattern (e.g. 'leaderboard:*').
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      if (this.redisService) {
        const deleted = await this.redisService.delPattern(pattern);
        this.logger.debug(
          `Invalidated cache pattern '${pattern}', deleted ${deleted} keys`,
        );
      } else if (this.cacheManager) {
        await this.cacheManager.clear();
        this.logger.debug(
          `Cleared in-memory cache fallback for pattern '${pattern}'`,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to invalidate cache pattern '${pattern}': ${err?.message || err}`,
      );
    }
  }

  /**
   * Clear the entire cache store regardless of namespace.
   */
  async clearAll(): Promise<void> {
    try {
      if (this.redisService) {
        await this.redisService.delPattern('*');
      }
      if (this.cacheManager) {
        await this.cacheManager.clear();
      }
    } catch (err: any) {
      this.logger.warn(`Failed to clear cache: ${err?.message || err}`);
    }
  }
}
