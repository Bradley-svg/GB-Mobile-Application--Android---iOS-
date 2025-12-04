# Greenbro Repo Overview

## Repo structure
- `backend/` – Node/Express API; owns auth, sites/devices CRUD, telemetry ingest, alerts/notifications, control commands, workers, SQL, and local DB init.
- `mobile/` – Expo React Native app (TS) with navigation, API hooks, theme primitives, auth store, and tests.
- `archive/` – Legacy/mobile backup (`archive/mobile_workdir` with its own app copy), old node_modules backup, archived logs; not referenced by current code.
- `docs/` – Screenshots and dev notes; no runtime imports.
- `logs/` – Local runtime logs; ignored by git and unused by code.
- `.github/` – CI workflow for backend and mobile.
- Root helpers: `dev.ps1`/`dev.sh`, README, repo-level git config; stray PNGs/logs at root appear to be local captures, not used by builds.

## Backend (API)
- **Entry points**: `src/index.ts` (Express app), `src/workers/mqttIngest.ts` (telemetry ingest), `src/workers/alertsWorker.ts` (alert evaluation). Script entry: `src/scripts/backfillDeviceSnapshots.ts`. Runtime compiled to `dist/`.
- **Source layout**:
  - `src/db/pool.ts` – pg Pool bootstrap; throws if `DATABASE_URL` missing.
  - `src/middleware/` – auth guard, CORS builder, error handler.
  - `src/routes/` – `healthRoutes` (health/health-plus), `authRoutes`, `siteRoutes`, `deviceRoutes`, `alertRoutes`, `telemetryRoutes` (501 stub for HTTP ingest).
  - `src/services/` – auth/refresh token logic, site/device queries, telemetry ingest/parser, telemetry read API, MQTT client health, control channel (HTTP or MQTT) + status recording, alerts CRUD, push notifications + health check, user context helpers.
  - `src/workers/` – `mqttIngest` wires MQTT messages into telemetry ingest service; `alertsWorker` does offline/high-temp checks and heartbeats.
  - `src/scripts/` – `backfillDeviceSnapshots` utility.
- **SQL**: `backend/sql/*.sql` for telemetry, alerts, control commands, push tokens, refresh tokens, system status schemas. `scripts/init-local-db.js` seeds demo org/site/device, telemetry history, snapshots, and alerts.
- **npm scripts (backend/package.json)**: `dev`, `dev:mqtt`, `dev:alerts`, `script:backfill-snapshots`, `build`, `start`, `typecheck`, `lint`, `test`, `test:watch`.
- **Tests**: Vitest in `backend/test/**/*.test.ts` covering auth routes/config, site/device scoping, telemetry ingest parsing (MQTT + HTTP helper), telemetry read API, device control API/service, alerts worker (offline/high-temp) and ack/mute flows, push service, health-plus, app bootstrap. Coverage focuses on business logic and request handling; DB mocked in most suites.

## Mobile (Expo app)
- **Entry**: `index.js` → `App.tsx`; App hydrates auth store, fetches `/auth/me`, registers push token, then renders `RootNavigator`.
- **Layout**:
  - `app/navigation/RootNavigator.tsx` – auth vs app stacks, tabs for Dashboard/Alerts/Profile, detail screens for Site/Device/Alert.
  - `app/screens/` – Auth (Login/Signup/ForgotPassword stubs), Dashboard, Site overview, Device detail (telemetry + commands), Alerts list/detail, Profile.
  - `app/api/` – `client.ts` (axios with refresh interceptor), `hooks.ts` (React Query hooks for auth/sites/devices/alerts/commands), `fakeData.ts` (unused mock data).
  - `app/store/authStore.ts` – zustand + SecureStore/AsyncStorage auth persistence.
  - `app/hooks/useRegisterPushToken.ts` – expo-notifications token registration + backend POST.
  - `app/theme/` – colors/spacing/typography + shared UI primitives in `components.tsx`.
  - `app/constants/pushTokens.ts`, `app/__tests__/` for component/hooks/API tests, `structure-notes.ts` (comments only).
- **npm scripts (mobile/package.json)**: `start`, `android`, `ios`, `web`, `typecheck`, `lint`, `test`, `test:watch`.
- **Tests**: Jest/Jest-Expo suites in `app/__tests__`: App hydration/auth fetch, axios refresh interceptor, navigation flow, device detail telemetry rendering, hooks (React Query) and push-token hook behaviour. Uses jest mocks for React Native/Expo.

## Archive, docs, logs
- `archive/mobile_workdir/` is a legacy Expo app copy with its own node_modules; not imported anywhere (confirmed via ripgrep).
- `archive/logs/` and `logs/` contain historical/local logs; not referenced by code.
- `docs/` holds screenshots and `dev-setup.md`; no code imports.

