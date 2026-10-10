import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule, CacheModuleOptions } from '@nestjs/cache-manager';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import KeyvRedis from '@keyv/redis';
import { Keyv } from 'keyv';

import { validateEnv } from './config/env.validation';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { RedisModule } from './common/redis/redis.module';
import { RedisService } from './common/redis/redis.service';
import { RedisThrottlerStorageService } from './common/throttler/redis-throttler-storage.service';

import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { CoursesModule } from './modules/courses/courses.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { GamesModule } from './modules/games/games.module';
import { DatabaseModule } from './database/database.module';
import { JobsModule } from './modules/jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction =
          configService.get<string>('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.currentPassword',
                'req.body.newPassword',
              ],
              censor: '[REDACTED]',
            },
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
                    ignore: 'pid,hostname',
                  },
                },
            autoLogging: true,
            genReqId: (req, res) => {
              const existing =
                req.headers['x-request-id'] || req.headers['x-correlation-id'];
              const id =
                (Array.isArray(existing) ? existing[0] : existing) ||
                randomUUID();
              req.headers['x-request-id'] = id;
              req.headers['x-correlation-id'] = id;
              res.setHeader('X-Request-Id', id);
              res.setHeader('X-Correlation-Id', id);
              return id;
            },
          },
        };
      },
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ||
          'mongodb://127.0.0.1:27017/kuizu',
      }),
    }),
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redisService: RedisService) => ({
        throttlers: [
          {
            ttl: 60000,
            limit: 120,
          },
        ],
        storage: new RedisThrottlerStorageService(redisService),
      }),
    }),
    CacheModule.registerAsync<CacheModuleOptions>({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): CacheModuleOptions => {
        const redisUri = configService.get<string>('REDIS_URI');
        if (redisUri) {
          try {
            const keyv = new Keyv({
              store: new KeyvRedis(redisUri),
              namespace: 'kuizu:cache',
            });
            return {
              stores: [keyv],
              ttl: 30000,
            };
          } catch {
            return { ttl: 30000 };
          }
        }
        return {
          ttl: 30000,
        };
      },
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    GamificationModule,
    CoursesModule,
    QuizzesModule,
    GamesModule,
    DatabaseModule,
    JobsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
