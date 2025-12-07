# Greenbro Build Progress Report - 0.1.0

Date: 2025-12-07  
Scope: backend API, workers, mobile app, branding, E2E, staging/deploy tooling

## Executive summary
- Backend and mobile are fully green on this pass: typecheck, lint, tests, and build all completed (backend on Node 20/Postgres 16; mobile Jest with `--runInBand`).
- Final hygiene: removed unused backend `src/domain/*` + controller util by inlining types/moving the org resolver into controllers, deleted stray logs/emulator screenshots/tmp bundles from repo/mobile roots, and tightened `.gitignore` (`build/`, `*.dmp`, no blanket ignore for `mobile/*.png|*.jpg`).
- Staging remains blocked on DNS/DB provisioning for https://staging-api.greenbro.co.za; bootstrap and health-check scripts are ready once hosts exist.
- Branding confirmed: only approved GREENBRO icon/splash/horizontal logo from `docs/branding/official/` and palette from `app/theme/colors.ts`.
- Major open risks: no password reset/2FA, single-instance workers without HA/metrics pipeline, staging infra absent, and push/heat-pump integrations optional per env.
- Next steps: bring up staging DNS/DB, run `npm run staging:bootstrap` + `npm run health:check`, execute Detox smoke, and decide on account recovery/security posture.

## Backend Status
### Architecture snapshot
- Express API with controllers/middleware/routes feeding services and repositories; integrations for MQTT ingest/control, HTTP control, Expo push, Azure heat-pump history; worker processes for mqttIngest and alertsWorker; scripts for snapshot backfill, heat-pump debug, and staging bootstrap; migrations under `backend/migrations/` via node-pg-migrate (legacy `sql/*.sql` snapshots removed to avoid drift).
- Features: auth with refresh/logout/logout-all; device control with throttle and `/devices/:id/last-command`; telemetry ingest/read with validation and downsampling; Azure heat-pump history client with circuit breaker/timeout; user preferences persisted via `/user/preferences`; worker locks for MQTT/alerts; structured pino logging to stdout.

### Build & tests (current state)
- Confirmed green this sweep: `npm run typecheck`, `npm run lint`, `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test`, `npm run build`.
- Cleanup this sweep: removed `src/domain/*` and the controller org util in favor of repository/service-local types and `src/controllers/organisation.ts`; backend/sql remains removed; `.gitignore` now also ignores `build/`/`*.dmp` and no longer hides `mobile/*.png|*.jpg`.
- Vitest serialization is configured in `backend/vitest.config.ts` (`fileParallelism:false`, `maxConcurrency:1`, `pool:threads` with `singleThread:true`); invocation is plain `npm test` (no `--runInBand`).
- CI backend job (`.github/workflows/ci.yml`): Node 20 with Postgres 16 service; runs `npm run migrate:test` with TEST_DATABASE_URL/ALLOW_TEST_DB_RESET, then `npm test`, then `npm run build`.

### Runtime health snapshot
- `/health-plus` payload includes env, db, version, mqtt, control, heatPumpHistory, alertsWorker, push with timestamps and ok flag.
- Latest captured dev sample (2025-12-05 in `docs/dev-run-notes.md`): `ok:true`, env `development`, db `ok`, version `0.1.0-dev`; mqtt configured:false healthy:true; control configured:false healthy:true with lastError `CONTROL_CHANNEL_UNCONFIGURED`; heatPumpHistory configured:false healthy:true; alertsWorker healthy:true; push enabled:false with lastSampleAt recorded. Not rerun in this sweep.
- When heat-pump history is configured but upstream idle (prior run), `ok` flips false with `heatPumpHistory.healthy:false`; control stays healthy when unconfigured unless an error is recent.

### Migrations & staging bootstrap
- Migrations live in `backend/migrations/` and run via node-pg-migrate (`npm run migrate:dev` / `npm run migrate:test` using DATABASE_URL/TEST_DATABASE_URL); legacy `sql/*.sql` schemas were removed this pass to keep migrations authoritative.
- `npm run staging:bootstrap` enforces `STAGING_DATABASE_URL` containing "staging", applies migrations against it (`npm run migrate:dev` with DATABASE_URL override), then seeds demo data via `scripts/init-local-db.js`, outputting a JSON summary.
- Supporting scripts: `npm run health:check` (expects HEALTH_BASE_URL) and `npm run staging:bootstrap:raw` for manual bootstrap flows.

### Risks & TODOs (backend)
- Password reset/2FA/trusted device flows not implemented (manual recovery only).
- Workers run as single instances despite DB locks; HA strategy and metrics/alerting pipeline still absent.
- `npm audit` moderates/highs remain in dev tooling (node-pg-migrate/glob, vitest/vite/esbuild); runtime deps are clear.

