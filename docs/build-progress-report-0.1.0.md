# Greenbro Build Progress Report - 0.1.0

Date: 2025-12-07  
Scope: backend API, workers, mobile app, branding, E2E tooling, staging/deploy tooling

## Executive summary
- Backend (Node 20 / Postgres 16): `npm run typecheck` (pass); `npm run lint` (pass); `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test` (pass); `npm run build` (pass).
- Mobile: `npm run typecheck` (pass); `npm run lint` (pass); `npm test -- --runInBand` (pass).
- Repo structure is clean and layered: `backend/src` now only has config/controllers/services/repositories/integrations/middleware/routes/workers/scripts/index.ts (no `domain/`, no stray utils), migrations live solely in `backend/migrations/`; mobile assets are canonical under `mobile/assets/greenbro/`.
- Major risks: no password reset/2FA/trusted device (manual recovery only); staging DNS/DB for `https://staging-api.greenbro.co.za` still missing; metrics/alerting pipeline not yet deployed (health-plus + logs only).
- Next high-value steps: provision staging DNS/DB and run bootstrap + health checks, define account recovery posture, and wire metrics plus worker HA observability.

## Repo structure snapshot (post-cleanup)
- backend/: Express API and workers
  - `src/config` (DB/env/CORS/logger), `src/controllers` (auth/sites/devices/alerts/health/heat-pump-history/telemetry stub/organisation), `src/services` (auth, telemetry ingest/read, alerts, control, push, status, sites/devices, user preferences), `src/repositories` (users, refresh_tokens, sites, devices, telemetry, alerts, control_commands, push_tokens, system_status, worker_locks, etc.), `src/integrations` (MQTT, HTTP control, Expo push, Azure heat-pump history), `src/middleware`, `src/routes`, `src/workers`, `src/scripts`, `src/index.ts`.
  - `src/domain/*` removed; organisation resolution lives in `src/controllers/organisation.ts`; `src/utils/organisation.ts` removed. `backend/sql/` snapshot folder removed; `backend/migrations/*` is the single schema source of truth.
- mobile/: Expo client
  - `app/navigation/RootNavigator.tsx` (Auth vs App; tabs Dashboard/Alerts/Profile; detail screens: Site/Device/Alert), `app/screens`, `app/components`, `app/api`, `app/store`, `app/hooks`, `app/theme`, `app/__tests__/`.
  - `mobile/assets/greenbro/` holds only `greenbro-icon-1024.png`, `greenbro-splash.png`, `greenbro-logo-horizontal.png`.
- Other: `archive/`, `docs/`, `.github/`, `scripts/`, git-ignored `logs/`. Runtime logs/tmp bundles/screenshots removed from tracked roots; `.gitignore` tightened to keep only source/docs plus canonical assets.

## Backend status
### Architecture
- Requests flow routes -> controllers -> services -> repositories -> Postgres/integrations; middleware handles auth/CORS/errors; `src/index.ts` wires routers and pino logging.
- Auth: login/refresh/me/logout/logout-all; refresh rotation stored in `refresh_tokens`.
- Control: validation/throttling plus `/devices/:id/last-command`; supports MQTT or HTTP control clients.
- Telemetry: MQTT ingest with DB-backed worker locks; HTTP ingest route intentionally 501 stub; telemetry read down-samples and enforces limits.
- Heat-pump history: Azure client with timeout + circuit breaker; `/heat-pump-history` returns normalized series/points.
- User preferences: `/user/preferences` GET/PUT backed by `user_preferences` defaults.
- Workers: `mqttIngest` and `alertsWorker` single-instance with DB leases (`worker_locks`); structured logging via pino.

### Build & tests (this pass)
- backend:  
  - `npm run typecheck` (pass)  
  - `npm run lint` (pass)  
  - `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test` (pass)  
  - `npm run build` (pass)  
