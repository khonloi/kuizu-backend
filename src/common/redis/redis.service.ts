import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

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
          if (times > 3) {
            this.logger.warn(
              'Redis reconnection failed after 3 attempts. Disabling Redis.',
            );
            return null;
          }
          return Math.min(times * 500, 2000);
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

  async onApplicationShutdown(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        this.logger.log('Closed Redis client connection.');
      } catch (err: any) {
        this.logger.warn(`Error closing Redis client: ${err?.message || err}`);
      }
    }
  }
}
