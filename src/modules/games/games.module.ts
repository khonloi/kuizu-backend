import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GamesGateway } from './games.gateway';
import { GamesService } from './games.service';
import { GameStateStore } from './game-state.store';
import { RedisGameStateStore } from './redis-game-state.store';
import { RedisService } from '../../common/redis/redis.service';
import { QuizzesModule } from '../quizzes/quizzes.module';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { GameSession, GameSessionSchema } from './schemas/game-session.schema';
import { GameSessionRepository } from './repositories';

@Module({
  imports: [
    ConfigModule,
    QuizzesModule,
    AuthModule,
    JobsModule,
    MongooseModule.forFeature([
      { name: GameSession.name, schema: GameSessionSchema },
    ]),
  ],
  providers: [
    GamesGateway,
    GamesService,
    {
      provide: GameStateStore,
      useFactory: (
        configService: ConfigService,
        redisService: RedisService,
      ) => {
        const storeType = configService.get<string>('GAME_STATE_STORE');
        if (storeType === 'redis') {
          return new RedisGameStateStore(redisService);
        }
        return new GameStateStore();
      },
      inject: [ConfigService, RedisService],
    },
    GameSessionRepository,
  ],
  exports: [GamesGateway, GamesService, GameStateStore, GameSessionRepository],
})
export class GamesModule {}
