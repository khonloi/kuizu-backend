import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisModule } from '../../common/redis/redis.module';
import { UsersModule } from '../users/users.module';
import { QuizzesModule } from '../quizzes/quizzes.module';
import {
  GameSession,
  GameSessionSchema,
} from '../games/schemas/game-session.schema';
import { GameSessionRepository } from '../games/repositories';
import { JobsProducerService } from './jobs-producer.service';
import { EmailProcessor } from './processors/email.processor';
import { GameReportsProcessor } from './processors/game-reports.processor';
import { GamificationProcessor } from './processors/gamification.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUri = config.get<string>('REDIS_URI');
        if (redisUri) {
          try {
            const parsed = new URL(redisUri);
            return {
              connection: {
                host: parsed.hostname || '127.0.0.1',
                port: parseInt(parsed.port || '6379', 10),
                username: parsed.username || undefined,
                password: parsed.password || undefined,
                lazyConnect: true,
                maxRetriesPerRequest: null,
              },
            };
          } catch {
            return {
              connection: {
                url: redisUri,
                lazyConnect: true,
                maxRetriesPerRequest: null,
              },
            };
          }
        }

        // Local dev / test fallback when REDIS_URI is not configured
        return {
          connection: {
            host: '127.0.0.1',
            port: 6379,
            lazyConnect: true,
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
            retryStrategy: () => null,
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: 'email-queue' },
      { name: 'game-reports-queue' },
      { name: 'gamification-queue' },
    ),
    MongooseModule.forFeature([
      { name: GameSession.name, schema: GameSessionSchema },
    ]),
    RedisModule,
    UsersModule,
    QuizzesModule,
  ],
  providers: [
    GameSessionRepository,
    EmailProcessor,
    GameReportsProcessor,
    GamificationProcessor,
    JobsProducerService,
  ],
  exports: [JobsProducerService, BullModule],
})
export class JobsModule {}
