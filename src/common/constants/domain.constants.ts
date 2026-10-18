export const AUTH_CONSTANTS = {
  BCRYPT_SALT_ROUNDS: 12,
  ACCESS_TOKEN_COOKIE: 'access_token',
  REFRESH_TOKEN_COOKIE: 'refresh_token',
  ACCESS_TOKEN_TTL_MS: 15 * 60 * 1000, // 15 minutes
  REFRESH_TOKEN_TTL_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  EMAIL_VERIFICATION_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
  PASSWORD_RESET_TTL_MS: 60 * 60 * 1000, // 1 hour
  AUTH_COOKIE_PATH: '/api/v1/auth',
} as const;

export const GAMIFICATION_CONSTANTS = {
  DEFAULT_HEARTS: 5,
  MAX_HEARTS: 5,
  HEART_REFILL_COST: 50,
  STREAK_FREEZE_COST: 100,
  MAX_STREAK_FREEZES: 2,
  MS_PER_DAY: 86_400_000,
  DEFAULT_LEADERBOARD_LIMIT: 20,
} satisfies Record<string, number>;

export const PAGINATION_CONSTANTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} satisfies Record<string, number>;
