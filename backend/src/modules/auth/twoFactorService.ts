import {
  activateTwoFactorSecret,
  disableTwoFactor,
  getTwoFactorState,
  setTwoFactorTempSecret,
  type UserRole,
} from '../../repositories/usersRepository';
import { recordAuditEvent } from '../audit/auditService';
import { buildOtpAuthUrl, generateTotpSecret, verifyTotpCode } from './totp';

export function isTwoFactorFeatureEnabled() {
  return process.env.AUTH_2FA_ENABLED === 'true';
}

function resolveIssuer() {
  return process.env.AUTH_2FA_ISSUER || 'Greenbro';
}

function resolveEnforcedRoles(): UserRole[] {
  const VALID_ROLES: UserRole[] = ['owner', 'admin', 'facilities', 'contractor'];
  return (process.env.AUTH_2FA_ENFORCE_ROLES ?? '')
    .split(',')
    .map((role) => role.trim())
    .filter((role): role is UserRole => VALID_ROLES.includes(role as UserRole));
}

export function roleRequiresTwoFactor(role: UserRole) {
  if (!isTwoFactorFeatureEnabled()) return false;
  return resolveEnforcedRoles().includes(role);
}

export async function startTwoFactorSetup(userId: string, email: string) {
  if (!isTwoFactorFeatureEnabled()) {
    throw new Error('TWO_FACTOR_DISABLED');
  }

  const secret = generateTotpSecret();
  await setTwoFactorTempSecret(userId, secret);
  const otpauthUrl = buildOtpAuthUrl(secret, email, resolveIssuer());

  return { secret, otpauthUrl };
}

export async function confirmTwoFactorSetup(userId: string, code: string) {
  if (!isTwoFactorFeatureEnabled()) {
    throw new Error('TWO_FACTOR_DISABLED');
  }

  const state = await getTwoFactorState(userId);
  if (!state) {
    throw new Error('USER_NOT_FOUND');
  }
  if (!state.two_factor_temp_secret) {
    throw new Error('NO_TWO_FACTOR_PENDING');
  }

  const valid = verifyTotpCode(state.two_factor_temp_secret, code);
  if (!valid) {
    throw new Error('INVALID_2FA_CODE');
  }

  await activateTwoFactorSecret(userId);
  await recordAuditEvent({
    action: 'auth_2fa_enabled',
    entityType: 'user',
    entityId: userId,
    userId,
    orgId: state.organisation_id,
    metadata: { role: state.role },
  });

  return { enabled: true };
}

export async function disableTwoFactorForUser(userId: string) {
  if (!isTwoFactorFeatureEnabled()) {
    throw new Error('TWO_FACTOR_DISABLED');
  }

  const state = await getTwoFactorState(userId);
  if (!state) {
    throw new Error('USER_NOT_FOUND');
  }

  await disableTwoFactor(userId);
  await recordAuditEvent({
    action: 'auth_2fa_disabled',
    entityType: 'user',
    entityId: userId,
    userId,
    orgId: state.organisation_id,
    metadata: { role: state.role },
  });

  return { enabled: false };
}

export async function verifyTwoFactorForUser(userId: string, code: string) {
  if (!isTwoFactorFeatureEnabled()) {
    throw new Error('TWO_FACTOR_DISABLED');
  }

  const state = await getTwoFactorState(userId);
  if (!state) {
    throw new Error('USER_NOT_FOUND');
  }
  if (!state.two_factor_secret || !state.two_factor_enabled) {
    throw new Error('TWO_FACTOR_NOT_ENABLED');
  }

  const valid = verifyTotpCode(state.two_factor_secret, code);
  if (!valid) {
    throw new Error('INVALID_2FA_CODE');
  }

  return state;
}
