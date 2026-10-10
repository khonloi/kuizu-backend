import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private readonly redisLogger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  async connectToRedis(redisUri: string): Promise<boolean> {
    try {
      const pubClient = new Redis(redisUri, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) {
            this.redisLogger.warn(
              'Redis IoAdapter retry limit reached. Disabling Redis adapter.',
            );
            return null;
          }
          return Math.min(times * 500, 2000);
        },
      });
      const subClient = pubClient.duplicate();

      pubClient.on('error', (err) => {
        this.redisLogger.error(`Redis pub client error: ${err.message}`);
      });
      subClient.on('error', (err) => {
        this.redisLogger.error(`Redis sub client error: ${err.message}`);
      });

      await Promise.all([pubClient.connect(), subClient.connect()]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.redisLogger.log(
        'Redis WebSocket adapter successfully connected and initialized.',
      );
      return true;
    } catch (err: any) {
      this.redisLogger.warn(
        `Failed to connect RedisIoAdapter (${err?.message || err}). Falling back to default in-memory WebSocket adapter.`,
      );
      this.adapterConstructor = null;
      return false;
    }
  }

  override createIOServer(port: number, options?: any): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
