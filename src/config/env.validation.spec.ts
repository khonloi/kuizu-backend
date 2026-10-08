import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('should accept valid development configuration with default secrets', () => {
    const config = {
      NODE_ENV: 'development',
      PORT: '4000',
    };

    const validated = validateEnv(config);
    expect(validated.NODE_ENV).toBe('development');
    expect(validated.PORT).toBe(4000);
    expect(validated.CLIENT_URL).toBe('http://localhost:3001');
    expect(validated.JWT_ACCESS_SECRET).toBeDefined();
  });

  it('should allow optional CORS_ALLOWED_ORIGINS', () => {
    const config = {
      NODE_ENV: 'development',
      CORS_ALLOWED_ORIGINS: 'https://kuizu.app, https://admin.kuizu.app',
    };

    const validated = validateEnv(config);
    expect(validated.CORS_ALLOWED_ORIGINS).toBe('https://kuizu.app, https://admin.kuizu.app');
  });

  it('should reject production config when default insecure JWT secrets are used', () => {
    const config = {
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/kuizu',
      JWT_ACCESS_SECRET: 'kuizu_super_secret_access_key_2026',
      JWT_REFRESH_SECRET: 'kuizu_super_secret_refresh_key_2026',
    };

    expect(() => validateEnv(config)).toThrowError(/JWT_ACCESS_SECRET/);
  });

  it('should reject production config when JWT secret length is under 32 characters', () => {
    const config = {
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/kuizu',
      JWT_ACCESS_SECRET: 'short_custom_secret_1234567890',
      JWT_REFRESH_SECRET: 'short_custom_refresh_secret_123',
    };

    expect(() => validateEnv(config)).toThrowError(/at least 32 characters/);
  });

  it('should reject production config when MONGODB_URI points to localhost', () => {
    const config = {
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/kuizu',
      JWT_ACCESS_SECRET: 'a_very_long_and_secure_production_access_secret_key_123456',
      JWT_REFRESH_SECRET: 'a_very_long_and_secure_production_refresh_secret_key_123456',
    };

    expect(() => validateEnv(config)).toThrowError(/MONGODB_URI/);
  });

  it('should accept valid production configuration with secure secrets', () => {
    const config = {
      NODE_ENV: 'production',
      PORT: '5000',
      CLIENT_URL: 'https://kuizu.app',
      MONGODB_URI: 'mongodb+srv://admin:secure_pwd@cluster0.mongodb.net/kuizu_prod',
      JWT_ACCESS_SECRET: 'a_very_long_and_secure_production_access_secret_key_123456',
      JWT_REFRESH_SECRET: 'a_very_long_and_secure_production_refresh_secret_key_123456',
    };

    const validated = validateEnv(config);
    expect(validated.NODE_ENV).toBe('production');
    expect(validated.PORT).toBe(5000);
    expect(validated.CLIENT_URL).toBe('https://kuizu.app');
    expect(validated.JWT_ACCESS_SECRET).toBe('a_very_long_and_secure_production_access_secret_key_123456');
  });
});
