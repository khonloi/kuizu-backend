import { describe, it, expect } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import {
  getCurrentUserFromContext,
  CurrentUserData,
} from './current-user.decorator';

describe('CurrentUser decorator factory', () => {
  const createMockContext = (user?: CurrentUserData): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  it('should return null when user is not present on request', () => {
    const ctx = createMockContext(undefined);
    expect(getCurrentUserFromContext(undefined, ctx)).toBeNull();
  });

  it('should return whole user object when no property key is specified', () => {
    const user: CurrentUserData = {
      id: 'u-1',
      email: 'user@example.com',
      username: 'UserOne',
      role: 'user',
    };
    const ctx = createMockContext(user);
    expect(getCurrentUserFromContext(undefined, ctx)).toEqual(user);
  });

  it('should return specific user property when key is specified', () => {
    const user: CurrentUserData = {
      id: 'u-1',
      email: 'user@example.com',
      username: 'UserOne',
      role: 'admin',
    };
    const ctx = createMockContext(user);
    expect(getCurrentUserFromContext('id', ctx)).toBe('u-1');
    expect(getCurrentUserFromContext('role', ctx)).toBe('admin');
  });
});
