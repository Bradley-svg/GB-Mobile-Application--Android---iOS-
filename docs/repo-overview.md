# Greenbro Repo Overview

_2025-12-05 sweep: backend and mobile npm install/typecheck/lint/test/build all green locally on Node 20 with Postgres 16 for backend tests._

## Repo map (current)
- `backend/`: Express API split into `src/config` (DB/CORS/env/logger), `src/controllers` (auth/sites/devices/alerts/health/heat-pump-history/telemetry stub), `src/services` (auth, telemetry ingest/read, alerts, control, push, status, users, sites/devices), `src/repositories` (users, refresh_tokens, sites, devices, telemetry points/snapshots, alerts, control_commands, push_tokens, system_status, worker_locks), `src/integrations` (MQTT, Expo push, HTTP control, Azure heat-pump history), `src/middleware` (auth, CORS, errors), `src/routes` (auth, health, sites, devices, alerts, telemetry stub, heat-pump history), `src/workers` (mqttIngest, alertsWorker), `src/scripts` (backfill snapshots, debug heat-pump history), `migrations/` (node-pg-migrate schema), `src/index.ts` entrypoint.
- `mobile/`: Expo app with `app/navigation/RootNavigator.tsx` (Auth vs App stacks; Dashboard/Alerts/Profile tabs; Site/Device/Alert detail), `app/screens` (Auth stubs, Dashboard, Site, Device with telemetry/control/history, Alerts list/detail, Profile), `app/components` (Screen, Card, PillTab, PrimaryButton, IconButton, styles), `app/api` (axios client + refresh, domain hooks for auth/sites/devices/alerts/control/heatPumpHistory, shared types), `app/store` (Zustand auth + SecureStore/AsyncStorage), `app/hooks` (push token registration), `app/theme` (tokens), `app/__tests__` (auth/nav/device/history/push/API refresh + large-list), `mobile/e2e` (Detox config, Jest circus runner, appNavigation smoke test), Android instrumentation runner under `android/app/src/androidTest/java/com/greenbro/mobile/`.
- `archive/`: Legacy copies (`archive/mobile_workdir/`, `archive/node_modules_old_unused_backup/`, `archive/logs/`) kept isolated.
- `docs/`: Repo notes and screenshots (moved `emulator-screen.png` and `screenshot.png` here). Environment variables across backend/mobile are summarised in `docs/envs.md`; deployment guide lives in `docs/deploy.md`.
- `logs/`: Git-ignored runtime logs. A few dev logs remain under root/backend while locked by running node processes.
- Helpers: root `dev.ps1`/`dev.sh`, `scripts/prepare-openai-image.js`, backend `scripts/init-local-db.js`, `src/scripts/backfillDeviceSnapshots.ts`, `src/scripts/debugHeatPumpHistory.ts`.

## Branding
- Branding source of truth: `docs/branding/README.md` (palette and asset list). App-ready assets ship under `mobile/assets/greenbro/`; originals live in `docs/branding/official/`.

## Security / npm audit (2025-12-05)
- Backend: 8 vulns (0 low / 6 moderate / 2 high / 0 critical). Highs are in dev tooling (node-pg-migrate/glob transitive); moderates are dev-only (vitest/vite/esbuild). See `backend/audit-backend.json`.
- Mobile: 3 low vulns (expo send template injection via @expo/cli). Fix requires major Expo jump (54.x); accepted until planned Expo upgrade. See `mobile/audit-mobile.json`.

