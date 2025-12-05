import { beforeEach, describe, expect, it } from 'vitest';
import { acquireWorkerLock, renewWorkerLock } from '../src/repositories/workerLocksRepository';
import { resetTestDb } from './testDbSetup';

const LOCK_NAME = 'worker-lock-test';

describe('workerLocksRepository', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('prevents concurrent acquisition until expiry', async () => {
    const ownerA = 'owner-a';
    const ownerB = 'owner-b';
    const ttlMs = 200;

    const acquired = await acquireWorkerLock(LOCK_NAME, ownerA, ttlMs);
    expect(acquired).toBe(true);

    const acquiredByOther = await acquireWorkerLock(LOCK_NAME, ownerB, ttlMs);
    expect(acquiredByOther).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, ttlMs + 150));

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
