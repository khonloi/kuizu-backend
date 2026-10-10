import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GamesGateway } from './games.gateway';
import { GamesService } from './games.service';
import { GameStateStore } from './game-state.store';
import { QuizzesModule } from '../quizzes/quizzes.module';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { GameSession, GameSessionSchema } from './schemas/game-session.schema';
import { GameSessionRepository } from './repositories';

@Module({
  imports: [
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
    GameStateStore,
    GameSessionRepository,
  ],
  exports: [GamesGateway, GamesService, GameStateStore, GameSessionRepository],
})
export class GamesModule {}
