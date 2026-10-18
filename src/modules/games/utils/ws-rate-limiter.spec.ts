import { describe, it, expect, beforeEach } from 'vitest';
import { WsRateLimiter } from './ws-rate-limiter';

describe('WsRateLimiter', () => {
  let limiter: WsRateLimiter;

  beforeEach(() => {
    limiter = new WsRateLimiter(5, 10);
  });

  it('should not block socket initially', () => {
    expect(limiter.isBlocked('socket-1')).toBe(false);
    expect(limiter.getAttempts('socket-1')).toBe(0);
  });

  it('should track failures and block when limit reached', () => {
    for (let i = 1; i <= 4; i++) {
      expect(limiter.recordFailure('socket-1')).toBe(i);
      expect(limiter.isBlocked('socket-1')).toBe(false);
    }

    expect(limiter.recordFailure('socket-1')).toBe(5);
    expect(limiter.isBlocked('socket-1')).toBe(true);
  });

  it('should reset attempt count on reset', () => {
    limiter.recordFailure('socket-1');
    limiter.recordFailure('socket-1');
    expect(limiter.getAttempts('socket-1')).toBe(2);

    limiter.reset('socket-1');
    expect(limiter.getAttempts('socket-1')).toBe(0);
    expect(limiter.isBlocked('socket-1')).toBe(false);
  });

  it('should evict oldest socket when maximum tracked capacity is reached', () => {
    const smallLimiter = new WsRateLimiter(5, 3);
    smallLimiter.recordFailure('socket-1');
    smallLimiter.recordFailure('socket-2');
    smallLimiter.recordFailure('socket-3');

    expect(smallLimiter.getAttempts('socket-1')).toBe(1);

    // Adding 4th socket should evict socket-1
    smallLimiter.recordFailure('socket-4');
    expect(smallLimiter.getAttempts('socket-1')).toBe(0);
    expect(smallLimiter.getAttempts('socket-4')).toBe(1);
  });
});
