import { z } from 'zod';

const INSECURE_DEFAULT_ACCESS_SECRET = 'kuizu_super_secret_access_key_2026';
const INSECURE_DEFAULT_REFRESH_SECRET = 'kuizu_super_secret_refresh_key_2026';
const TEST_DEFAULT_ACCESS_SECRET = 'kuizu_test_access_secret_123456';
const TEST_DEFAULT_REFRESH_SECRET = 'kuizu_test_refresh_secret_123456';

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
    TRUST_PROXY: z
      .union([z.boolean(), z.number(), z.string()])
      .default(1)
      .describe('Express trust proxy setting'),
    JWT_ACCESS_SECRET: z
      .string()
      .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters')
      .optional(),
    JWT_REFRESH_SECRET: z
      .string()
      .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters')
      .optional(),
    JWT_ACCESS_EXPIRATION: z.string().default('15m'),
    JWT_REFRESH_EXPIRATION: z.string().default('7d'),
    REDIS_URI: z
      .string()
      .optional()
      .describe('Redis connection string for scaling & cache'),
    EXPOSE_DEV_TOKENS: z
      .enum(['true', 'false'])
      .optional()
      .default('false')
      .describe(
        'Expose raw verification/reset tokens in responses for local development',
      ),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'test') {
      if (!data.JWT_ACCESS_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_ACCESS_SECRET'],
          message:
            'JWT_ACCESS_SECRET is required and must be explicitly configured.',
        });
      }
      if (!data.JWT_REFRESH_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_REFRESH_SECRET'],
          message:
            'JWT_REFRESH_SECRET is required and must be explicitly configured.',
        });
      }
    }

    if (data.NODE_ENV === 'production') {
      if (data.EXPOSE_DEV_TOKENS === 'true') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EXPOSE_DEV_TOKENS'],
          message: 'EXPOSE_DEV_TOKENS cannot be true in production mode.',
        });
      }

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
      } else if (data.JWT_ACCESS_SECRET && data.JWT_ACCESS_SECRET.length < 32) {
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
      } else if (
        data.JWT_REFRESH_SECRET &&
        data.JWT_REFRESH_SECRET.length < 32
      ) {
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

export type EnvConfig = z.infer<typeof envSchema> & {
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
};

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const errorDetails = parsed.error.format();
    throw new Error(
      `Config validation error: ${JSON.stringify(errorDetails, null, 2)}`,
    );
  }

  const data = parsed.data;
  if (data.NODE_ENV === 'test') {
    data.JWT_ACCESS_SECRET =
      data.JWT_ACCESS_SECRET || TEST_DEFAULT_ACCESS_SECRET;
    data.JWT_REFRESH_SECRET =
      data.JWT_REFRESH_SECRET || TEST_DEFAULT_REFRESH_SECRET;
  }

  return data as EnvConfig;
}
