import { createHash, randomBytes } from 'crypto';
import {
  findPasswordResetTokenByHash,
  insertPasswordResetToken,
  invalidateOutstandingTokensForUser,
  markPasswordResetTokenUsed,
  type PasswordResetTokenRow,
} from './passwordResetTokensRepository';

const RESET_TOKEN_MINUTES = (() => {
  const raw = Number(process.env.PASSWORD_RESET_TOKEN_MINUTES ?? 30);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 30;
  }
  return raw;
})();

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function isExpired(record: PasswordResetTokenRow) {
  return new Date(record.expires_at) < new Date();
}

export async function createPasswordResetToken(userId: string) {
  const token = randomBytes(48).toString('hex');
  const expiresAt = minutesFromNow(RESET_TOKEN_MINUTES);
  const tokenHash = hashToken(token);

  await invalidateOutstandingTokensForUser(userId);
  await insertPasswordResetToken(userId, tokenHash, expiresAt);

  return { token, expiresAt };
}

export async function consumePasswordResetToken(token: string) {
  const hashed = hashToken(token);
  const record = await findPasswordResetTokenByHash(hashed);
  if (!record || record.used_at) {
    throw new Error('INVALID_RESET_TOKEN');
  }

  if (isExpired(record)) {
    await markPasswordResetTokenUsed(record.id);
    throw new Error('EXPIRED_RESET_TOKEN');
  }

  await markPasswordResetTokenUsed(record.id);

  return { userId: record.user_id };
}
