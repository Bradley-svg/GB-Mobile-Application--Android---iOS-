# Release notes 0.1.0 (RC)

## Features
- Auth: login/refresh/me plus logout/logout-all with gated signup.
- Sites/devices: scoped dashboards, site overview, device detail with telemetry ranges (1h/24h/7d) and stale/offline banners.
- Telemetry: MQTT ingest with validation/downsampling; HTTP ingest remains a 501 stub by design.
- Control: per-device throttling/audit, `/devices/:id/last-command`, control failure_reason mapping, offline-disabled commands.
- Alerts: ingest + worker with DB-backed locks, alert list/detail with acknowledge/mute flows.
- Heat pump history: Azure-backed client with circuit breaker feeding the "Compressor current (A)" card.
- Offline: cached Dashboard/Site/Device/Alerts data (read-only), offline banner, and control disabled while offline.
- Push preferences: Profile toggle backed by `/user/preferences`, cached in AsyncStorage, gated by OS permission and Expo token registration.

## Known limitations
- No password reset flow or 2FA/trusted-device protections (resets are manual).
- Single-instance workers; no HA scheduler or leader election beyond DB locks.
- No metrics/alerting pipeline beyond `/health-plus` and logs.
- Push health-check disabled unless `EXPO_ACCESS_TOKEN` is configured; heat-pump history health depends on Azure availability.

## Verification
- Backend RC validation: `STAGING_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_staging npm run staging:bootstrap` (env guard dry-run) plus npm run typecheck, npm run lint, TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test npm test, npm run build, and HEALTH_BASE_URL=http://localhost:4000 npm run health:check against dev.
- Mobile RC validation: npm run typecheck, npm run lint, npm test -- --runInBand.

## Staging verification (2025-12-05 attempt)
- Status: blocked - staging backend host `https://staging-api.greenbro.co.za` does not resolve yet, so no staging smoke test was executed.
- Pending when staging is reachable: seed demo data via `scripts/init-local-db.js`, then confirm Login -> Dashboard -> Site -> Device (telemetry/history) -> Alerts (ack/mute) -> Profile (preferences toggle) -> Logout against `/health-plus` showing env production and version 0.1.0.
- Expected staging quirks to document when live: control likely unconfigured (CONTROL_CHANNEL_UNCONFIGURED), heat-pump history optional until Azure credentials are wired; DB/alerts worker should report healthy for ok:true.

## Staging 0.1.0 verification: 2025-12-07
Staging remains blocked: staging-api.greenbro.co.za does not resolve and no staged DATABASE_URL is provisioned, so `npm run staging:bootstrap` and `npm run health:check` have not been executed. RC readiness is pending until DNS + Postgres for greenbro_staging are in place and seeds/health checks run cleanly.
