# Operational Readiness Checklist

Use this checklist before staging/production releases to confirm core services and clients are configured.

## Backend
- [ ] `.env`/secrets populated for the target environment (dev/staging/prod) with:
  - `PORT`, `NODE_ENV`, `APP_VERSION`
  - `DATABASE_URL` / `TEST_DATABASE_URL` (plus `STAGING_DATABASE_URL` for bootstrap scripts)
  - `CORS_ALLOWED_ORIGINS`
  - `JWT_SECRET`, `REFRESH_TOKEN_DAYS`, `AUTH_ALLOW_PUBLIC_SIGNUP`
  - File storage: `FILE_STORAGE_ROOT`, `FILE_STORAGE_BASE_URL`, `FILE_SIGNING_SECRET`
  - Antivirus: `AV_SCANNER_ENABLED`, `AV_SCANNER_CMD` **or** `AV_SCANNER_HOST` + `AV_SCANNER_PORT`
  - Push: `EXPO_ACCESS_TOKEN`, `PUSH_HEALTHCHECK_ENABLED`, `PUSH_HEALTHCHECK_TOKEN`, `PUSH_HEALTHCHECK_INTERVAL_MINUTES`
  - MQTT ingest: `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`
  - Alerts worker: `ALERT_OFFLINE_MINUTES`, `ALERT_OFFLINE_CRITICAL_MINUTES`, `ALERT_HIGH_TEMP_THRESHOLD`, `ALERT_RULE_REFRESH_MINUTES`, `ALERT_WORKER_INTERVAL_SEC`, `WORKER_LOCK_TTL_SEC`, `ALERT_WORKER_ENABLED`
  - Control API: `CONTROL_API_URL`, `CONTROL_API_KEY`, `CONTROL_COMMAND_THROTTLE_MS`
  - Heat-pump history: `HEATPUMP_HISTORY_URL`, `HEATPUMP_HISTORY_API_KEY`, `HEATPUMP_HISTORY_TIMEOUT_MS`
  - Ensure CI-only disable flags are **false** in staging/prod: `HEATPUMP_HISTORY_DISABLED`, `CONTROL_API_DISABLED`, `MQTT_DISABLED`, `PUSH_NOTIFICATIONS_DISABLED`
  - Health probes/scripts: `HEALTH_BASE_URL`
  - Local demo data: `DEMO_USER_PASSWORD` (optional override for seeded users)
- [ ] Database migrations applied via `npm run migrate:dev` (or environment-specific) and DB seeded where appropriate.
- [ ] File storage root is writable and AV scan path reachable; signed URL secret set and distinct from JWT secret.
- [ ] `/health-plus` returns `ok: true` with populated sections for db/storage and any enabled integrations.
- [ ] Heat-pump history upstream reachable and organisation scoping verified for the target tenant.
- [ ] RBAC policies verified for owner/admin/facilities/contractor across auth, alerts, work orders, documents, and file download routes.

## Mobile
- [ ] `EXPO_PUBLIC_API_URL` points at the correct environment API (dev/staging/prod) and is reflected in `eas.json` profiles.
- [ ] Expo EAS credentials available for the release channel/profile being built.
- [ ] Feature flags set appropriately (e.g., `EXPO_PUBLIC_USE_SIGNED_FILE_URLS`, signed file URLs, any gating for heat-pump history).
- [ ] Detox config targets `Pixel_7_API_34` and Metro port matches `reversePorts` (default 8081 unless overridden).
- [ ] Push notifications tested end-to-end against the target Expo project (token registration + backend push dispatch).
- [ ] Branded assets validated (icon/splash/header) and theme mode (light/dark/system) manually smoke tested.
- [ ] Theming rollout completed across all screens; error surfaces share the unified palette.
- [ ] Unused styles cleaned; rule ready to promote to error after next release stabilization.
- [ ] Navigation/data error guards added on mobile screens.
