# Web security posture

## Auth & sessions
- Tokens live in `localStorage` only (no user/profile persisted); `NEXT_PUBLIC_AUTH_STORAGE_MODE=cookie` is reserved for a future httpOnly-cookie mode. `logoutAll` clears tokens + session timestamps and forces a reload to `/login`.
- Idle timeout defaults to 30 minutes and absolute session cap to 8 hours (`NEXT_PUBLIC_SESSION_IDLE_MINUTES`, `NEXT_PUBLIC_SESSION_ABSOLUTE_HOURS`); expiry shows a modal and redirects to `/login` (embed param preserved).
- 2FA: `NEXT_PUBLIC_AUTH_2FA_ENABLED=true` in staging/prod; enforced roles from `NEXT_PUBLIC_AUTH_2FA_ENFORCE_ROLES` mirror backend. Web profile hides setup controls when 2FA is disabled and surfaces an enforced badge/banner when a role requires 2FA but setup is pending.
- Shared demo tenant: seed with `npm run demo:seed` (`demo@greenbro.com` / `GreenbroDemo#2025!`, MAC `38:18:2B:60:A9:94`) so web + mobile smoke paths align.

## Framing, CSP, and headers
- Frame-ancestors: `'self' https://www.greenbro.co.za https://greenbro.co.za` (plus localhost in dev) when `NEXT_PUBLIC_EMBEDDED=true`; collapses to `'self'` when embeds are off. Override for staging with `FRAME_ANCESTORS`/`NEXT_FRAME_ANCESTORS` (comma-separated).
- CSP (see `next.config.mjs`): `default-src 'self'; script-src 'self'` (`'unsafe-eval'` only in dev); `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`; `img-src 'self' data: blob:`; `font-src 'self' data: https://fonts.gstatic.com`; `connect-src 'self' <API origin>` (+ localhost/ws in dev); `frame-ancestors ...`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`. `X-Frame-Options` mirrors the frame-ancestors allow list.
- Extending CSP: add new vendor hosts directly to the source arrays in `next.config.mjs` (and note in `docs/deploy-web.md`); keep staging overrides narrow and ensure backend `WEB_ALLOWED_ORIGINS` matches any new frame hosts.

## Browser/OS support (customer-facing)
- Desktop Chrome/Edge/Safari/Firefox (latest two versions).
- iOS Safari 16+ (for iframe embeds and QR on mobile Safari).
- Android Chrome 115+ (for iframe embeds and QR scanning).

## Pen test checklist
- Headers: verify `Content-Security-Policy` (directives above), `X-Frame-Options` (ALLOW-FROM marketing hosts or SAMEORIGIN), `frame-ancestors` align with embed policy, `Strict-Transport-Security` served by the CDN/host.
- Auth flows: `/auth/login`, `/auth/login/2fa`, `/auth/refresh`, `/auth/logout`, `/auth/request-password-reset`, `/auth/reset-password` (rate limits + lockout), idle/absolute timeout enforcement, logout-all clears storage and reloads to `/login`.
- RBAC / surfaces: `/files/*` auth gating, share links (active/expired/revoked), QR lookup (`/devices/lookup-by-code`), control endpoints, and device/alert/work-order routes respect org scoping.
- UI verification: Diagnostics page (`/app/diagnostics`) renders `health-plus` data; embed mode keeps `?embed=true` on redirects; 2FA enforced banner visible for `owner/admin` roles when `NEXT_PUBLIC_AUTH_2FA_ENABLED=true`.
