import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ _id: false })
export class StreakInfo {
  @Prop({ default: 0 })
  count: number;

  @Prop({ type: Date, default: null })
  lastActiveDate: Date | null;
}

export const StreakInfoSchema = SchemaFactory.createForClass(StreakInfo);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ default: 'user', enum: ['user', 'admin', 'teacher'] })
  role: string;

  @Prop({ default: '' })
  avatarUrl: string;

  @Prop({ default: 0 })
  xp: number;

  @Prop({ type: StreakInfoSchema, default: () => ({ count: 0, lastActiveDate: null }) })
  streak: StreakInfo;

  @Prop({ default: 5, min: 0, max: 5 })
  hearts: number;

  @Prop({ default: 100 })
  gems: number;

  @Prop({ default: 'bronze', enum: ['bronze', 'silver', 'gold', 'sapphire', 'ruby', 'diamond'] })
  league: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ xp: -1 });
