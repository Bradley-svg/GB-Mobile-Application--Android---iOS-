# Environment reference

Centralised reference for backend and mobile environment variables across dev/staging/production.

## Backend shared variables
- `PORT`: HTTP listen port (default 4000).
- `DATABASE_URL`: Primary Postgres connection string for runtime.
- `TEST_DATABASE_URL`: Postgres connection string used by automated tests.
- `ALLOW_TEST_DB_RESET`: Allow destructive truncation in tests when DB name is not obviously test-only (keep false outside dedicated test DBs).
- `JWT_SECRET`: Secret for signing JWT access tokens. Use a long, random value in non-dev environments.
- `REFRESH_TOKEN_DAYS`: Refresh token lifetime (days).
- `AUTH_ALLOW_PUBLIC_SIGNUP`: Toggle for open signup (`false` by default).
- `USER ROLE SEMANTICS`: Roles are stored on each user row (`owner`, `admin`, `facilities`, `contractor`).
  - Owner/Admin: full control (device control, schedules, work orders, share links, document uploads).
  - Facilities: device control + work orders/doc uploads + share links; schedules follow backend RBAC (currently admin/owner).
  - Contractor: read-only across sites/devices/alerts/telemetry; no share links or uploads.
- `CORS_ALLOWED_ORIGINS`: Comma-separated allowlist for browser origins (prod/staging should be explicit; dev can allow-all).
- `LOG_LEVEL`: Structured JSON logger level (`info` default).
- `APP_VERSION`: Optional version string surfaced on `/health-plus`.
- `FILE_STORAGE_ROOT`: Root path for uploaded files (defaults to `./storage` in local dev).
- `FILE_STORAGE_BASE_URL`: Base URL used when returning `/files/...` links.
- `FILE_SIGNING_SECRET`: Optional HMAC secret for issuing `/files/:id/signed-url` tokens; when unset signed URLs are disabled and `/files/:id/signed-url` returns `ERR_FILE_SIGNING_DISABLED`.
- Signed URLs: issue tokens with `POST /files/:id/signed-url` (requires auth + org/role checks) and consume with `GET /files/signed/:token`; uploads are still AV-scanned before they land in `FILE_STORAGE_ROOT` regardless of signing.
- `AV_SCANNER_ENABLED`: Enable antivirus scanning for uploads when `true`; in tests or when unset the scanner is stubbed and always reports clean.
- `AV_SCANNER_CMD`: Optional command/binary for scanning when enabled (defaults to `clamscan --no-summary` if unset).
- `AV_SCANNER_HOST` / `AV_SCANNER_PORT`: Optional clamd target; when both are set uploads are streamed to the daemon instead of running a local command.
- `HEATPUMP_HISTORY_URL`: Base URL for the Azure heat-pump history API (required outside `NODE_ENV=development`; endpoint returns 503 when missing).
- `HEATPUMP_HISTORY_API_KEY`: API key for the history API (required outside `NODE_ENV=development`; endpoint returns 503 when missing).
- `HEATPUMP_HISTORY_TIMEOUT_MS`: Request timeout for the history API client (milliseconds).
- `MQTT_URL`: MQTT broker URL (e.g., `mqtt://broker:1883`).
- `MQTT_USERNAME` / `MQTT_PASSWORD`: Optional MQTT credentials when brokers require auth.
- `CONTROL_API_URL`: Optional HTTP control endpoint; when unset, control may fall back to MQTT.
- `CONTROL_API_KEY`: API key for the HTTP control endpoint (when enabled).
- `CONTROL_COMMAND_THROTTLE_MS`: Minimum interval (ms) between repeated control commands per device.
- `ALERT_WORKER_ENABLED`: Toggle alerts worker on/off (defaults true) plus `ALERT_WORKER_INTERVAL_SEC`/`ALERT_OFFLINE_MINUTES`/`ALERT_OFFLINE_CRITICAL_MINUTES`/`ALERT_HIGH_TEMP_THRESHOLD` to tune cadence/thresholds.
- `PUSH_HEALTHCHECK_ENABLED`: Toggle for sample push health check endpoint.
- `PUSH_HEALTHCHECK_TOKEN`: Token used to authorize sample push checks.
- `EXPO_ACCESS_TOKEN`: Expo push token for production push delivery (optional in dev).
- `WORKER_LOCK_TTL_SEC`: TTL for DB-backed worker locks (alerts worker + MQTT ingest).

## Backend staging vs production
- `CORS_ALLOWED_ORIGINS`: Must list trusted app/web origins; avoid wildcard in staging/prod.
- `JWT_SECRET`: Use a unique, high-entropy secret per environment; rotate on compromise or before cutovers.
- `DATABASE_URL` / `TEST_DATABASE_URL`: Point to isolated databases per environment; tests should only touch test DBs with `ALLOW_TEST_DB_RESET=true` when destructive operations are allowed.
- Logging/audit: Pino JSON logs by default; prefer centralized aggregation and immutable audit trails in staging/prod.
- `HEATPUMP_*`, `MQTT_*`, and `CONTROL_*` values should reference staging/prod services with stronger credentials and restricted network access.

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
- `EXPO_PUBLIC_USE_SIGNED_FILE_URLS`: Optional boolean to fetch a signed file URL before opening attachments/documents (default false; keeps using JWT-protected `/files` when unset).
- Expo push: configure the Expo project and push notification credentials per environment; ensure staging devices use staging backends to avoid cross-environment pushes.
- Notification preferences: persisted via backend `/user/preferences` (alertsEnabled toggle) and cached locally via AsyncStorage; no extra mobile envs beyond the API URL.
