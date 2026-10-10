import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GamesGateway } from './games.gateway';
import { GameStateStore } from './game-state.store';
import { QuizzesModule } from '../quizzes/quizzes.module';
import { AuthModule } from '../auth/auth.module';
import { GameSession, GameSessionSchema } from './schemas/game-session.schema';
import { GameSessionRepository } from './repositories';

@Module({
  imports: [
    QuizzesModule,
    AuthModule,
    MongooseModule.forFeature([
      { name: GameSession.name, schema: GameSessionSchema },
    ]),
  ],
  providers: [GamesGateway, GameStateStore, GameSessionRepository],
  exports: [GamesGateway, GameStateStore, GameSessionRepository],
})
export class GamesModule {}
