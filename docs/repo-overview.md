# Greenbro Repo Overview

_2025-12-05 audit note: local verification could not be re-run in this environment because Node/npm were unavailable (package mirrors blocked by proxy). Hygiene updates removed committed Android logcat/dumpsys/UI snapshot files and expanded ignore rules for those artifacts._

## Repo map (current)
- `backend/`: Express API split into `src/config` (DB/CORS/env), `src/controllers` (auth/sites/devices/alerts/health/heat-pump-history/telemetry stub), `src/services` (auth, telemetry ingest/read, alerts, control, push, status, users, sites/devices), `src/repositories` (users, refresh_tokens, sites, devices, telemetry points/snapshots, alerts, control_commands, push_tokens, system_status), `src/integrations` (MQTT, Expo push, HTTP control, Azure heat-pump history), `src/middleware` (auth, CORS, errors), `src/routes` (registration only), `src/workers` (mqttIngest, alertsWorker), `src/scripts` (backfill snapshots, debug heat-pump history), `src/sql` schemas, `src/index.ts` entrypoint.
- `mobile/`: Expo app with `app/navigation/RootNavigator.tsx` (Auth vs App stacks; Dashboard/Alerts/Profile tabs; Site/Device/Alert detail), `app/screens` (Auth stubs, Dashboard, Site, Device with telemetry/control/history, Alerts list/detail, Profile), `app/components` (Screen, Card, PillTab, PrimaryButton, IconButton, styles), `app/api` (axios client + refresh, domain hooks for auth/sites/devices/alerts/control/heatPumpHistory, shared types), `app/store` (Zustand auth + SecureStore/AsyncStorage), `app/hooks` (push token registration), `app/theme` (tokens), `app/__tests__` (auth/nav/device/history/push/API refresh).
- `archive/`: Legacy copies (`archive/mobile_workdir/`, `archive/node_modules_old_unused_backup/`, `archive/logs/`) kept isolated.
- `docs/`: Repo notes and screenshots (moved `emulator-screen.png` and `screenshot.png` here). Environment variables across back
end/mobile are summarised in `docs/envs.md`.
- `logs/`: Git-ignored runtime logs. A few dev logs remain under root/backend while locked by running node processes.
- Helpers: root `dev.ps1`/`dev.sh`, `scripts/prepare-openai-image.js`, backend `scripts/init-local-db.js`, `src/scripts/backfillDeviceSnapshots.ts`, `src/scripts/debugHeatPumpHistory.ts`.

## Security / npm audit (2025-12-04)
- Backend: 6 vulns (0 low / 6 moderate / 0 high / 0 critical). Fixed runtime `jsonwebtoken` to 9.0.3. Remaining moderates come from dev-only vitest/vite/esbuild; fixes would require major upgrades, so risk accepted for now (tooling only). See `backend/audit-backend.json`.
- Mobile: 3 low vulns (expo send template injection via @expo/cli). Fix requires major Expo jump (54.x); accepted until planned Expo upgrade. See `mobile/audit-mobile.json`.

