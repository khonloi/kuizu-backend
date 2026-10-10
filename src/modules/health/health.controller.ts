import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { RedisHealthIndicator } from './redis.health';

@ApiTags('Health')
@Controller({ path: 'health', version: [VERSION_NEUTRAL, '1'] })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongooseHealth: MongooseHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Check API and Database Health (Legacy Summary)' })
  @ApiResponse({ status: 200, description: 'Health check response' })
  check() {
    const mongoStatusMap: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    const mongoState = this.connection?.readyState ?? 0;
    const isMongoOk = mongoState === 1;

    return {
      status: isMongoOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: {
          status: isMongoOk
            ? 'connected'
            : mongoStatusMap[mongoState] || 'unknown',
          readyState: mongoState,
        },
        api: {
          status: 'online',
          nodeVersion: process.version,
        },
      },
    };
  }

  @Public()
  @Get('liveness')
  @HealthCheck()
  @ApiOperation({ summary: 'Kubernetes Liveness Probe' })
  @ApiResponse({ status: 200, description: 'Liveness probe passed' })
  checkLiveness() {
    return this.health.check([
      () => ({
        process: {
          status: 'up',
          uptime: process.uptime(),
          pid: process.pid,
        },
      }),
    ]);
  }

  @Public()
  @Get('readiness')
  @HealthCheck()
  @ApiOperation({ summary: 'Kubernetes Readiness Probe (Database & Redis)' })
  @ApiResponse({
    status: 200,
    description: 'Readiness probe passed - all dependencies ready',
  })
  checkReadiness() {
    return this.health.check([
      () =>
        this.mongooseHealth.pingCheck('mongodb', {
          connection: this.connection,
        }),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }
}
