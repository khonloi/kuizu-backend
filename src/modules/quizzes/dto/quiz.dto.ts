import { z } from 'zod';

export const quizChoiceSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  text: z.string().min(1, 'Choice text is required'),
  isCorrect: z.boolean().default(false),
  color: z.enum(['red', 'blue', 'yellow', 'green']).default('red'),
});

export const quizQuestionSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  questionText: z.string().min(1, 'Question text is required'),
  type: z.enum(['multiple-choice', 'true-false']).default('multiple-choice'),
  timeLimit: z.number().min(5).max(120).default(20),
  points: z.number().min(0).max(2000).default(1000),
  mediaUrl: z.string().optional().default(''),
  choices: z.array(quizChoiceSchema).min(2, 'At least 2 choices required'),
});

export const createQuizSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().max(500).optional().default(''),
  coverImage: z.string().optional().default(''),
  isPublic: z.boolean().optional().default(true),
  questions: z.array(quizQuestionSchema).min(1, 'At least 1 question is required'),
});

export type CreateQuizDto = z.infer<typeof createQuizSchema>;
export type QuizQuestionDto = z.infer<typeof quizQuestionSchema>;
export type QuizChoiceDto = z.infer<typeof quizChoiceSchema>;
