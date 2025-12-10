import { authenticator } from 'otplib';

authenticator.options = {
  window: 1,
};

export function generateTotpSecret() {
  return authenticator.generateSecret();
}

export function buildOtpAuthUrl(secret: string, accountName: string, issuer: string) {
  const safeName = accountName || 'user';
  const safeIssuer = issuer || 'Greenbro';
  return authenticator.keyuri(safeName, safeIssuer, secret);
}

export function verifyTotpCode(secret: string, token: string) {
  if (!secret || !token) return false;
  return authenticator.verify({ token, secret });
}
