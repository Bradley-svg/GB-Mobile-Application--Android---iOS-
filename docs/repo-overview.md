# Greenbro Repo Overview

## Repo map (current)
- `backend/`: Express API split into `src/config` (DB/CORS/env), `src/controllers` (auth/sites/devices/alerts/health/heat-pump-history/telemetry stub), `src/services` (auth, telemetry ingest/read, alerts, control, push, status, users, sites/devices), `src/repositories` (users, refresh_tokens, sites, devices, telemetry points/snapshots, alerts, control_commands, push_tokens, system_status), `src/integrations` (MQTT, Expo push, HTTP control, Azure heat-pump history), `src/middleware` (auth, CORS, errors), `src/routes` (registration only), `src/workers` (mqttIngest, alertsWorker), `src/scripts` (backfill snapshots, debug heat-pump history), `src/sql` schemas, `src/index.ts` entrypoint.
- `mobile/`: Expo app with `app/navigation/RootNavigator.tsx` (Auth vs App stacks; Dashboard/Alerts/Profile tabs; Site/Device/Alert detail), `app/screens` (Auth stubs, Dashboard, Site, Device with telemetry/control/history, Alerts list/detail, Profile), `app/components` (Screen, Card, PillTab, PrimaryButton, IconButton, styles), `app/api` (axios client + refresh, domain hooks for auth/sites/devices/alerts/control/heatPumpHistory, shared types), `app/store` (Zustand auth + SecureStore/AsyncStorage), `app/hooks` (push token registration), `app/theme` (tokens), `app/__tests__` (auth/nav/device/history/push/API refresh).
- `archive/`: Legacy copies (`archive/mobile_workdir/`, `archive/node_modules_old_unused_backup/`, `archive/logs/`) kept isolated.
- `docs/`: Repo notes and screenshots (moved `emulator-screen.png` and `screenshot.png` here).
- `logs/`: Git-ignored runtime logs. A few dev logs remain under root/backend while locked by running node processes.
- Helpers: root `dev.ps1`/`dev.sh`, `scripts/prepare-openai-image.js`, backend `scripts/init-local-db.js`, `src/scripts/backfillDeviceSnapshots.ts`, `src/scripts/debugHeatPumpHistory.ts`.

## Security / npm audit (2025-12-04)
- Backend: 6 vulns (0 low / 6 moderate / 0 high / 0 critical). Fixed runtime `jsonwebtoken` to 9.0.3. Remaining moderates come from dev-only vitest/vite/esbuild; fixes would require major upgrades, so risk accepted for now (tooling only). See `backend/audit-backend.json`.
- Mobile: 3 low vulns (expo send template injection via @expo/cli). Fix requires major Expo jump (54.x); accepted until planned Expo upgrade. See `mobile/audit-mobile.json`.

## Backend
- Entrypoint: `src/index.ts` mounts CORS, JSON parsing, routers, and error handler; server start is skipped in tests.
- Layering: controllers mostly call services; `healthController` directly queries the DB and `mqttClient` health helpers; `heatPumpHistoryController` calls the integration client directly; HTTP telemetry route is an intentional 501 stub pointing to MQTT ingest.
- Config/env notes: JWT secret throws if unset in non-dev; CORS allowlist required in prod and allow-all only in non-prod with an empty list; heat-pump client prefers `HEATPUMP_*` env names with deprecated `HEAT_PUMP_*` fallbacks; HTTP telemetry API key env exists but route stays disabled.
- Integrations: MQTT ingest on `greenbro/+/+/telemetry`; control channel over HTTP (or MQTT) depending on env; Expo push with optional health sample; Azure heat-pump history client with timeout handling.
- Health (2025-12-04 local): `npm install` ✅ (npm audit reports 7 vulns: 6 moderate, 1 high); `npm run typecheck` ✅; `npm run lint` ✅; `npm test` ✅ (vitest; expected mock upstream error log + Vite CJS deprecation warning); `npm run build` ✅.
- Security/reliability/observability: auth uses JWT + refresh rotation, signup gated by env, reset-password returns 501; control/telemetry status recorded to `system_status` but workers run via long-lived MQTT client and `setInterval` without distributed lock/backoff; health-plus surfaces DB/MQTT/control/push/alerts worker signals; logging is console-based (no structured logs/metrics).

## Mobile
- Navigation: RootNavigator swaps Auth vs App stacks; App tabs = Dashboard, Alerts, Profile; stack detail screens for Site, Device (telemetry charts, control commands, Azure history graph), Alert.
- API/data: axios client with refresh interceptor; React Query hooks per domain; auth store hydrates from SecureStore and registers an Expo push token once per user.
- Auth screens: Login is live; Signup/ForgotPassword are locked-down stubs with guidance.
- Health (2025-12-04 local): `npm install` ✅ (npm audit reports 3 low vulns); `npm run typecheck` ✅; `npm run lint` ✅; `npm test -- --runInBand` ✅ (jest-expo; noisy console logs by design).
- UX robustness: loading/error states are basic; control command errors show inline but limited retry cues; no offline handling; push token registration does not re-run on permission changes.

## Cleanup actions
- Moved root screenshots (`emulator-screen.png`, `screenshot.png`) into `docs/`.
- Tried to consolidate stray logs; two root runtime logs and backend dev logs are locked by active node processes, so left in place (all git-ignored). `logs/` remains the intended sink.
- No code deletions this pass; HTTP telemetry stub kept intentionally.

## Open risks / TODOs before more API work
- Legacy `HEAT_PUMP_*` heat-pump envs are still accepted but deprecated; `HEATPUMP_*` is the canonical scheme.
- Consider moving DB/integration calls in `healthController`/`heatPumpHistoryController` behind services to keep the layering strict.
- Harden MQTT/alerts/control workers (reconnect/backoff, job locking/visibility) and add structured logs/metrics that feed health-plus.
- Improve mobile error/offline states and control-command feedback; add retry/backoff patterns for data fetching.
- Address or formally waive npm audit findings (backend: 6 moderate dev-tooling remaining; mobile: 3 low pending Expo major upgrade).
