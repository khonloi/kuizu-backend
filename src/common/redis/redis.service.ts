import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface MemoryCacheEntry {
  value: string;
  expiresAt?: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;
  private memoryStore = new Map<string, MemoryCacheEntry>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUri = this.configService.get<string>('REDIS_URI');
    if (!redisUri) {
      this.logger.log(
        'REDIS_URI not configured. Operating in in-memory fallback mode.',
      );
      return;
    }

    try {
      this.client = new Redis(redisUri, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 20) {
            this.logger.warn(
              'Redis reconnection failed after 20 attempts. Disabling Redis.',
            );
            return null;
          }
          return Math.min(times * 1000, 10000);
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Successfully connected to Redis');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.error(`Redis connection error: ${err.message}`);
      });

      await this.client.connect();
    } catch (err: any) {
      this.logger.warn(
        `Failed to initialize Redis connection (${err?.message || err}). Falling back to in-memory mode.`,
      );
      this.client = null;
      this.isConnected = false;
    }
  }

  getClient(): Redis | null {
    return this.isConnected ? this.client : null;
  }

  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  async ping(): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;
    try {
      const res = await this.client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  // --- Precision Key-Value & Pattern Caching API ---

  async get<T = unknown>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) {
      const entry = this.memoryStore.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt <= Date.now()) {
        this.memoryStore.delete(key);
        return null;
      }
      try {
        return JSON.parse(entry.value) as T;
      } catch {
        return entry.value as unknown as T;
      }
    }

    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err: any) {
      this.logger.warn(`Redis GET failed for key '${key}': ${err.message}`);
      return null;
    }
  }

  async set<T = unknown>(
    key: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<void> {
    const serialized = JSON.stringify(value);

    if (!this.client || !this.isConnected) {
      this.memoryStore.set(key, {
        value: serialized,
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
      });
      return;
    }

    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (err: any) {
      this.logger.warn(`Redis SET failed for key '${key}': ${err.message}`);
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return this.memoryStore.delete(key);
    }

    try {
      const count = await this.client.del(key);
      return count > 0;
    } catch (err: any) {
      this.logger.warn(`Redis DEL failed for key '${key}': ${err.message}`);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      const entry = this.memoryStore.get(key);
      if (!entry) return false;
      if (entry.expiresAt && entry.expiresAt <= Date.now()) {
        this.memoryStore.delete(key);
        return false;
      }
      return true;
    }

    try {
      const count = await this.client.exists(key);
      return count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Non-blocking pattern-based key deletion using Redis SCAN (batch size 100)
   * Prevents global cache flushes and cache stampedes.
   */
  async delPattern(pattern: string): Promise<number> {
    if (!this.client || !this.isConnected) {
      let count = 0;
      for (const key of Array.from(this.memoryStore.keys())) {
        if (this.matchGlob(key, pattern)) {
          this.memoryStore.delete(key);
          count++;
        }
      }
      return count;
    }

    let cursor = '0';
    let totalDeleted = 0;

    try {
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          const deleted = await this.client.del(...keys);
          totalDeleted += deleted;
        }
      } while (cursor !== '0');
    } catch (err: any) {
      this.logger.warn(
        `Redis delPattern failed for pattern '${pattern}': ${err.message}`,
      );
    }

    return totalDeleted;
  }

  /**
   * Distributed Lock primitive using Redis atomic SET NX PX
   */
  async acquireLock(key: string, ttlMs = 3000): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      const entry = this.memoryStore.get(key);
      if (entry && (!entry.expiresAt || entry.expiresAt > Date.now())) {
        return false;
      }
      this.memoryStore.set(key, {
        value: '1',
        expiresAt: Date.now() + ttlMs,
      });
      return true;
    }

    try {
      const res = await this.client.set(key, '1', 'PX', ttlMs, 'NX');
      return res === 'OK';
    } catch {
      return false;
    }
  }

  async releaseLock(key: string): Promise<void> {
    await this.del(key);
  }

  private matchGlob(str: string, pattern: string): boolean {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`).test(str);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        this.logger.log('Closed Redis client connection.');
      } catch (err: any) {
        this.logger.warn(`Error closing Redis client: ${err?.message || err}`);
      }
    }
    this.memoryStore.clear();
  }
}
