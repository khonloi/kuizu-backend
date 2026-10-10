import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisIoAdapter } from './redis-io.adapter';

const { MockRedis } = vi.hoisted(() => {
  class MockRedis {
    handlers: Record<string, Function> = {};
    on(event: string, cb: Function) {
      this.handlers[event] = cb;
      return this;
    }
    async connect() {
      return;
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

vi.mock('@socket.io/redis-adapter', () => ({
  createAdapter: vi.fn().mockReturnValue('mock-redis-adapter-constructor'),
}));

describe('RedisIoAdapter', () => {
  let adapter: RedisIoAdapter;
  let mockApp: any;

  beforeEach(() => {
    mockApp = {
      getHttpServer: vi.fn().mockReturnValue({}),
    };
    adapter = new RedisIoAdapter(mockApp);
  });

  it('should successfully connect to Redis and initialize adapterConstructor', async () => {
    const success = await adapter.connectToRedis('redis://localhost:6379');
    expect(success).toBe(true);

    const mockServer = {
      adapter: vi.fn(),
    };
    const superCreateSpy = vi
      .spyOn(Object.getPrototypeOf(RedisIoAdapter.prototype), 'createIOServer')
      .mockReturnValue(mockServer);

    adapter.createIOServer(4000);
    expect(mockServer.adapter).toHaveBeenCalledWith(
      'mock-redis-adapter-constructor',
    );
    superCreateSpy.mockRestore();
  });
});
