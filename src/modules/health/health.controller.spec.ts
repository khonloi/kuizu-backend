import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthController } from './health.controller';
import { HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health';
import { Connection } from 'mongoose';

describe('HealthController', () => {
  let controller: HealthController;
  let mockHealthCheckService: Partial<HealthCheckService>;
  let mockMongooseHealth: Partial<MongooseHealthIndicator>;
  let mockRedisHealth: Partial<RedisHealthIndicator>;
  let mockConnection: Partial<Connection>;

  beforeEach(() => {
    mockHealthCheckService = {
      check: vi.fn().mockImplementation((indicators) => {
        return Promise.all(indicators.map((fn: () => any) => fn())).then(
          (results) => ({
            status: 'ok',
            info: Object.assign({}, ...results),
            error: {},
            details: Object.assign({}, ...results),
          }),
        );
      }),
    };

    mockMongooseHealth = {
      pingCheck: vi.fn().mockResolvedValue({
        mongodb: { status: 'up' },
      }),
    };

    mockRedisHealth = {
      isHealthy: vi.fn().mockResolvedValue({
        redis: { status: 'up', mode: 'redis-connected' },
      }),
    };

    mockConnection = {
      readyState: 1 as any,
    };

    controller = new HealthController(
      mockHealthCheckService as HealthCheckService,
      mockMongooseHealth as MongooseHealthIndicator,
      mockRedisHealth as RedisHealthIndicator,
      mockConnection as Connection,
    );
  });

  describe('check (legacy summary)', () => {
    it('should return ok when MongoDB is connected (readyState = 1)', () => {
      mockConnection.readyState = 1 as any;
      const res = controller.check();

      expect(res.status).toBe('ok');
      expect(res.services.database.status).toBe('connected');
      expect(res.services.database.readyState).toBe(1);
      expect(res.services.api.status).toBe('online');
      expect(res).toHaveProperty('timestamp');
      expect(res).toHaveProperty('uptime');
    });

    it('should return degraded when MongoDB is disconnected (readyState = 0)', () => {
      mockConnection.readyState = 0 as any;
      const res = controller.check();

      expect(res.status).toBe('degraded');
      expect(res.services.database.status).toBe('disconnected');
      expect(res.services.database.readyState).toBe(0);
    });
  });

  describe('checkLiveness', async () => {
    it('should execute liveness probe and return process status', async () => {
      const res = await controller.checkLiveness();

      expect(mockHealthCheckService.check).toHaveBeenCalled();
      expect(res.status).toBe('ok');
      expect(res.details).toHaveProperty('process');
      expect(res.details.process.status).toBe('up');
      expect(res.details.process).toHaveProperty('uptime');
      expect(res.details.process).toHaveProperty('pid');
    });
  });

  describe('checkReadiness', async () => {
    it('should execute readiness probe verifying mongodb and redis', async () => {
      const res = await controller.checkReadiness();

      expect(mockHealthCheckService.check).toHaveBeenCalled();
      expect(mockMongooseHealth.pingCheck).toHaveBeenCalledWith('mongodb', {
        connection: mockConnection,
      });
      expect(mockRedisHealth.isHealthy).toHaveBeenCalledWith('redis');
      expect(res.status).toBe('ok');
      expect(res.details.mongodb.status).toBe('up');
      expect(res.details.redis.status).toBe('up');
    });
  });
});
