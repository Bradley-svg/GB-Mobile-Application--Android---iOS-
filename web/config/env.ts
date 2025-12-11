export const WEB_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const EMBED_ALLOWED = process.env.NEXT_PUBLIC_EMBEDDED === 'true';

export function getAuth2faEnforcedRoles() {
  const rawEnforcedRoles = process.env.NEXT_PUBLIC_AUTH_2FA_ENFORCE_ROLES ?? '';
  return rawEnforcedRoles
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

export const AUTH_2FA_ENFORCE_ROLES = getAuth2faEnforcedRoles();
