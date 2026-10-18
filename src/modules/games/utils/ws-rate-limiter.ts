/**
 * Bounded in-memory rate limiter for WebSocket connection attempts per socket ID.
 * Prevents memory exhaustion attacks via size eviction.
 */
export class WsRateLimiter {
  private readonly attempts = new Map<string, number>();

  constructor(
    private readonly maxAttempts: number = 5,
    private readonly maxTrackedSockets: number = 10000,
  ) {}

  isBlocked(socketId: string): boolean {
    return (this.attempts.get(socketId) || 0) >= this.maxAttempts;
  }

  recordFailure(socketId: string): number {
    if (
      this.attempts.size >= this.maxTrackedSockets &&
      !this.attempts.has(socketId)
    ) {
      const oldestKey = this.attempts.keys().next().value;
      if (oldestKey) this.attempts.delete(oldestKey);
    }
    const current = (this.attempts.get(socketId) || 0) + 1;
    this.attempts.set(socketId, current);
    return current;
  }

  reset(socketId: string): void {
    this.attempts.delete(socketId);
  }

  getAttempts(socketId: string): number {
    return this.attempts.get(socketId) || 0;
  }
}
