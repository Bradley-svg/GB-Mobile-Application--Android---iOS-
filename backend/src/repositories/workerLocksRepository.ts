import { query } from '../config/db';

const MIN_TTL_MS = 50;

function resolveExpiry(ttlMs: number) {
  const normalizedTtl = Number.isFinite(ttlMs) ? ttlMs : MIN_TTL_MS;
  const ttl = Math.max(MIN_TTL_MS, normalizedTtl);
  const now = Date.now();
  return new Date(now + ttl);
}

export async function acquireWorkerLock(
  name: string,
  ownerId: string,
  ttlMs: number
): Promise<boolean> {
  const expiresAt = resolveExpiry(ttlMs);

  const res = await query<{ owner_id: string }>(
    `
    insert into worker_locks (name, owner_id, locked_at, expires_at)
    values ($1, $2, now(), $3)
    on conflict (name)
    do update set owner_id = $2,
                 locked_at = now(),
                 expires_at = $3
      where worker_locks.expires_at < now() or worker_locks.owner_id = $2
    returning owner_id
  `,
    [name, ownerId, expiresAt]
  );

  const count = res.rowCount ?? 0;
  return count > 0 && res.rows[0].owner_id === ownerId;
}

export async function renewWorkerLock(
  name: string,
  ownerId: string,
  ttlMs: number
): Promise<boolean> {
  const expiresAt = resolveExpiry(ttlMs);

  const res = await query<{ name: string }>(
    `
    update worker_locks
    set locked_at = now(),
        expires_at = $3
    where name = $1
      and owner_id = $2
    returning name
  `,
    [name, ownerId, expiresAt]
  );

  const count = res.rowCount ?? 0;
  return count > 0;
}

export async function releaseWorkerLock(name: string, ownerId: string): Promise<void> {
  await query(
    `
    delete from worker_locks
    where name = $1
      and owner_id = $2
  `,
    [name, ownerId]
  );
}
