import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../src/config/db';
import { acquireWorkerLock, renewWorkerLock } from '../src/repositories/workerLocksRepository';
import { resetTestDb } from './testDbSetup';

const LOCK_NAME = 'worker-lock-test';

describe('workerLocksRepository', () => {
  beforeEach(async () => {
    vi.useRealTimers();
    await resetTestDb();
  });

  it('prevents concurrent acquisition until expiry', { timeout: 10000 }, async () => {
    const ownerA = 'owner-a';
    const ownerB = 'owner-b';
    const ttlMs = 200;

    const acquired = await acquireWorkerLock(LOCK_NAME, ownerA, ttlMs);
    expect(acquired).toBe(true);

    const acquiredByOther = await acquireWorkerLock(LOCK_NAME, ownerB, ttlMs);
    expect(acquiredByOther).toBe(false);

    await query('update worker_locks set expires_at = now() - interval \'1 second\' where name = $1', [
      LOCK_NAME,
    ]);

    const acquiredAfterExpiry = await acquireWorkerLock(LOCK_NAME, ownerB, ttlMs);
    expect(acquiredAfterExpiry).toBe(true);
  });

  it('only renews for the current owner', async () => {
    const ownerA = 'owner-a';
    const ownerB = 'owner-b';
    const ttlMs = 300;

    await acquireWorkerLock(LOCK_NAME, ownerA, ttlMs);

    const renewedByOwner = await renewWorkerLock(LOCK_NAME, ownerA, ttlMs);
    expect(renewedByOwner).toBe(true);

    const renewedByOther = await renewWorkerLock(LOCK_NAME, ownerB, ttlMs);
    expect(renewedByOther).toBe(false);
  });
});