## Mobile Status
### App structure snapshot
- RootNavigator swaps Auth vs App stacks; App tabs: Dashboard, Alerts, Profile; detail stacks for Site, Device, and Alert screens.
- Domains covered: auth/session refresh, telemetry + compressed history ranges, control commands with throttle messaging, alert list/detail with ack/mute, notification preferences bound to `/user/preferences`, offline caching for Dashboard/Site/Device/Alerts.

### Branding
- Runtime assets come from `mobile/assets/greenbro/`: `greenbro-icon-1024.png` (icon/adaptive icon), `greenbro-splash.png` (splash), `greenbro-logo-horizontal.png` (login/headers); sources align with `docs/branding/official/`.
- Colours derive from `app/theme/colors.ts` and match the documented palette (brand greens #39B54A/#2D9C3E, greys, text, background, gradients).
- Do-not rules upheld: no fake SVG lockups or "GREEN BRO" variants; only approved GREENBRO mark with gear.

### Build & tests (current state)
- Confirmed green: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`.
- Cleanup this sweep: deleted emulator screenshots/Metro/logcat/bundle tmp from the mobile root so only canonical assets live under `assets/greenbro/`.
- Jest coverage spans auth/session expiry, client refresh, navigation, device detail/history (1h/24h/7d + stale banners), offline banners and cached lists, alert detail ack/mute, push preference toggle, NetInfo banner, and large FlatList virtualization tests.
- Detox is wired (`detox.config.js`, `e2e/jest.config.e2e.js`, Android runner, `e2e/appNavigation.e2e.ts` smoke path); not re-run in this pass per dev notes.

### Offline, control, and push UX
- Offline banner driven by NetInfo via `safeNetInfo`; hook supports both native NetInfo present and fallback when the module is missing. Jest mock uses full `NetInfoState` shape.
- Dashboard/Site/Device/Alerts render cached data read-only when offline; control commands, ack, and mute disable with messaging. Control UI shows pending/throttling state and last-command panel with backend `failure_reason` mapping.
- Push preferences toggle ties to `/user/preferences`, respects OS permission, and gates Expo token registration accordingly.

### Risks & TODOs (mobile)
- No offline write-back/queuing for commands or alerts; offline mode remains read-only.
- Detox coverage limited to navigation smoke; no long-run/stress or device-matrix E2E yet.
- Future UX depth for history ranges, richer charts, and clearer "read-only cached" indicators.

## E2E & Deployment Readiness
- **E2E / Detox:** Android config present with `npm run e2e:build:android` and `npm run e2e:test:android` (headless, Jest circus). Current coverage is navigation/login->dashboard->site->device->alerts->profile->logout. Last noted run was prior sweep; not executed in this pass.
- **Staging & production:** Staging DNS/DB for `https://staging-api.greenbro.co.za` still pending, so no staging smoke yet. Once available: set DATABASE_URL/JWT_SECRET/APP_VERSION/HEATPUMP_*/CONTROL_*/WORKER_LOCK_TTL_SEC/ALERT_WORKER_* and related envs, run `npm run staging:bootstrap`, then `HEALTH_BASE_URL=https://staging-api.greenbro.co.za npm run health:check`. Build staging mobile pointing EXPO_PUBLIC_API_URL to the staging host. Production follows the same flow with production URLs/secrets.

## Open Risks & Recommended Next Steps
- **P0 - Account recovery/security:** Decide on password reset/2FA/trusted-device posture; add security/legal sign-off before production exposure.
- **P1 - Staging & observability:** Bring up staging DNS/DB and run `npm run staging:bootstrap` + health checks; add metrics/alerting pipeline and define HA/worker strategy beyond single-instance locks.
- **P2 - UX/scale:** Add offline write-back or clearer offline guidance for commands/alerts; expand history/telemetry UX and broaden Detox/E2E coverage beyond navigation smoke.
- **P3 - Polish:** Triage residual test warnings/noise, continue repo cleanup, and optionally harden branding delivery (additional asset sizes/dev-client rebuild with bundled NetInfo).

## Staging verification - 2025-12-07
- `npm run staging:bootstrap`: not run (no STAGING_DATABASE_URL available; staging Postgres not provisioned yet; script guard still requires DB name containing "staging").
- `npm run health:check`: not run (staging-api.greenbro.co.za does not resolve; awaiting DNS + staged DATABASE_URL before setting HEALTH_BASE_URL).
- Manual smoke: blocked (no staging backend/app build; will run login -> dashboard -> site -> device -> alerts -> profile -> logout once staging API is live).
- Detox navigation E2E: not run (staging backend unavailable and no staging app build/emulator session for this pass).
