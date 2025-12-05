# Release notes 0.1.0 (RC)

## Features
- Auth: login/refresh/me plus logout/logout-all with gated signup.
- Sites/devices: scoped dashboards, site overview, device detail with telemetry ranges (1h/24h/7d) and stale/offline banners.
- Telemetry: MQTT ingest with validation/downsampling; HTTP ingest remains a 501 stub by design.
- Control: per-device throttling/audit, `/devices/:id/last-command`, control failure_reason mapping, offline-disabled commands.
- Alerts: ingest + worker with DB-backed locks, alert list/detail with acknowledge/mute flows.
- Heat pump history: Azure-backed client with circuit breaker feeding the “Compressor current (A)” card.
- Offline: cached Dashboard/Site/Device/Alerts data (read-only), offline banner, and control disabled while offline.
- Push preferences: Profile toggle backed by `/user/preferences`, cached in AsyncStorage, gated by OS permission and Expo token registration.

## Known limitations
- No password reset flow or 2FA/trusted-device protections (resets are manual).
- Single-instance workers; no HA scheduler or leader election beyond DB locks.
- No metrics/alerting pipeline beyond `/health-plus` and logs.
- Push health-check disabled unless `EXPO_ACCESS_TOKEN` is configured; heat-pump history health depends on Azure availability.
