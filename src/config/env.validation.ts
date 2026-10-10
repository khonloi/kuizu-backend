import { z } from 'zod';

const INSECURE_DEFAULT_ACCESS_SECRET = 'kuizu_super_secret_access_key_2026';
const INSECURE_DEFAULT_REFRESH_SECRET = 'kuizu_super_secret_refresh_key_2026';

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().default(4000),
    CLIENT_URL: z.string().default('http://localhost:3001'),
    CORS_ALLOWED_ORIGINS: z
      .string()
      .optional()
      .describe('Comma-separated list of allowed CORS origins'),
    MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/kuizu'),
    JWT_ACCESS_SECRET: z
      .string()
      .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters')
      .default(INSECURE_DEFAULT_ACCESS_SECRET),
    JWT_REFRESH_SECRET: z
      .string()
      .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters')
      .default(INSECURE_DEFAULT_REFRESH_SECRET),
    JWT_ACCESS_EXPIRATION: z.string().default('15m'),
    JWT_REFRESH_EXPIRATION: z.string().default('7d'),
    REDIS_URI: z
      .string()
      .optional()
      .describe('Redis connection string for scaling & cache'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      const isDefaultAccess =
        !data.JWT_ACCESS_SECRET ||
        data.JWT_ACCESS_SECRET === INSECURE_DEFAULT_ACCESS_SECRET ||
        data.JWT_ACCESS_SECRET === `${INSECURE_DEFAULT_ACCESS_SECRET}_dev` ||
        data.JWT_ACCESS_SECRET.includes('your_jwt_access_secret');

      if (isDefaultAccess) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_ACCESS_SECRET'],
          message:
            'JWT_ACCESS_SECRET must be explicitly set to a secure, unique production secret (min 32 characters in production).',
        });
      } else if (data.JWT_ACCESS_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_ACCESS_SECRET'],
          message:
            'JWT_ACCESS_SECRET should be at least 32 characters long in production.',
        });
      }

      const isDefaultRefresh =
        !data.JWT_REFRESH_SECRET ||
        data.JWT_REFRESH_SECRET === INSECURE_DEFAULT_REFRESH_SECRET ||
        data.JWT_REFRESH_SECRET === `${INSECURE_DEFAULT_REFRESH_SECRET}_dev` ||
        data.JWT_REFRESH_SECRET.includes('your_jwt_refresh_secret');

      if (isDefaultRefresh) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_REFRESH_SECRET'],
          message:
            'JWT_REFRESH_SECRET must be explicitly set to a secure, unique production secret (min 32 characters in production).',
        });
      } else if (data.JWT_REFRESH_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_REFRESH_SECRET'],
          message:
            'JWT_REFRESH_SECRET should be at least 32 characters long in production.',
        });
      }

      if (
        data.MONGODB_URI.includes('127.0.0.1') ||
        data.MONGODB_URI.includes('localhost')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MONGODB_URI'],
          message: 'MONGODB_URI cannot point to localhost in production mode.',
        });
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const errorDetails = parsed.error.format();
    throw new Error(
      `Config validation error: ${JSON.stringify(errorDetails, null, 2)}`,
    );
  }
  return parsed.data;
}
