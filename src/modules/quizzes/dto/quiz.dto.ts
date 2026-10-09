import { z } from 'zod';
import {
  quizChoiceSchema,
  createQuestionSchema,
  QuizChoiceDto,
  CreateQuestionDto,
} from './question.dto';

export {
  quizChoiceSchema,
  createQuestionSchema,
  createQuestionSchema as quizQuestionSchema,
  QuizChoiceDto,
  CreateQuestionDto,
  CreateQuestionDto as QuizQuestionDto,
};

export const createQuizSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().max(500).optional().default(''),
  coverImage: z.string().optional().default(''),
  isPublic: z.boolean().optional().default(true),
  questionIds: z.array(z.string()).optional().default([]),
  questions: z.array(z.union([z.string(), createQuestionSchema])).optional(),
});

export const updateQuizSchema = createQuizSchema.partial();

export type CreateQuizDto = z.input<typeof createQuizSchema>;
export type UpdateQuizDto = z.input<typeof updateQuizSchema>;
