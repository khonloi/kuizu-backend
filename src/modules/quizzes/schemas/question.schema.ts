import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuestionDocument = Question & Document;

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

@Schema({ timestamps: true })
export class Question {
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

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: 'medium', enum: ['easy', 'medium', 'hard'] })
  difficulty: string;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
QuestionSchema.index({ author: 1 });
QuestionSchema.index({ tags: 1 });