## Backend
- Entrypoint: `src/index.ts` mounts CORS, JSON parsing, routers, and error handler; server start is skipped in tests.
- Layering: controllers mostly call services; `healthController` directly queries the DB and `mqttClient` health helpers; `heatPumpHistoryController` calls the integration client directly; HTTP telemetry route is an intentional 501 stub pointing to MQTT ingest.
- Config/env notes: JWT secret throws if unset in non-dev; refresh token lifetime tunable via `REFRESH_TOKEN_DAYS`; alerts worker can be disabled via `ALERT_WORKER_ENABLED` (defaults true) with interval set by `ALERT_WORKER_INTERVAL_SEC`; CORS allowlist required in prod and allow-all only in non-prod with an empty list; heat-pump client prefers `HEATPUMP_*` env names with deprecated `HEAT_PUMP_*` fallbacks; HTTP telemetry route remains disabled.
- Integrations: MQTT ingest on `greenbro/+/+/telemetry`; control channel over HTTP (or MQTT) depending on env; Expo push with optional health sample; Azure heat-pump history client with timeout handling.
- Workers & concurrency: long-running workers (MQTT ingest, alerts) are intended to run as a single instance each; running multiple copies without a locking/coordination layer can double-process messages. Future hardening should add DB-backed locks or a distributed scheduler.
- Health (2025-12-05 local): `npm install` OK (npm audit reports 7 vulns: 6 moderate, 1 high); `npm run typecheck` OK; `npm run lint` OK; `npm test` OK (vitest with test DB harness; fails fast with a clear TEST_DATABASE_URL error if the DB is missing); `npm run build` OK.
- Test harness: Vitest global setup (test/globalSetup.ts -> test/testDbSetup.ts) requires TEST_DATABASE_URL, prepares schema/seed data (demo org/site/device/user plus status row), and ends the test pool; truncation/seeding runs when the DB name includes "test" or ALLOW_TEST_DB_RESET=true, otherwise it seeds only to avoid wiping a shared dev DB. `npm test` now fails fast with a clear missing/connection error instead of timing out.
- CI: GitHub Actions provisions Postgres 16 (`greenbro_test`) and sets TEST_DATABASE_URL + ALLOW_TEST_DB_RESET for backend API tests.
- Local/dev containers: `docker-compose.dev.yml` brings up Postgres 16, MQTT, and the backend image; `.devcontainer/devcontainer.json` reuses it to provide a Node 20 workspace when opened in VS Code Dev Containers.
- Security/reliability/observability: auth uses JWT + refresh rotation; signup is gated by `AUTH_ALLOW_PUBLIC_SIGNUP`; password reset is not implemented (manual admin reset only until a full token/email flow ships); logout/logout-all endpoints revoke refresh tokens; 2FA/device-trust/lockouts are not yet implemented and should be considered for future hardening. Control/telemetry status recorded to `system_status` but workers run via long-lived MQTT client and `setInterval` without distributed lock/backoff; health-plus surfaces DB/MQTT/control/push/alerts worker signals; logging is console-based (no structured logs/metrics).

## Logging & Observability
- Current state: console logs flow to stdout/stderr; `/health-plus` remains the primary health indicator and reports DB, MQTT, control, alerts worker, and push signals.
- Future state: replace `console.log/error` with a JSON logger (e.g., pino) that can ship logs to a central sink; expose metrics (DB, MQTT, control, Azure integrations) via an endpoint or Prometheus-style scraping when needed.

## Mobile
- Navigation: RootNavigator swaps Auth vs App stacks; App tabs = Dashboard, Alerts, Profile; stack detail screens for Site, Device (telemetry charts, control commands, Azure history graph), Alert.
- API/data: axios client with refresh interceptor; React Query hooks per domain; auth store hydrates from SecureStore and registers an Expo push token once per user.
- Auth screens: Login is live; Signup/ForgotPassword are locked-down stubs with guidance.
- Health (2025-12-04 local): `npm install` OK (npm audit reports 3 low vulns); `npm run typecheck` OK; `npm run lint` OK; `npm test -- --runInBand` OK (jest-expo; noisy console logs by design).
- UX robustness: loading/error states are basic; control command errors show inline but limited retry cues; no offline handling; push token registration does not re-run on permission changes.

## Cleanup actions
- Moved root screenshots (`emulator-screen.png`, `screenshot.png`) into `docs/`.
- Tried to consolidate stray logs; two root runtime logs and backend dev logs are locked by active node processes, so left in place (all git-ignored). `logs/` remains the intended sink.
- Removed the unused HTTP telemetry ingest helper and aligned env examples with actual usage (refresh token days, alerts worker toggle; removed unused TELEMETRY_API_KEY stub).

## Open risks / TODOs before more API work
- Legacy `HEAT_PUMP_*` heat-pump envs are still accepted but deprecated; `HEATPUMP_*` is the canonical scheme.
- Consider moving DB/integration calls in `healthController`/`heatPumpHistoryController` behind services to keep the layering strict.
- Harden MQTT/alerts/control workers (reconnect/backoff, job locking/visibility) and add structured logs/metrics that feed health-plus.
- Improve mobile error/offline states and control-command feedback; add retry/backoff patterns for data fetching.
- Address or formally waive npm audit findings (backend: 6 moderate dev-tooling remaining; mobile: 3 low pending Expo major upgrade).
