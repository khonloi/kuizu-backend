import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  QuizChoice,
  QuizChoiceSchema,
  Question,
  QuestionSchema,
} from './question.schema';

export {
  QuizChoice,
  QuizChoiceSchema,
  Question,
  QuestionSchema,
  Question as QuizQuestion,
  QuestionSchema as QuizQuestionSchema,
};

export type QuizDocument = Quiz & Document;

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

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Question' }], default: [] })
  questions: Question[];
}

export const QuizSchema = SchemaFactory.createForClass(Quiz);
QuizSchema.index({ author: 1 });
QuizSchema.index({ isPublic: 1 });