## Backend
- Entrypoint: `src/index.ts` mounts CORS, JSON parsing, routers, and error handler; server start is skipped in tests.
- Layering: controllers mostly call services; `healthController` directly queries the DB and `mqttClient` health helpers; `heatPumpHistoryController` calls the integration client directly; HTTP telemetry route is an intentional 501 stub pointing to MQTT ingest.
- Config/env notes: JWT secret throws if unset in non-dev; refresh token lifetime via `REFRESH_TOKEN_DAYS`; alerts worker toggle `ALERT_WORKER_ENABLED` (defaults true) with `ALERT_WORKER_INTERVAL_SEC`; CORS allowlist required in prod; heat-pump client prefers `HEATPUMP_*` envs with deprecated `HEAT_PUMP_*` fallbacks; control channel set by MQTT or CONTROL_API_URL/CONTROL_API_KEY; telemetry HTTP ingest intentionally disabled.
- Control: throttling enforced via last control command; `/devices/:id/last-command` returns the most recent control attempt; logout and logout-all endpoints revoke refresh tokens.
- Preferences: `/user/preferences` (GET/PUT) backed by `user_preferences` (unique per user, default `alerts_enabled=true`); service returns default `alertsEnabled=true` until updated.
- Integrations: MQTT ingest on `greenbro/+/+/telemetry`; control over HTTP or MQTT; Expo push with optional health sample; Azure heat-pump history client with timeout and circuit breaker.
- Workers & concurrency: long-running workers (MQTT ingest, alerts) now take a DB-backed lease via `worker_locks` (configurable TTL with `WORKER_LOCK_TTL_SEC`); extra instances log and idle/exit.
- Health (2025-12-05 local): npm install/typecheck/lint/test/build all green with TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test and ALLOW_TEST_DB_RESET=true against Postgres 16. `/health-plus` curl showed ok:false env:development version:0.1.0-dev; db ok; mqtt configured:false healthy:true (lastErrorAt 2025-12-05T12:49:30Z); control configured:false lastError CONTROL_CHANNEL_UNCONFIGURED healthy:true; heatPumpHistory configured:true healthy:false (upstream idle); alertsWorker healthy:true; push enabled:false lastSampleAt 2025-12-05T19:10:05Z.
- Test harness: Vitest global setup (test/globalSetup.ts -> test/testDbSetup.ts) requires TEST_DATABASE_URL, runs migrations via node-pg-migrate, seeds demo org/site/device/user plus status row, and ends the test pool; truncation/seeding runs when the DB name includes "test" or ALLOW_TEST_DB_RESET=true, otherwise it seeds only to avoid wiping a shared dev DB.
- CI: GitHub Actions provisions Postgres 16 (`greenbro_test`), runs `npm run migrate:test`, and sets TEST_DATABASE_URL + ALLOW_TEST_DB_RESET for backend API tests.
- Local/dev containers: `docker-compose.dev.yml` brings up Postgres 16, MQTT, and the backend image; `.devcontainer/devcontainer.json` reuses it to provide a Node 20 workspace when opened in VS Code Dev Containers.
- Security/reliability/observability: auth uses JWT + refresh rotation; signup gated by `AUTH_ALLOW_PUBLIC_SIGNUP`; password reset not implemented; 2FA/device-trust/lockouts absent; workers renew DB locks (`worker_locks`) while running; health-plus surfaces DB/MQTT/control/push/alerts worker signals; structured JSON logging via pino with `LOG_LEVEL`; metrics/alerting pipeline still absent.

## Logging & Observability
- Current state: pino JSON logs to stdout with service/env fields; `/health-plus` remains the primary health indicator and reports DB, MQTT, control, alerts worker, and push signals.
- Future state: add log shipping/metrics (DB, MQTT, control, Azure integrations) and expose Prometheus-style scraping when needed.

## Mobile
- Navigation: RootNavigator swaps Auth vs App stacks; App tabs = Dashboard, Alerts, Profile; stack detail screens for Site, Device (telemetry charts, control commands, Azure history graph), Alert.
- API/data: axios client with refresh interceptor; React Query hooks per domain; shared `TimeRange` type reused by telemetry + history queries; auth store hydrates from SecureStore and registers an Expo push token once per user.
- Auth screens: Login is live; Signup/ForgotPassword are locked-down stubs with guidance.
- Health (2025-12-05 local): `npm install` OK (npm audit reports 3 low vulns); `npm run typecheck` OK; `npm run lint` OK; `npm test -- --runInBand` OK (jest-expo; noisy console logs by design). Latest spot run for new suites: `npm test -- --runInBand app/__tests__/DashboardLargeList.test.tsx app/__tests__/AlertsLargeList.test.tsx`.
- UX robustness: offline banner plus cached Dashboard, Site, Device, and Alerts views (read-only with commands/ack/mute disabled); telemetry shows stale-data banners; control flows include pending + throttling messaging; heat-pump history error mapping and session-expired UX covered in tests.
- Push/notifications: Profile toggle now backed by `/user/preferences` with React Query + AsyncStorage cache; keeps the OS-denied warning + Open Settings link, and `useRegisterPushToken` skips registration when backend prefs disable alerts.
- E2E: Detox wired for Android with Jest circus runner and appNavigation smoke (Login → Dashboard → Site → Device → Alerts → Profile → Logout). Scripts: `npm run e2e:build:android`, `npm run e2e:test:android` (requires Android SDK/emulator + backend dev server at http://10.0.2.2:4000).
- Large-list: Jest sanity for Dashboard and Alerts ensures FlatList virtualization props stay set with 600–800 item fixtures; offline alerts cache path covered.

## Cleanup actions
- Moved root screenshots (`emulator-screen.png`, `screenshot.png`) into `docs/`.
- Tried to consolidate stray logs; two root runtime logs and backend dev logs are locked by active node processes, so left in place (all git-ignored). `logs/` remains the intended sink.
- Removed the unused HTTP telemetry ingest helper and aligned env examples with actual usage (refresh token days, alerts worker toggle; removed unused TELEMETRY_API_KEY stub).

## Open risks / TODOs before more API work
- No 2FA or trusted-device protections yet; password reset flow still absent (manual resets only).
- Offline UX partially covered via cached Dashboard/Site/Device/Alerts views; deeper sync/retry and cache invalidation still open.
- Observability still leans on health-plus; no metrics/alerting pipeline yet.
- npm audit waivers in place (backend: 6 moderate + 2 high in dev tooling; mobile: 3 low Expo CLI) pending upstream major upgrades.
