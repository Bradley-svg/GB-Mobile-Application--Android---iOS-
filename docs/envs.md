# Environment reference

Centralised reference for backend and mobile environment variables across dev/staging/production.

## Backend shared variables
- `PORT`: HTTP listen port (default 4000).
- `DATABASE_URL`: Primary Postgres connection string for runtime.
- `TEST_DATABASE_URL`: Postgres connection string used by automated tests.
- `STAGING_DATABASE_URL`: Optional staging Postgres connection string for bootstrap scripts.
- `ALLOW_TEST_DB_RESET`: Allow destructive truncation in tests when DB name is not obviously test-only (keep false outside dedicated test DBs).
- `JWT_SECRET`: Secret for signing JWT access tokens. Use a long, random value in non-dev environments.
- `REFRESH_TOKEN_DAYS`: Refresh token lifetime (days).
- `AUTH_MAX_ATTEMPTS` / `AUTH_WINDOW_MINUTES` / `AUTH_LOCKOUT_MINUTES`: Rate limit and temporary lockout for failed login attempts (per IP and per username).
- `AUTH_ALLOW_PUBLIC_SIGNUP`: Toggle for open signup (`false` by default).
- `PASSWORD_RESET_TOKEN_MINUTES`: Minutes before a password reset token expires.
- `AUTH_2FA_ENABLED`: Enable/disable TOTP-based two-factor authentication (default false; when false, behaviour is unchanged).
- `AUTH_2FA_ENFORCE_ROLES`: Comma-separated roles that must use 2FA when `AUTH_2FA_ENABLED=true` (for example `owner,admin`).
- `AUTH_2FA_ISSUER`: Issuer label presented in authenticator apps (default `Greenbro`).
- `DEMO_USER_PASSWORD`: Optional override for the seeded demo users created by `scripts/init-local-db.js`.
- `USER ROLE SEMANTICS`: Roles are stored on each user row (`owner`, `admin`, `facilities`, `contractor`).
  - Owner/Admin: full control (device control, schedules, work orders, share links, document uploads).
  - Facilities: device control plus work orders/document uploads plus share links; schedules follow backend RBAC (currently admin/owner).
  - Contractor: read-only across sites/devices/alerts/telemetry; no share links or uploads.
- `CORS_ALLOWED_ORIGINS`: Comma-separated allowlist for browser origins (prod/staging should be explicit; dev can allow-all).
- `LOG_LEVEL`: Structured JSON logger level (`info` default).
- `APP_VERSION`: Optional version string surfaced on `/health-plus`.
- `FILE_STORAGE_ROOT`: Root path for uploaded files (defaults to `./storage` in local dev; must be writable on staging/prod hosts or the storage block in `/health-plus` will fail).
- `FILE_STORAGE_BASE_URL`: Base URL used when returning `/files/...` links (use API origin in dev; point at the reverse-proxy/CDN origin in staging/prod).
- `FILE_SIGNING_SECRET`: HMAC secret for issuing `/files/:id/signed-url` tokens; optional in dev, required in staging/prod if signed URLs are enabled. Do not reuse the JWT secret.
- `FILE_SIGNED_URL_TTL_MINUTES`: Default lifetime (minutes) when callers omit `ttlSeconds` for signed URLs; tokens are org/file scoped with a hardcoded `read` action and are rejected when expired or org-mismatched.
- Signed URLs: issue tokens with `POST /files/:id/signed-url` (requires auth plus org/role checks) and consume with `GET /files/signed/:token`; uploads are still AV-scanned before they land in `FILE_STORAGE_ROOT` regardless of signing, and files marked `scan_failed`/`infected` are never served.
- `AV_SCANNER_ENABLED`: Enable antivirus scanning for uploads when `true`; in tests or when unset the scanner is stubbed and always reports clean. Staging/prod should set this to `true` with a real scanner target.
- `AV_SCANNER_CMD`: Optional command/binary for scanning when enabled (defaults to `clamscan --no-summary` if unset) - use when running a local scanner process.
- `AV_SCANNER_HOST` / `AV_SCANNER_PORT`: Optional clamd target; when both are set uploads are streamed to the daemon instead of running a local command. Mutually exclusive with `AV_SCANNER_CMD`.
- `HEATPUMP_HISTORY_URL`: Base URL for the Azure heat-pump history API (required outside `NODE_ENV=development`; endpoint returns 503 when missing).
- `HEATPUMP_HISTORY_API_KEY`: API key for the history API (required outside `NODE_ENV=development`; endpoint returns 503 when missing).
- `HEATPUMP_HISTORY_TIMEOUT_MS`: Request timeout for the history API client (milliseconds).
- `HEATPUMP_HISTORY_DISABLED`: Optional flag to disable vendor calls (used by CI/E2E to avoid external dependencies).
- `MQTT_URL`: MQTT broker URL (for example `mqtt://broker:1883`).
- `MQTT_DISABLED`: Optional flag to disable MQTT ingest (used by CI/E2E).
- `MQTT_USERNAME` / `MQTT_PASSWORD`: Optional MQTT credentials when brokers require auth.
- `CONTROL_API_URL`: Optional HTTP control endpoint; when unset, control may fall back to MQTT.
- `CONTROL_API_KEY`: API key for the HTTP control endpoint (when enabled).
- `CONTROL_API_DISABLED`: Optional flag to disable external control calls (used by CI/E2E).
- `CONTROL_COMMAND_THROTTLE_MS`: Minimum interval (ms) between repeated control commands per device.
- Audit logging: key file/share actions write to the `audit_events` table (uploads, signed-URL issuance/use, share link create/revoke); no env toggle is required.
- `ALERT_WORKER_ENABLED`: Toggle alerts worker on/off (defaults true).
- `ALERT_WORKER_INTERVAL_SEC` / `ALERT_OFFLINE_MINUTES` / `ALERT_OFFLINE_CRITICAL_MINUTES` / `ALERT_HIGH_TEMP_THRESHOLD` / `ALERT_RULE_REFRESH_MINUTES`: Cadence and threshold tuning for alert evaluation plus cache refresh.
- `PUSH_HEALTHCHECK_ENABLED`: Toggle for sample push health check endpoint.
- `PUSH_HEALTHCHECK_TOKEN`: Token used to authorize sample push checks.
- `PUSH_NOTIFICATIONS_DISABLED`: Optional flag to disable push sends in CI/E2E.
- `PUSH_NOTIFICATIONS_ENABLED_ROLES`: Comma-separated roles that receive push alerts (`owner,admin,facilities` by default).
- `PUSH_HEALTHCHECK_INTERVAL_MINUTES`: Minutes between health-check push attempts.
- `HEALTH_BASE_URL`: Optional base URL used by `scripts/check-health.ts` when probing deployed environments.
- `EXPO_ACCESS_TOKEN`: Expo push access token for production push delivery (required for push; optional in dev when push is disabled).
- `WORKER_LOCK_TTL_SEC`: TTL for DB-backed worker locks (alerts worker plus MQTT ingest).

