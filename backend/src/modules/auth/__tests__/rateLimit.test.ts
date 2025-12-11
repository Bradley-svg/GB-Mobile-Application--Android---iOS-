import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthRateLimiter } from '../../../middleware/rateLimit';

describe('AuthRateLimiter', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('locks out after repeated failures and unlocks after the lockout period', () => {
    vi.useFakeTimers();
    const limiter = new AuthRateLimiter({
      maxAttempts: 2,
      windowMs: 60_000,
      lockoutMs: 120_000,
    });

    expect(limiter.check('1.1.1.1', 'user@example.com').allowed).toBe(true);
    limiter.recordFailure('1.1.1.1', 'user@example.com');
    expect(limiter.check('1.1.1.1', 'user@example.com').allowed).toBe(true);

    limiter.recordFailure('1.1.1.1', 'user@example.com');
    const locked = limiter.check('1.1.1.1', 'user@example.com');
    expect(locked.allowed).toBe(false);
    if (!locked.allowed) {
      expect(locked.lockedUntil).toBeGreaterThan(Date.now());
    }

    vi.advanceTimersByTime(125_000);
    expect(limiter.check('1.1.1.1', 'user@example.com').allowed).toBe(true);
  });

  it('applies IP-based lockouts across usernames and resets after success', () => {
    const limiter = new AuthRateLimiter({
      maxAttempts: 1,
      windowMs: 60_000,
      lockoutMs: 60_000,
    });

    limiter.recordFailure('9.9.9.9', 'first@example.com');
    const blocked = limiter.check('9.9.9.9', 'second@example.com');
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.reason).toBe('ip');
    }

    limiter.recordSuccess('9.9.9.9', 'second@example.com');
    expect(limiter.check('9.9.9.9', 'second@example.com').allowed).toBe(true);
  });
});