- Vitest serialization is configured in `backend/vitest.config.ts` (single-threaded pool); no extra flags needed in `npm test`.

### Health & migrations
- `/health-plus` reports env, db, version, mqtt, control, heatPumpHistory, alertsWorker, push. Use `HEALTH_BASE_URL=... npm run health:check` to sample.
- Migrations live under `backend/migrations/` and run via `npm run migrate:dev` / `npm run migrate:test`; `scripts/init-local-db.js` seeds after migrations. No `backend/sql/` snapshots remain.

### Heat pump history alignment
- Client posts to `HEATPUMP_HISTORY_URL` with `x-api-key` from `HEATPUMP_HISTORY_API_KEY`, headers `Content-Type: application/json-patch+json` and `Accept: text/plain`.
- Payload matches vendor contract: flat `aggregation/from/to/mode/fields/mac`. Responses are normalized into `series[{ field, points: [{ timestamp, value }] }]`.
- Circuit breaker returns 503 (`kind: CIRCUIT_OPEN`) when tripped; upstream failures/timeouts surface as 502-style (`kind: UPSTREAM_ERROR`) with logging and status markers.

### Known backend risks
- No password reset, 2FA, or trusted-device support (manual recovery only).
- Workers rely on single-instance process with DB locks; no HA scheduler/metrics yet.
- Metrics/alerting pipeline still absent beyond logs and health-plus.

## Mobile status
### Architecture & flows
- `RootNavigator` swaps Auth vs App stacks; tabs Dashboard/Alerts/Profile with Site/Device/Alert detail stacks.
- Auth/session handling via store and refresh; Device detail shows telemetry, control, and heat-pump history card; Alerts include ack/mute; push preferences round-trip to `/user/preferences`.
- Offline: banner + cached Dashboard/Site/Device/Alerts; UI goes read-only offline (control/ack/mute disabled).

### Branding
- Canonical assets: `mobile/assets/greenbro/greenbro-icon-1024.png`, `greenbro-splash.png`, `greenbro-logo-horizontal.png`.
- Palette from `app/theme/colors.ts` matches `docs/branding/README.md` (brand greens/greys/text/gradients); no extra logo variants.

### Build & tests (this pass)
- mobile:  
  - `npm run typecheck` (pass)  
  - `npm run lint` (pass)  
  - `npm test -- --runInBand` (pass)  
- Coverage includes auth/session expiry, navigation, device detail + history (ranges and stale banners), offline banners and caches, alerts list/detail, push preferences + OS permission handling, NetInfo hook, and large FlatList virtualization tests.

### E2E / Detox
- Detox wired (`mobile/detox.config.js`, `mobile/e2e/jest.config.e2e.js`, `mobile/e2e/appNavigation.e2e.ts`, Android runner). Run with `npm run e2e:build:android` then `npm run e2e:test:android -- --headless` (backend at http://10.0.2.2:4000). Not run in this pass.

## Staging & deployment readiness
- Staging DNS/DB for `https://staging-api.greenbro.co.za` still missing, blocking staging bootstrap and health checks.
- Staging steps once available: set `STAGING_DATABASE_URL` (must include "staging"), run `npm run staging:bootstrap` to migrate + seed, then `HEALTH_BASE_URL=https://staging-api.greenbro.co.za npm run health:check` for `/health-plus`.
- Production mirrors staging with production URLs/secrets; Expo builds use `EXPO_PUBLIC_API_URL` and EAS profiles per environment.

## Open risks & prioritised next steps
- P0: Decide and implement/document password reset/2FA/trusted-device posture before wider exposure.
- P1: Provision staging DNS/DB, run `npm run staging:bootstrap` + health checks; design/ship metrics + alerting pipeline and worker HA strategy.
- P2: Broaden Detox/E2E coverage and consider richer offline guidance or optional write-back strategy.
- P3: Reduce residual test noise, continue small UX polish, and keep repo lean as new assets/configs arrive.
