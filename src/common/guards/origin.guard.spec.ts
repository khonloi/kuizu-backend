import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OriginGuard } from './origin.guard';

describe('OriginGuard', () => {
  let guard: OriginGuard;
  let mockConfigService: any;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'CLIENT_URL') return 'http://localhost:3001';
        if (key === 'NODE_ENV') return 'development';
        return null;
      }),
    };

    guard = new OriginGuard(mockConfigService as unknown as ConfigService);
  });

  const createMockContext = (
    method: string,
    cookies: Record<string, string> = {},
    headers: Record<string, string> = {},
  ): ExecutionContext => {
    const request = {
      method,
      cookies,
      headers,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('allows safe HTTP methods (GET, HEAD) without headers', () => {
    const context = createMockContext('GET', { access_token: 'valid' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows mutating requests that do not use cookies (e.g. Bearer auth only)', () => {
    const context = createMockContext(
      'POST',
      {},
      { authorization: 'Bearer token' },
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows cookie-authenticated mutating requests with matching Origin header', () => {
    const context = createMockContext(
      'POST',
      { access_token: 'valid' },
      { origin: 'http://localhost:3001' },
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows cookie-authenticated mutating requests with matching Referer header when Origin is absent', () => {
    const context = createMockContext(
      'DELETE',
      { access_token: 'valid' },
      { referer: 'http://localhost:3001/profile/settings' },
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects cookie-authenticated mutating requests from untrusted origin', () => {
    const context = createMockContext(
      'POST',
      { access_token: 'valid' },
      { origin: 'https://malicious-site.com' },
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects cookie-authenticated mutating requests with invalid Referer URL', () => {
    const context = createMockContext(
      'POST',
      { access_token: 'valid' },
      { referer: 'invalid-url-format' },
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects cookie-authenticated mutating requests missing both Origin and Referer', () => {
    const context = createMockContext('POST', { access_token: 'valid' }, {});
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
