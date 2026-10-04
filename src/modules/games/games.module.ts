import { Module } from '@nestjs/common';
import { GamesGateway } from './games.gateway';
import { GameStateStore } from './game-state.store';
import { QuizzesModule } from '../quizzes/quizzes.module';

@Module({
  imports: [QuizzesModule],
  providers: [GamesGateway, GameStateStore],
  exports: [GamesGateway, GameStateStore],
})
export class GamesModule {}
