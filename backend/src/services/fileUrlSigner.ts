import crypto from 'crypto';
import type { UserRole } from '../repositories/usersRepository';

export type SignedFileAction = 'read';

export type FileTokenVerification = {
  valid: boolean;
  expired: boolean;
  fileId?: string;
  orgId?: string;
  userId?: string;
  role?: UserRole;
  action?: SignedFileAction;
};

export type SignFileTokenInput = {
  fileId: string;
  orgId: string;
  userId?: string;
  role?: UserRole;
  action?: SignedFileAction;
  expiresAt: Date;
};

function getSecret(): string | null {
  const secret = process.env.FILE_SIGNING_SECRET;
  if (!secret || !secret.trim()) return null;
  return secret;
}

export function isFileSigningEnabled(): boolean {
  return getSecret() !== null;
}

export function getDefaultSignedUrlTtlSeconds(): number {
  const raw = process.env.FILE_SIGNED_URL_TTL_MINUTES;
  const minutes = raw ? Number.parseInt(raw, 10) : 60;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 60 * 60; // fall back to 60 minutes
  }
  return minutes * 60;
}

export function signFileToken(input: SignFileTokenInput): string {
  const { fileId, orgId, expiresAt } = input;
  const secret = getSecret();
  if (!secret) {
    throw new Error('FILE_SIGNING_SECRET is not configured');
  }

  const expiresAtMs = expiresAt.getTime();
  if (!Number.isFinite(expiresAtMs)) {
    throw new Error('Invalid expiresAt');
  }

  const action: SignedFileAction = input.action ?? 'read';
  if (action !== 'read') {
    throw new Error('Unsupported file token action');
  }

  const payload = {
    f: fileId,
    o: orgId,
    u: input.userId,
    r: input.role,
    a: action,
    e: expiresAtMs,
  };
  const payloadBuffer = Buffer.from(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(payloadBuffer).digest();

  return `${payloadBuffer.toString('base64url')}.${signature.toString('base64url')}`;
}

export function verifyFileToken(token: string): FileTokenVerification {
  const secret = getSecret();
  if (!secret) {
    return { valid: false, expired: false };
  }

  const [payloadB64, signatureB64] = token.split('.');
  if (!payloadB64 || !signatureB64) {
    return { valid: false, expired: false };
  }

  let payloadBuffer: Buffer;
  let providedSig: Buffer;
  try {
    payloadBuffer = Buffer.from(payloadB64, 'base64url');
    providedSig = Buffer.from(signatureB64, 'base64url');
  } catch {
    return { valid: false, expired: false };
  }

  const expectedSig = crypto.createHmac('sha256', secret).update(payloadBuffer).digest();
  if (
    providedSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(providedSig, expectedSig)
  ) {
    return { valid: false, expired: false };
  }

  try {
    const parsed = JSON.parse(payloadBuffer.toString('utf8')) as {
      f?: string;
      o?: string;
      u?: string;
      r?: UserRole;
      a?: SignedFileAction;
      e?: number;
    };
    const fileId = typeof parsed.f === 'string' ? parsed.f : undefined;
    const orgId = typeof parsed.o === 'string' ? parsed.o : undefined;
    const userId = typeof parsed.u === 'string' ? parsed.u : undefined;
    const role = parsed.r;
    const action = parsed.a === 'read' ? 'read' : undefined;
    const expiresAtMs = typeof parsed.e === 'number' ? parsed.e : NaN;

    if (!fileId || !orgId || !action || !Number.isFinite(expiresAtMs)) {
      return { valid: false, expired: false };
    }

    const expired = Date.now() > expiresAtMs;
    return { valid: !expired, expired, fileId, orgId, userId, role, action };
  } catch {
    return { valid: false, expired: false };
  }
}
