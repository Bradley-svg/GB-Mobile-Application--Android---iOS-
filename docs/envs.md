# Environment reference

Centralised reference for backend and mobile environment variables across dev/staging/production.

## Backend ƒ?" shared variables
- `DATABASE_URL`: Primary Postgres connection string for runtime.
- `TEST_DATABASE_URL`: Postgres connection string used by automated tests.
- `JWT_SECRET`: Secret for signing JWT access tokens. Use a long, random value in non-dev environments.
- `CORS_ALLOWED_ORIGINS`: Comma-separated allowlist for browser origins (prod/staging should be explicit; dev can allow-all).
- `LOG_LEVEL`: Structured JSON logger level (`info` default).
- `HEATPUMP_HISTORY_URL`: Base URL for the Azure heat-pump history API.
- `HEATPUMP_HISTORY_API_KEY`: API key for the history API.
- `HEATPUMP_HISTORY_TIMEOUT_MS`: Request timeout for the history API client (milliseconds).
- `MQTT_URL`: MQTT broker URL (e.g., `mqtt://broker:1883`).
- `MQTT_USERNAME` / `MQTT_PASSWORD`: Optional MQTT credentials when brokers require auth.
- `CONTROL_API_URL`: Optional HTTP control endpoint; when unset, control may fall back to MQTT.
- `CONTROL_API_KEY`: API key for the HTTP control endpoint (when enabled).
- `PUSH_HEALTHCHECK_ENABLED`: Toggle for sample push health check endpoint.
- `PUSH_HEALTHCHECK_TOKEN`: Token used to authorize sample push checks.
- `WORKER_LOCK_TTL_SEC`: TTL for DB-backed worker locks (alerts worker + MQTT ingest).

## Backend ƒ?" staging vs production
- `CORS_ALLOWED_ORIGINS`: Must list trusted app/web origins; avoid wildcard in staging/prod.
- `JWT_SECRET`: Use a unique, high-entropy secret per environment; rotate on compromise or before cutovers.
- `DATABASE_URL` / `TEST_DATABASE_URL`: Point to isolated databases per environment; tests should only touch test DBs with `ALLOW_TEST_DB_RESET=true` when destructive operations are allowed.
- Logging/audit: Pino JSON logs by default; prefer centralized aggregation and immutable audit trails in staging/prod.
- `HEATPUMP_*`, `MQTT_*`, and `CONTROL_*` values should reference staging/prod services with stronger credentials and restricted network access.

## Mobile
- `EXPO_PUBLIC_API_URL`: Base URL for the backend API.
  - Dev (Android emulator): `http://10.0.2.2:4000`
  - Dev (LAN/real devices): `http://<your-lan-ip>:4000`
  - Staging: staging API host once available
  - Production: production API host once available
- Expo push: configure the Expo project and push notification credentials per environment; ensure staging devices use staging backends to avoid cross-environment pushes.
- Notification preferences: currently cached locally (alertsEnabled toggle); backend `/user/preferences` wiring TBD, so no additional env vars yet.
