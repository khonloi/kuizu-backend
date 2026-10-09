import { z } from 'zod';

export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(24, 'Username cannot exceed 24 characters')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username can only contain letters, numbers, and underscores',
    )
    .optional(),
  avatarUrl: z
    .string()
    .max(500, 'Avatar URL cannot exceed 500 characters')
    .optional(),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

export const adminQueryUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(['user', 'teacher', 'admin']).optional(),
  isActive: z.coerce.boolean().optional(),
});

export type AdminQueryUsersDto = z.infer<typeof adminQueryUsersSchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(['user', 'teacher', 'admin'], {
    message: 'Role must be user, teacher, or admin',
  }),
});

export type UpdateUserRoleDto = z.infer<typeof updateUserRoleSchema>;

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export type UpdateUserStatusDto = z.infer<typeof updateUserStatusSchema>;
