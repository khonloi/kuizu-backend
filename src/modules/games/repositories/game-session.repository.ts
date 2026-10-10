import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../../common/database';
import {
  GameSession,
  GameSessionDocument,
} from '../schemas/game-session.schema';

@Injectable()
export class GameSessionRepository extends BaseRepository<GameSessionDocument> {
  constructor(
    @InjectModel(GameSession.name)
    gameSessionModel: Model<GameSessionDocument>,
  ) {
    super(gameSessionModel);
  }
}
