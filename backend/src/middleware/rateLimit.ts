import { NextFunction, Request, Response } from 'express';

type AuthRateLimitConfig = {
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
};

type AttemptRecord = {
  attempts: number[];
  lockUntil?: number;
};

type RateLimitResult =
  | { allowed: true }
  | {
      allowed: false;
      lockedUntil: number;
      reason: 'ip' | 'username';
    };

function parseDurationMinutes(envKey: string, fallbackMinutes: number): number {
  const raw = Number(process.env[envKey]);
  if (!Number.isFinite(raw) || raw <= 0) {
    return fallbackMinutes * 60 * 1000;
  }
  return raw * 60 * 1000;
}

function parseCount(envKey: string, fallback: number): number {
  const raw = Number(process.env[envKey]);
  if (!Number.isFinite(raw) || raw <= 0) {
    return fallback;
  }
  return raw;
}

const defaultConfig: AuthRateLimitConfig = {
  maxAttempts: parseCount('AUTH_MAX_ATTEMPTS', 5),
  windowMs: parseDurationMinutes('AUTH_WINDOW_MINUTES', 15),
  lockoutMs: parseDurationMinutes('AUTH_LOCKOUT_MINUTES', 15),
};

function pruneAttempts(record: AttemptRecord, windowMs: number, now: number): AttemptRecord {
  const freshAttempts = record.attempts.filter((ts) => now - ts <= windowMs);
  return { ...record, attempts: freshAttempts };
}

export class AuthRateLimiter {
  private attempts = new Map<string, AttemptRecord>();

  constructor(private readonly config: AuthRateLimitConfig = defaultConfig) {}

  check(ip: string, username?: string): RateLimitResult {
    const now = Date.now();
    const keys = this.buildKeys(ip, username);

    for (const { key, reason } of keys) {
      const record = this.attempts.get(key);
      if (!record) continue;

      const pruned = pruneAttempts(record, this.config.windowMs, now);
      this.attempts.set(key, pruned);

      if (pruned.lockUntil && pruned.lockUntil > now) {
        return { allowed: false, lockedUntil: pruned.lockUntil, reason };
      }
    }

    return { allowed: true };
  }

  recordFailure(ip: string, username?: string): number | null {
    const now = Date.now();
    const keys = this.buildKeys(ip, username);
    let lockUntil: number | null = null;

    for (const { key } of keys) {
      const existing = this.attempts.get(key) ?? { attempts: [] };
      const record = pruneAttempts(existing, this.config.windowMs, now);
      record.attempts.push(now);

      if (record.attempts.length >= this.config.maxAttempts) {
        record.lockUntil = now + this.config.lockoutMs;
        lockUntil = Math.max(lockUntil ?? 0, record.lockUntil);
      }

      this.attempts.set(key, record);
    }

    return lockUntil;
  }

  recordSuccess(ip: string, username?: string) {
    const keys = this.buildKeys(ip, username);
    for (const { key } of keys) {
      this.attempts.delete(key);
    }
  }

  reset() {
    this.attempts.clear();
  }

  private buildKeys(ip: string, username?: string) {
    const keys: Array<{ key: string; reason: 'ip' | 'username' }> = [
      { key: `ip:${ip || 'unknown'}`, reason: 'ip' },
    ];
    if (username) {
      keys.push({ key: `user:${username.toLowerCase()}`, reason: 'username' });
    }
    return keys;
  }
}

export const authAttemptLimiter = new AuthRateLimiter();

export function authRateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const username = typeof req.body?.email === 'string' ? req.body.email : undefined;
  const clientIp = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  const check = authAttemptLimiter.check(clientIp, username);
  if (check.allowed) {
    return next();
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((check.lockedUntil - Date.now()) / 1000));
  res.setHeader('Retry-After', retryAfterSeconds.toString());
  return res.status(429).json({
    message: 'Too many failed login attempts. Please try again later.',
    lockedUntil: new Date(check.lockedUntil).toISOString(),
  });
}

export function resetAuthRateLimiter() {
  authAttemptLimiter.reset();
}
