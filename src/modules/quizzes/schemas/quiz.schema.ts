import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuizDocument = Quiz & Document;

@Schema({ _id: false })
export class QuizChoice {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  text: string;

  @Prop({ default: false })
  isCorrect: boolean;

  @Prop({ default: 'red', enum: ['red', 'blue', 'yellow', 'green'] })
  color: string;
}

export const QuizChoiceSchema = SchemaFactory.createForClass(QuizChoice);

@Schema({ _id: false })
export class QuizQuestion {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  questionText: string;

  @Prop({ default: 'multiple-choice', enum: ['multiple-choice', 'true-false'] })
  type: string;

  @Prop({ default: 20 })
  timeLimit: number; // in seconds

  @Prop({ default: 1000 })
  points: number;

  @Prop({ default: '' })
  mediaUrl: string;

  @Prop({ type: [QuizChoiceSchema], default: [] })
  choices: QuizChoice[];
}

export const QuizQuestionSchema = SchemaFactory.createForClass(QuizQuestion);

@Schema({ timestamps: true })
export class Quiz {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  coverImage: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId;

  @Prop({ default: true })
  isPublic: boolean;

  @Prop({ default: 0 })
  playCount: number;

  @Prop({ type: [QuizQuestionSchema], default: [] })
  questions: QuizQuestion[];
}

export const QuizSchema = SchemaFactory.createForClass(Quiz);
