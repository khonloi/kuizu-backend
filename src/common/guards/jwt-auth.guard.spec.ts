import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  const createMockContext = (): ExecutionContext => {
    return {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({}),
      }),
    } as unknown as ExecutionContext;
  };

  it('should return true if route is marked as @Public', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return true;
      return undefined;
    });

    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should call super.canActivate when route is not public', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const superCanActivateSpy = vi
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true);

    const context = createMockContext();
    const result = guard.canActivate(context);

    expect(superCanActivateSpy).toHaveBeenCalledWith(context);
    expect(result).toBe(true);
    superCanActivateSpy.mockRestore();
  });

  describe('handleRequest', () => {
    it('should return null instead of throwing on optional auth route when unauthenticated', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_OPTIONAL_AUTH_KEY) return true;
        return undefined;
      });

      const context = createMockContext();
      const user = guard.handleRequest(
        new UnauthorizedException(),
        null,
        null,
        context,
      );
      expect(user).toBeNull();
    });

    it('should return user on optional auth route when authenticated', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_OPTIONAL_AUTH_KEY) return true;
        return undefined;
      });

      const context = createMockContext();
      const mockUser = { id: 'u1', username: 'alice' };
      const user = guard.handleRequest(null, mockUser, null, context);
      expect(user).toEqual(mockUser);
    });

    it('should call super.handleRequest and throw on protected route when unauthenticated', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const context = createMockContext();
      expect(() =>
        guard.handleRequest(new UnauthorizedException(), null, null, context),
      ).toThrow(UnauthorizedException);
    });
  });
});