## Backend staging vs production
- `CORS_ALLOWED_ORIGINS`: Must list trusted app/web origins; avoid wildcard in staging/prod.
- `JWT_SECRET`: Use a unique, high-entropy secret per environment; rotate on compromise or before cutovers.
- `DATABASE_URL` / `TEST_DATABASE_URL` / `STAGING_DATABASE_URL`: Point to isolated databases per environment; tests should only touch test DBs with `ALLOW_TEST_DB_RESET=true` when destructive operations are allowed.
- Logging/audit: Pino JSON logs by default; prefer centralized aggregation and immutable audit trails in staging/prod.
- `HEATPUMP_*`, `MQTT_*`, and `CONTROL_*` values should reference staging/prod services with stronger credentials and restricted network access.
- File access: `FILE_STORAGE_ROOT` must be writable and backed by durable storage; set `FILE_STORAGE_BASE_URL` to the public-facing origin (API or CDN) so returned links resolve. Configure a unique `FILE_SIGNING_SECRET` per environment before enabling signed URLs. AV should be enabled with either `AV_SCANNER_CMD` or `AV_SCANNER_HOST`/`PORT` set; otherwise uploads will short-circuit with `ERR_FILE_SCAN_FAILED` when the flag is on but no scanner is reachable.

## Staging URLs
- `STAGING_API_URL=https://staging-api.greenbro.co.za` (staging backend host; DNS/host must exist and be included in `CORS_ALLOWED_ORIGINS`).
- `STAGING_WEB_URL=https://staging.greenbro.co.za` (staging web/app domain if exposed; keep aligned with CORS).
- `HEATPUMP_* in staging`: leave unset to show `configured:false`/`healthy:true` on `/health-plus`, or set Azure URL/key/timeout for real compressor-history data.
- `CONTROL_* in staging`: may stay empty initially (UI will report `CONTROL_CHANNEL_UNCONFIGURED` but remain healthy); production should point at the live control provider.

## Mobile
- `EXPO_PUBLIC_API_URL`: Base URL for the backend API.
  - Dev (Android emulator): `http://10.0.2.2:4000`
  - Dev (LAN/real devices): `http://<your-lan-ip>:4000`
  - Staging: `https://staging-api.greenbro.co.za` (pending DNS/host bring-up)
  - Production: `https://api.greenbro.co.za`
- `EXPO_PUBLIC_USE_SIGNED_FILE_URLS`: Optional boolean to fetch a signed file URL before opening attachments/documents (default false; keeps using JWT-protected `/files` when unset). Enable in staging builds once `FILE_SIGNING_SECRET` is set; keep dev/prod at the default until rollout.
- Expo push: configure the Expo project and push notification credentials per environment; ensure staging devices use staging backends to avoid cross-environment pushes.
- Notification preferences: persisted via backend `/user/preferences` (alertsEnabled toggle) and cached locally via AsyncStorage; no extra mobile envs beyond the API URL.
