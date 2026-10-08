import { z } from 'zod';

export const exerciseSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  type: z
    .enum([
      'multiple-choice',
      'translate',
      'match-pairs',
      'fill-blank',
      'listen',
    ])
    .default('multiple-choice'),
  prompt: z.string().min(1, 'Exercise prompt is required'),
  options: z.array(z.string()).default([]),
  answer: z.string().min(1, 'Exercise answer is required'),
  hint: z.string().optional().default(''),
});

export const lessonSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  title: z.string().min(1, 'Lesson title is required'),
  icon: z.string().optional().default('star'),
  order: z.number().int().positive().optional().default(1),
  xpReward: z.number().int().min(0).optional().default(15),
  exercises: z.array(exerciseSchema).default([]),
});

export const unitSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  title: z.string().min(1, 'Unit title is required'),
  description: z.string().optional().default(''),
  color: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color')
    .optional()
    .default('#58cc02'),
  order: z.number().int().positive().optional().default(1),
  lessons: z.array(lessonSchema).default([]),
});

export const createCourseSchema = z.object({
  title: z.string().min(1, 'Course title is required').max(100),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100)
    .regex(
      /^[a-z0-9-]+$/,
      'Slug can only contain lowercase letters, numbers, and hyphens',
    ),
  description: z.string().max(1000).optional().default(''),
  icon: z.string().optional().default('globe'),
  isPublished: z.boolean().optional().default(true),
  units: z.array(unitSchema).default([]),
});

export const updateCourseSchema = createCourseSchema.partial();

export type ExerciseDto = z.input<typeof exerciseSchema>;
export type LessonDto = z.input<typeof lessonSchema>;
export type UnitDto = z.input<typeof unitSchema>;
export type CreateCourseDto = z.input<typeof createCourseSchema>;
export type UpdateCourseDto = z.input<typeof updateCourseSchema>;
