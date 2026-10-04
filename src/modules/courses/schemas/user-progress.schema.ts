import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserProgressDocument = UserProgress & Document;

@Schema({ timestamps: true })
export class UserProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  courseSlug: string;

  @Prop({ type: [String], default: [] })
  completedLessonIds: string[];

  @Prop({ default: 0 })
  totalXpEarned: number;

  @Prop({ default: 1 })
  currentUnit: number;
}

export const UserProgressSchema = SchemaFactory.createForClass(UserProgress);
UserProgressSchema.index({ user: 1, courseSlug: 1 }, { unique: true });
