import { describe, it, expect } from 'vitest';
import { getAllowedCorsOrigins } from './cors.util';

describe('getAllowedCorsOrigins', () => {
  it('should split and trim comma-separated origins when CORS_ALLOWED_ORIGINS is provided', () => {
    const result = getAllowedCorsOrigins(
      'https://example.com, https://app.example.com , ',
    );
    expect(result).toEqual(['https://example.com', 'https://app.example.com']);
  });

  it('should return clientUrl in production when CORS_ALLOWED_ORIGINS is absent', () => {
    const result = getAllowedCorsOrigins(
      undefined,
      'https://myclient.com',
      true,
    );
    expect(result).toEqual(['https://myclient.com']);
  });

  it('should include localhost defaults in non-production when CORS_ALLOWED_ORIGINS is absent', () => {
    const result = getAllowedCorsOrigins(
      undefined,
      'http://localhost:3002',
      false,
    );
    expect(result).toContain('http://localhost:3002');
    expect(result).toContain('http://localhost:3000');
    expect(result).toContain('http://localhost:3001');
  });

  it('should use default clientUrl if not provided', () => {
    const result = getAllowedCorsOrigins(undefined, undefined, true);
    expect(result).toEqual(['http://localhost:3001']);
  });
});
