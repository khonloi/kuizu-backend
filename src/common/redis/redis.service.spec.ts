import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

const { MockRedis } = vi.hoisted(() => {
  class MockRedis {
    handlers: Record<string, Function> = {};
    on(event: string, cb: Function) {
      this.handlers[event] = cb;
      return this;
    }
    async connect() {
      if (this.handlers['connect']) {
        this.handlers['connect']();
      }
    }
    async ping() {
      return 'PONG';
    }
    async quit() {
      return 'OK';
    }
    duplicate() {
      return this;
    }
  }
  return { MockRedis };
});

vi.mock('ioredis', () => ({
  default: MockRedis,
}));

describe('RedisService', () => {
  let service: RedisService;
  let mockConfigService: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn(),
    };
  });

  it('should operate in in-memory fallback mode when REDIS_URI is not set', async () => {
    mockConfigService.get.mockReturnValue(undefined);
    service = new RedisService(mockConfigService as unknown as ConfigService);

    await service.onModuleInit();

    expect(service.isAvailable()).toBe(false);
    expect(service.getClient()).toBeNull();
    const isAlive = await service.ping();
    expect(isAlive).toBe(false);
  });

  it('should connect to Redis when REDIS_URI is configured', async () => {
    mockConfigService.get.mockReturnValue('redis://localhost:6379');
    service = new RedisService(mockConfigService as unknown as ConfigService);

    await service.onModuleInit();

    expect(service.isAvailable()).toBe(true);
    expect(service.getClient()).not.toBeNull();
    const isAlive = await service.ping();
    expect(isAlive).toBe(true);

    await service.onApplicationShutdown();
  });
});
