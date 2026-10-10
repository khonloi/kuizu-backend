import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly redisService: RedisService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key = 'redis'): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    const isAvailable = this.redisService.isAvailable();
    if (!isAvailable) {
      return indicator.up({ mode: 'in-memory-fallback' });
    }

    try {
      const isPingOk = await this.redisService.ping();
      if (!isPingOk) {
        return indicator.down({ message: 'Redis ping did not return PONG' });
      }

      return indicator.up({ mode: 'redis-connected' });
    } catch (err: any) {
      return indicator.down({ message: err?.message || 'Redis unreachable' });
    }
  }
}
