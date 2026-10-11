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

const httpUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .startsWith('http', 'Must use http or https')
  .max(500);

export const createQuizSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().max(500).optional().default(''),
  coverImage: z
    .union([z.literal(''), httpUrlSchema])
    .optional()
    .default(''),
  isPublic: z.boolean().optional().default(true),
  questionIds: z.array(z.string()).optional().default([]),
  questions: z.array(z.union([z.string(), createQuestionSchema])).optional(),
});

export const updateQuizSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(100).optional(),
  description: z.string().max(500).optional(),
  coverImage: z.union([z.literal(''), httpUrlSchema]).optional(),
  isPublic: z.boolean().optional(),
  questionIds: z.array(z.string()).optional(),
  questions: z.array(z.union([z.string(), createQuestionSchema])).optional(),
});

export type CreateQuizDto = z.input<typeof createQuizSchema>;
export type UpdateQuizDto = z.infer<typeof updateQuizSchema>;