## CI
- `.github/workflows/ci.yml` runs on push/PR:
  - Backend job (`working-directory: backend`): `npm ci`, `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run build`.
  - Mobile job (`working-directory: mobile`): `npm ci`, `npm run typecheck`, `npm run lint`, `npm test -- --runInBand` with `EXPO_PUBLIC_API_URL` set.

## Health matrix (commands not executed in this analysis; status reflects expected/unknown)
- Backend: typecheck – not run (CI target), lint – not run (CI target), tests – not run (CI target), build – not run (CI target).
- Mobile: typecheck – not run (CI target), lint – not run (CI target), tests – not run (CI target), build – not defined (no build script; Expo handles bundling).

## Known vulnerabilities / audit
- No npm audit config or advisory files present; no documented vulnerabilities in repo. Dependencies rely on upstream; rerun `npm audit` per package when ready.

## Dead code / redundancy candidates (not removed yet)
- Backend:
  - `backend/src/services/statusService.ts#getStatus` (+ `StatusRecord` type) – exported but unused anywhere; appears to be a leftover accessor; safe to drop or move behind a status repository if needed later.
  - HTTP telemetry ingest implementation (`backend/src/services/telemetryIngestService.handleHttpTelemetryIngest`) and `backend/src/routes/telemetryRoutes.ts` – handler is tested but route responds `501`, so HTTP path is effectively disabled; decide whether to wire it in when enabling HTTP providers or remove the stub to avoid confusion.
- Mobile:
  - `mobile/app/api/fakeData.ts` – mock site/device data helpers unused across app/tests; safe to delete or move to storybook fixture if ever used.
  - `mobile/app/api/hooks.ts` exports `useSignup` and `useResetPassword` but screens are static stubs that never call them; either wire to backend or remove to reduce bundle surface.
  - `mobile/app/structure-notes.ts` – comments only; harmless but could be moved to docs if typecheck noise arises.
  - `mobile/empty_tmp_for_delete/` – empty placeholder directory; can be removed.
- Archive/legacy: `archive/mobile_workdir/` and `archive/node_modules_old_unused_backup/` remain unused; keep quarantined.
- Assets: root-level PNG/log files (e.g., `login.png`, `device.png`, `screen.png`, `backend*.log`) are not referenced by code; consider moving to `docs/` or pruning.

## Proposed Restructure (not yet applied)
- Backend target layout:
  - `src/config/` – env loaders, db pool (`db/pool.ts`), CORS/options; move `middleware/corsConfig.ts` pieces here with config objects.
  - `src/routes/` – Express route registrations only (keep current files, slim to routing concerns).
  - `src/controllers/` – HTTP handlers per domain; split current route logic (auth/site/device/alerts/health/telemetry) out of routes.
  - `src/services/` – business logic (auth/login/register/refresh, alerts evaluation, control orchestration, telemetry ingest/read, push health).
  - `src/repositories/` – DB-facing modules (users, refresh tokens, sites, devices, telemetry points/snapshots, alerts, system_status, control_commands).
  - `src/integrations/` – external IO (MQTT client, Expo push, HTTP control client/SDK, future HTTP telemetry provider).
  - `src/middleware/` – auth guard, error handler, rate limits.
  - `src/workers/` – `alertsWorker`, `mqttIngest`, `scripts/backfillDeviceSnapshots`.
  - `src/domain/` – shared types/interfaces (Alert, TelemetryPayload, Status snapshots).
  - `src/utils/` – helpers (topic parsing, error normalization, rate-limit keys).
  - `index.ts` – app bootstrap only.
  - Sample moves: `src/db/pool.ts` → `src/config/db.ts`; `services/statusService.ts` → split into `repositories/statusRepository.ts` + `services/statusService.ts`; `services/mqttClient.ts` → `integrations/mqtt/client.ts`; `services/pushService.ts` → `integrations/push/expoService.ts`; controllers extracted from each `routes/*`.
- Mobile target layout:
  - `app/screens/` grouped by feature (`Auth/`, `Dashboard/`, `Site/`, `Device/`, `Alerts/`, `Profile/`) – keep, but move related UI helpers nearby (e.g., Alert card components) or to `components/`.
  - `app/components/` – shared primitives (`Screen`, `Card`, `PillTab`, `PrimaryButton`, etc.; move from `theme/components.tsx`) and any reusable tiles/cards.
  - `app/navigation/` – existing RootNavigator plus route typing.
  - `app/api/` – `client.ts`, `types.ts`, `hooks/` split by domain (auth/sites/devices/alerts/control), test fixtures; drop unused `fakeData.ts`.
  - `app/store/` – auth store (and future domain stores).
  - `app/theme/` – tokens only (colors/spacing/typography); components move to `components/`.
  - `app/hooks/` – cross-cutting hooks (push token, auth hydration helpers).
  - `app/utils/` – formatting helpers (dates, metrics).
  - Tests either colocated or under `app/tests/` as desired; align jest paths.
  - Clean up: remove `empty_tmp_for_delete/`; move `structure-notes.ts` to docs if still useful.
  - Navigation/component naming: standardise `*Screen.tsx`, `*Card.tsx`, `*Chart.tsx`, `*Section.tsx`.
