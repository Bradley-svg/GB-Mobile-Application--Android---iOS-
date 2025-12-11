# Environment reference

Centralised reference for backend and mobile environment variables across local development, staging, and production.

## Local development (defaults)
- Core: `NODE_ENV=development`, `PORT=4000`, optional `APP_VERSION=0.8.0` for `/health-plus`.
- Database/testing: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_dev`, `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test`, optional `STAGING_DATABASE_URL` for the bootstrap script, `ALLOW_TEST_DB_RESET=true`.
- Auth: `JWT_SECRET` (required), `REFRESH_TOKEN_DAYS`, rate limits (`AUTH_MAX_ATTEMPTS`/`AUTH_WINDOW_MINUTES`/`AUTH_LOCKOUT_MINUTES`), `AUTH_ALLOW_PUBLIC_SIGNUP`, password reset expiry (`PASSWORD_RESET_TOKEN_MINUTES`), 2FA toggles (`AUTH_2FA_ENABLED`, `AUTH_2FA_ENFORCE_ROLES`, `AUTH_2FA_ISSUER`), optional `DEMO_USER_PASSWORD`.
- Files/AV: `FILE_STORAGE_ROOT=./storage`, `FILE_STORAGE_BASE_URL=http://localhost:4000/files`, optional `FILE_SIGNING_SECRET` and `FILE_SIGNED_URL_TTL_MINUTES`, AV flags (`AV_SCANNER_ENABLED=false`, `AV_SCANNER_CMD`, `AV_SCANNER_HOST`/`AV_SCANNER_PORT`).
- Integrations: MQTT (`MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_TELEMETRY_TOPIC`, `MQTT_CONTROL_TOPIC_TEMPLATE`, `MQTT_CONNECT_TIMEOUT_MS`, `MQTT_DISABLED`), control API (`CONTROL_API_URL`, `CONTROL_API_KEY`, `CONTROL_API_DISABLED`, `CONTROL_COMMAND_THROTTLE_MS`), heat-pump history (`HEATPUMP_HISTORY_URL`, `HEATPUMP_HISTORY_API_KEY`, `HEATPUMP_HISTORY_TIMEOUT_MS`, `HEATPUMP_HISTORY_MAX_RANGE_HOURS`, `HEATPUMP_HISTORY_PAGE_HOURS`, `HEATPUMP_HISTORY_DISABLED`).
- Workers/alerts: `ALERT_WORKER_ENABLED`, `ALERT_WORKER_INTERVAL_SEC`, `WORKER_LOCK_TTL_SEC`, thresholds (`ALERT_OFFLINE_MINUTES`, `ALERT_OFFLINE_CRITICAL_MINUTES`, `ALERT_HIGH_TEMP_THRESHOLD`, `ALERT_RULE_REFRESH_MINUTES`).
- Push: `EXPO_ACCESS_TOKEN` (optional in dev), `PUSH_NOTIFICATIONS_ENABLED_ROLES`, `PUSH_NOTIFICATIONS_DISABLED`, `PUSH_HEALTHCHECK_ENABLED`, `PUSH_HEALTHCHECK_TOKEN`, `PUSH_HEALTHCHECK_INTERVAL_MINUTES`, `HEALTH_BASE_URL` for probe scripts.
- CORS: `CORS_ALLOWED_ORIGINS` controls browser origins; keep explicit lists outside dev.

