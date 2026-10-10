import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CourseDocument = Course & Document;

@Schema({ _id: false })
export class Exercise {
  @Prop({ required: true })
  id: string;

  @Prop({
    required: true,
    enum: [
      'multiple-choice',
      'translate',
      'match-pairs',
      'fill-blank',
      'listen',
    ],
    default: 'multiple-choice',
  })
  type: string;

  @Prop({ required: true })
  prompt: string;

  @Prop({ type: [String], default: [] })
  options: string[];

  @Prop({ required: true })
  answer: string;

  @Prop({ default: '' })
  hint: string;
}

export const ExerciseSchema = SchemaFactory.createForClass(Exercise);

@Schema({ _id: false })
export class Lesson {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: 'star' })
  icon: string;

  @Prop({ default: 1 })
  order: number;

  @Prop({ default: 15 })
  xpReward: number;

  @Prop({ type: [ExerciseSchema], default: [] })
  exercises: Exercise[];
}

export const LessonSchema = SchemaFactory.createForClass(Lesson);

@Schema({ _id: false })
export class Unit {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '#58cc02' })
  color: string;

  @Prop({ default: 1 })
  order: number;

  @Prop({ type: [LessonSchema], default: [] })
  lessons: Lesson[];
}

export const UnitSchema = SchemaFactory.createForClass(Unit);

@Schema({ timestamps: true })
export class Course {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 'globe' })
  icon: string;

  @Prop({ default: true })
  isPublished: boolean;

  @Prop({ type: [UnitSchema], default: [] })
  units: Unit[];
}

export const CourseSchema = SchemaFactory.createForClass(Course);
CourseSchema.index({ isPublished: 1, createdAt: -1 });
CourseSchema.index({ isPublished: 1, _id: -1 });
CourseSchema.index({ title: 'text', description: 'text' });
