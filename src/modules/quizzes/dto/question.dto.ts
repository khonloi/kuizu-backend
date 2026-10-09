import { z } from 'zod';

export const quizChoiceSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  text: z.string().min(1, 'Choice text is required'),
  isCorrect: z.boolean().default(false),
  color: z.enum(['red', 'blue', 'yellow', 'green']).default('red'),
});

export const createQuestionSchema = z.object({
  questionText: z.string().min(1, 'Question text is required'),
  type: z.enum(['multiple-choice', 'true-false']).default('multiple-choice'),
  timeLimit: z.number().min(5).max(120).default(20),
  points: z.number().min(0).max(2000).default(1000),
  mediaUrl: z.string().optional().default(''),
  choices: z.array(quizChoiceSchema).min(2, 'At least 2 choices required'),
  tags: z.array(z.string()).optional().default([]),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
});

export const updateQuestionSchema = createQuestionSchema.partial();

export type CreateQuestionDto = z.input<typeof createQuestionSchema>;
export type UpdateQuestionDto = z.input<typeof updateQuestionSchema>;
export type QuizChoiceDto = z.input<typeof quizChoiceSchema>;