## Staging
- Base: `NODE_ENV=production`, `APP_VERSION=0.8.0`, `PORT=4000`, `CORS_ALLOWED_ORIGINS` listing staging web/app origins.
- Database/storage: `DATABASE_URL=postgres://<host>:5432/greenbro_staging`, `FILE_STORAGE_ROOT=/var/lib/greenbro/storage`, `FILE_STORAGE_BASE_URL=https://staging-api.greenbro.co.za/files`, unique `FILE_SIGNING_SECRET`, `FILE_SIGNED_URL_TTL_MINUTES=60`.
- Auth: strong `JWT_SECRET` placeholder, `REFRESH_TOKEN_DAYS=30`, `AUTH_ALLOW_PUBLIC_SIGNUP=false`, `AUTH_2FA_ENABLED=true`, `AUTH_2FA_ENFORCE_ROLES=owner,admin`, `AUTH_2FA_ISSUER=Greenbro`.
- Files/AV: `AV_SCANNER_ENABLED=true` with either `AV_SCANNER_CMD` or `AV_SCANNER_HOST`/`AV_SCANNER_PORT`; keep storage writable and AV reachable before enabling uploads.
- Integrations: configure MQTT/control/history (`MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_TELEMETRY_TOPIC`, `MQTT_CONTROL_TOPIC_TEMPLATE`, `CONTROL_API_URL`, `CONTROL_API_KEY`, `HEATPUMP_HISTORY_URL`, `HEATPUMP_HISTORY_API_KEY`, `HEATPUMP_HISTORY_TIMEOUT_MS`) or explicitly set the disable flags (`MQTT_DISABLED`, `CONTROL_API_DISABLED`, `HEATPUMP_HISTORY_DISABLED`) when offline; `/health-plus` should show `mqttIngest.configured=true` (with `connected`/`lastMessageAt` once live) and `control.configured=true` only when URL + key exist and the disable flag is false.
- Push: `EXPO_ACCESS_TOKEN=<staging-expo-token>`, `PUSH_NOTIFICATIONS_ENABLED_ROLES=owner,admin,facilities`, `PUSH_NOTIFICATIONS_DISABLED=false`; optional `PUSH_HEALTHCHECK_ENABLED`/`PUSH_HEALTHCHECK_TOKEN` for sample pushes.
- Observability: `LOG_LEVEL=info`, `DB_SLOW_QUERY_MS` tuned for staging load, `HEALTH_BASE_URL=https://staging-api.greenbro.co.za`; `/health-plus` should report configured/disabled flags accurately.

## Production
- Base: `NODE_ENV=production`, `APP_VERSION=0.8.0`, `PORT=4000`, CORS allowlist restricted to trusted production domains.
- Database/storage: `DATABASE_URL=postgres://<host>:5432/greenbro_prod`, durable `FILE_STORAGE_ROOT`, `FILE_STORAGE_BASE_URL=https://api.greenbro.co.za/files`, unique `FILE_SIGNING_SECRET`, `FILE_SIGNED_URL_TTL_MINUTES=60`.
- Auth: unique high-entropy `JWT_SECRET`, `AUTH_ALLOW_PUBLIC_SIGNUP=false`, `AUTH_2FA_ENABLED=true`, `AUTH_2FA_ENFORCE_ROLES=owner,admin`, `AUTH_2FA_ISSUER=Greenbro`, `REFRESH_TOKEN_DAYS=30`.
- Files/AV: `AV_SCANNER_ENABLED=true` with a reachable scanner target; uploads should never bypass AV; signed URLs use a distinct secret from JWT.
- Integrations: live MQTT/control/history endpoints with disable flags left `false`; tune `ALERT_WORKER_INTERVAL_SEC`/thresholds appropriately and keep `WORKER_LOCK_TTL_SEC` aligned with worker cadence; `/health-plus` should show mqtt/control configured with `connected`/`lastMessageAt` and `lastCommandAt` populated when traffic flows.
- Push: `EXPO_ACCESS_TOKEN=<production-expo-token>`, `PUSH_NOTIFICATIONS_ENABLED_ROLES=owner,admin,facilities`, `PUSH_HEALTHCHECK_ENABLED=true` plus a token for sample pushes; `HEALTH_BASE_URL=https://api.greenbro.co.za`.

## Mobile
- `EXPO_PUBLIC_API_URL`: dev (emulator) `http://10.0.2.2:4000`, dev (LAN) `http://<your-lan-ip>:4000`, staging `https://staging-api.greenbro.co.za`, production `https://api.greenbro.co.za`.
- `EXPO_PUBLIC_USE_SIGNED_FILE_URLS`: optional boolean; enable in staging when `FILE_SIGNING_SECRET` is set and mobile should request signed URLs.
- EAS profiles (`eas.json`) inject the correct API URL per environment; app version/build identifiers live in `app.config.ts`/`app.json` (0.8.0 / android.versionCode 8 / ios.buildNumber 0.8.0).
- Expo push requires the backend `EXPO_ACCESS_TOKEN` to match the project for the targeted profile; mobile does not need extra push env vars beyond the API URL.
