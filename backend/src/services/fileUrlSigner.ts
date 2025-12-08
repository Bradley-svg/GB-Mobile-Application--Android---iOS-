import crypto from 'crypto';

export type FileTokenVerification = {
  valid: boolean;
  expired: boolean;
  fileId?: string;
};

function getSecret(): string | null {
  const secret = process.env.FILE_SIGNING_SECRET;
  if (!secret || !secret.trim()) return null;
  return secret;
}

export function isFileSigningEnabled(): boolean {
  return getSecret() !== null;
}

export function signFileToken(fileId: string, expiresAt: Date): string {
  const secret = getSecret();
  if (!secret) {
    throw new Error('FILE_SIGNING_SECRET is not configured');
  }

  const expiresAtMs = expiresAt.getTime();
  if (!Number.isFinite(expiresAtMs)) {
    throw new Error('Invalid expiresAt');
  }

  const payload = { f: fileId, e: expiresAtMs };
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
    const parsed = JSON.parse(payloadBuffer.toString('utf8')) as { f?: string; e?: number };
    const fileId = typeof parsed.f === 'string' ? parsed.f : undefined;
    const expiresAtMs = typeof parsed.e === 'number' ? parsed.e : NaN;

    if (!fileId || !Number.isFinite(expiresAtMs)) {
      return { valid: false, expired: false };
    }

    const expired = Date.now() > expiresAtMs;
    return { valid: !expired, expired, fileId };
  } catch {
    return { valid: false, expired: false };
  }
}