- Phase grouping: PR1 – moves/renames + import path updates only; PR2 – delete dead code/assets; PR3 – refactors (controllers/services split, repositories); PR4 – optional infra (CI, devcontainer, stricter TS).

## Application Health (pre-refactor snapshot)
- Backend:
  - **Type safety**: `tsconfig` strict + rootDir/outDir set; uses explicit types in services. DB layer relies on `process.env.DATABASE_URL` throw at import time (can break tests without env), and widespread `any` allowed by ESLint rule downgrade.
  - **Linting**: ESLint recommended + @typescript-eslint; unused vars only warn (may hide dead code); no prettier formatting.
  - **Tests**: Good coverage of auth tokens/routes, site/device scoping, telemetry ingest validation, health-plus, device control API/service, alerts worker logic, push health. Gaps: no integration/e2e against real Postgres or MQTT; limited coverage of error paths in control HTTP client and CORS config.
  - **Known risks**: security – CORS allows all in non-prod; JWT secret default `dev-secret` unless env set; password reset unimplemented; control HTTP path trusts env without mTLS; refresh tokens stored but no IP/device binding. Reliability – MQTT ingest depends on env with minimal reconnect/backoff logic; alerts worker uses setInterval without job lock; HTTP telemetry stub disabled; status recording may silently swallow errors. Observability – limited logging/metrics; no structured logs.
- Mobile:
  - **Type safety**: strict TS; axios types; React Query hooks typed. Some any leakage via mocked data.
  - **Linting**: ESLint recommended rules; React/React Hooks plugins enabled; minimal custom rules (react-in-jsx-scope off). No automatic formatting enforcement.
  - **Tests**: Covers auth hydration and refresh retry, navigation gating, device detail rendering (telemetry + commands), push token hook. Gaps: no coverage for Alerts detail interactions (ack/mute), Dashboard metrics formatting, error/empty states, network failure handling, control command error UX.
  - **Known risks**: security – no biometric/session timeout; push token registration skips device checks on simulator; API base URL baked via env, no runtime override UI. UX/reliability – loading/error states basic; control command UI may not surface backend errors; forgot password/signup screens are stubs; offline handling absent.

### Traffic lights
- Auth: 🟡 – JWT + refresh rotation exist, but no password reset and signup generally disabled; mobile lacks session expiry UX.
- Telemetry ingest: 🟡 – MQTT path validated/tested; HTTP ingest disabled; no backpressure/duplicate handling; status health depends on system_status row presence.
- Alerts/worker: 🟡 – worker logic tested; no distributed lock/cron guard; heartbeat only in DB.
- Control/commands: 🟡 – supports HTTP or MQTT but relies on env; limited error surfacing to clients; no audit trail beyond control_commands.
- Mobile navigation/auth gating: ✅ – clear auth gate with hydration and state-driven navigator; tested.
- Mobile telemetry UI: 🟡 – renders charts/cards but limited error/empty handling and no retry/backoff cues.
- Push notifications: 🟡 – Expo send path and health sample exist; requires EXPO_ACCESS_TOKEN/PUSH_HEALTHCHECK_* env; client registers token once and never refreshes on permission changes.

## Phased refactor plan (not applied yet)
- **Phase 1: File moves + path cleanups (no behaviour change)**
  - Move backend into config/controllers/services/repositories/integrations as outlined; update imports/index bootstrap accordingly.
  - Move mobile UI primitives to `app/components/`, reorganise API hooks into subfolders, delete `empty_tmp_for_delete/`.
  - Re-run: `npm run typecheck && npm run lint && npm test && npm run build` in backend; `npm run typecheck && npm run lint && npm test` in mobile.
- **Phase 2: Delete clearly dead code/assets**
  - Remove backend `getStatus` helper if unused after Phase 1; drop HTTP telemetry stub or wire it intentionally; prune root PNG/log clutter.
  - Remove `app/api/fakeData.ts`, unused hooks (`useSignup`, `useResetPassword`) if not wired, `structure-notes.ts` (move to docs).
  - Re-run same test/typecheck suites.
- **Phase 3: Small internal refactors**
  - Split route handlers into controllers; tighten repository typing; introduce shared domain types; add error normalization in control/telemetry paths; improve status/push health reporting.
  - Add richer UI states (errors/empty/loading) and control command error toasts; refresh push token on permission change.
  - Re-run full lint/typecheck/test.
- **Phase 4: Optional improvements**
  - CI: add backend lint/typecheck caching, coverage upload, mobile detox/e2e placeholder; add npm audit or snyk job.
  - Tooling: devcontainer/docker-compose for Postgres + MQTT, add `.env.example` parity checks, stricter ESLint (no-explicit-any on), TS path aliases.
  - Consider observability (structured logging, health metrics), job scheduling with durable worker (bull/cron + locks), and feature flags for telemetry provider selection.
