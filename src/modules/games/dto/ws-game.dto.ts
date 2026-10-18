import { z } from 'zod';

export const gamePinSchema = z
  .string()
  .regex(/^\d{6}$/, 'PIN must be a 6-digit number');

export const nicknameSchema = z
  .string()
  .trim()
  .min(1, 'Nickname cannot be empty')
  .max(30, 'Nickname cannot exceed 30 characters');

export const hostCreateSchema = z.object({
  quizId: z.string().min(1, 'Quiz ID is required'),
});

export const playerJoinSchema = z.object({
  pin: gamePinSchema,
  nickname: nicknameSchema,
});

export const playerReconnectSchema = playerJoinSchema;

export const playerAnswerSchema = z.object({
  pin: gamePinSchema,
  choiceId: z.string().min(1, 'Choice ID is required'),
});

export type HostCreateDto = z.infer<typeof hostCreateSchema>;
export type PlayerJoinDto = z.infer<typeof playerJoinSchema>;
export type PlayerReconnectDto = z.infer<typeof playerReconnectSchema>;
export type PlayerAnswerDto = z.infer<typeof playerAnswerSchema>;

export function parseWsPayload<T>(
  schema: z.ZodSchema<T>,
  rawData: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(rawData);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0]?.message || 'Invalid request payload',
    };
  }
  return { success: true, data: result.data };
}
