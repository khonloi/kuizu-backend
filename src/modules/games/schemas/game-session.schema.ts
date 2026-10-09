import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GameSessionDocument = GameSession & Document;

@Schema({ _id: false })
export class PlayerResult {
  @Prop({ required: true })
  nickname: string;

  @Prop({ default: 0 })
  score: number;

  @Prop({ default: 1 })
  rank: number;
}

export const PlayerResultSchema = SchemaFactory.createForClass(PlayerResult);

@Schema({ timestamps: true })
export class GameSession {
  @Prop({ required: true })
  pin: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  host: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Quiz', required: true })
  quiz: Types.ObjectId;

  @Prop({ required: true })
  quizTitle: string;

  @Prop({ type: [PlayerResultSchema], default: [] })
  players: PlayerResult[];

  @Prop({
    default: 'completed',
    enum: ['lobby', 'in-progress', 'completed', 'cancelled'],
  })
  status: string;
}

export const GameSessionSchema = SchemaFactory.createForClass(GameSession);
GameSessionSchema.index({ host: 1 });
GameSessionSchema.index({ quiz: 1 });
GameSessionSchema.index({ pin: 1 });
