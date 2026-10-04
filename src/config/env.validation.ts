import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().default('http://localhost:3001'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/kuizu'),
  JWT_ACCESS_SECRET: z.string().default('kuizu_super_secret_access_key_2026'),
  JWT_REFRESH_SECRET: z.string().default('kuizu_super_secret_refresh_key_2026'),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const errorDetails = parsed.error.format();
    throw new Error(`Config validation error: ${JSON.stringify(errorDetails)}`);
  }
  return parsed.data;
}
