import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Check API and Database Health' })
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
          status: isMongoOk ? 'connected' : mongoStatusMap[mongoState] || 'unknown',
          readyState: mongoState,
        },
        api: {
          status: 'online',
          nodeVersion: process.version,
        },
      },
    };
  }
}
