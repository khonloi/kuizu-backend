import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const httpUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .startsWith('http', 'Must use http or https')
  .max(500);

export const quizChoiceSchema = z.object({
  id: z.string().default(() => randomBytes(4).toString('hex')),
  text: z.string().min(1, 'Choice text is required'),
  isCorrect: z.boolean().default(false),
  color: z.enum(['red', 'blue', 'yellow', 'green']).default('red'),
});

export const createQuestionSchema = z.object({
  questionText: z.string().min(1, 'Question text is required'),
  type: z.enum(['multiple-choice', 'true-false']).default('multiple-choice'),
  timeLimit: z.number().min(5).max(120).default(20),
  points: z.number().min(0).max(2000).default(1000),
  mediaUrl: z
    .union([z.literal(''), httpUrlSchema])
    .optional()
    .default(''),
  choices: z.array(quizChoiceSchema).min(2, 'At least 2 choices required'),
  tags: z.array(z.string()).optional().default([]),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
});

export const updateQuestionSchema = z.object({
  questionText: z.string().min(1).optional(),
  type: z.enum(['multiple-choice', 'true-false']).optional(),
  timeLimit: z.number().min(5).max(120).optional(),
  points: z.number().min(0).max(2000).optional(),
  mediaUrl: z.union([z.literal(''), httpUrlSchema]).optional(),
  choices: z
    .array(quizChoiceSchema)
    .min(2, 'At least 2 choices required')
    .optional(),
  tags: z.array(z.string()).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

export type CreateQuestionDto = z.input<typeof createQuestionSchema>;
export type UpdateQuestionDto = z.infer<typeof updateQuestionSchema>;
export type QuizChoiceDto = z.input<typeof quizChoiceSchema>;
