# Greenbro Repo Overview

## Repo structure
- `backend/` – Node/Express API; owns auth, sites/devices CRUD, telemetry ingest, alerts/notifications, control commands, workers, SQL, and local DB init. Source now split into `src/config`, `src/controllers`, `src/services`, `src/repositories`, `src/integrations`, `src/middleware`, `src/workers`, `src/domain`, and `src/utils`.
- `mobile/` – Expo React Native app (TS) with navigation, API hooks, shared components, auth store, and tests.
- `archive/` – Legacy/mobile backup (`archive/mobile_workdir` with its own app copy), old node_modules backup, archived logs; not referenced by current code.
- `docs/` – Screenshots and dev notes; no runtime imports.
- `logs/` – Local runtime logs; ignored by git and unused by code. Root log/dump captures have been moved here.
- `.github/` – CI workflow for backend and mobile.
- Root helpers: `dev.ps1`/`dev.sh`, README, repo-level git config; stray PNGs/screenshots moved into `docs/`.

## Backend (API)
- **Entry points**: `src/index.ts` (Express app), `src/workers/mqttIngest.ts` (telemetry ingest), `src/workers/alertsWorker.ts` (alert evaluation). Script entries: `src/scripts/backfillDeviceSnapshots.ts` and `src/scripts/debugHeatPumpHistory.ts`. Runtime compiled to `dist/`.
- **Source layout**:
  - `src/config/` – env loaders and wiring (`config/db.ts`, CORS settings).
  - `src/middleware/` – auth guard, CORS builder, error handler.
  - `src/controllers/` – `authController`, `siteController`, `deviceController`, `alertController`, `healthController`, `telemetryController`.
  - `src/routes/` – Express routers that wire controllers for health/auth/site/device/alert/telemetry.
  - `src/services/` – auth/refresh token logic, site/device orchestration, telemetry ingest/parser, telemetry read API, control channel orchestration + status recording, alerts CRUD, push notifications + health check, user context helpers.
  - `src/repositories/` – DB accessors for users/refresh tokens, sites/devices, telemetry points/snapshots, alerts, control commands, push tokens, system_status.
  - `src/integrations/` – MQTT ingest client, HTTP control client, Expo push wrapper.
  - `src/workers/` – `mqttIngest` wires MQTT messages into telemetry ingest service; `alertsWorker` does offline/high-temp checks and heartbeats.
  - `src/domain/` – shared types (alerts, status, telemetry).
  - `src/utils/` – helpers (organisation resolution, etc.).
  - `src/scripts/` – `backfillDeviceSnapshots` utility and `debugHeatPumpHistory` payload probe.
- **SQL**: `backend/sql/*.sql` for telemetry, alerts, control commands, push tokens, refresh tokens, system status schemas. `scripts/init-local-db.js` seeds demo org/site/device, telemetry history, snapshots, and alerts.
- **External APIs**: control HTTP provider (`CONTROL_API_URL`/`CONTROL_API_KEY`), Expo push (`EXPO_ACCESS_TOKEN`), heat pump history (`HEATPUMP_HISTORY_URL` defaulting to the Azure endpoint + `HEATPUMP_HISTORY_API_KEY` for secure calls; Azure accepts the vendor payload with top-level `aggregation/from/to/mode/fields/mac` and responds with `series[].data` pairs that the client normalizes).
- **npm scripts (backend/package.json)**: `dev`, `dev:mqtt`, `dev:alerts`, `script:backfill-snapshots`, `script:debug:heat-pump-history`, `build`, `start`, `typecheck`, `lint`, `test`, `test:watch`.
- **Tests**: Vitest in `backend/test/**/*.test.ts` covering auth routes/config, site/device scoping, telemetry ingest parsing (MQTT + HTTP helper), telemetry read API, device control API/service, alerts worker (offline/high-temp) and ack/mute flows, push service, health-plus, app bootstrap. Coverage focuses on business logic and request handling; DB mocked in most suites.

## Mobile (Expo app)
- **Entry**: `index.js` → `App.tsx`; App hydrates auth store, fetches `/auth/me`, registers push token, then renders `RootNavigator`.
- **Layout**:
  - `app/navigation/RootNavigator.tsx` – auth vs app stacks, tabs for Dashboard/Alerts/Profile, detail screens for Site/Device/Alert.
  - `app/screens/` – Auth (Login/Signup/ForgotPassword stubs), Dashboard, Site overview, Device detail (telemetry + commands), Alerts list/detail, Profile.
  - `app/components/` – shared primitives (`Screen`, `Card`, `PillTab`, `PrimaryButton`, `IconButton`, `surfaceStyles`).
  - `app/api/` – `client.ts` (axios with refresh interceptor), `types.ts`, domain hook modules (`auth/hooks.ts`, `sites/hooks.ts`, `devices/hooks.ts`, `alerts/hooks.ts`, `control/hooks.ts`) with `hooks.ts` re-export.
  - `app/store/authStore.ts` – zustand + SecureStore/AsyncStorage auth persistence.
  - `app/hooks/useRegisterPushToken.ts` – expo-notifications token registration + backend POST.
  - `app/theme/` – colors/spacing/typography tokens (UI primitives moved to `app/components/`).
  - `app/constants/pushTokens.ts`, `app/__tests__/` for component/hooks/API tests; structure notes moved to `docs/mobile-structure-notes.md`.
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

## Health matrix (latest run: 2025-12-04 local)
- Backend: typecheck – pass, lint – pass, tests – pass (`npm test`), build – pass.
- Mobile: typecheck – pass, lint – pass, tests – pass (`npm test -- --runInBand`), build – not defined (Expo handles bundling).

## Known vulnerabilities / audit
- No npm audit config or advisory files present; no documented vulnerabilities in repo. Dependencies rely on upstream; rerun `npm audit` per package when ready.

## Dead code / redundancy status
- Backend:
  - `statusService.getStatus`/`StatusRecord` removed as unused; status access goes through repositories/services only.
  - HTTP telemetry ingest route kept as an explicit `501` stub for future HTTP providers (tests retained).
- Mobile:
  - `app/api/fakeData.ts` deleted.
  - Unused `useSignup`/`useResetPassword` hooks removed from `app/api/hooks.ts`.
  - `structure-notes.ts` moved to `docs/mobile-structure-notes.md`.
  - `empty_tmp_for_delete/` already absent.
- Archive/legacy: `archive/mobile_workdir/` and `archive/node_modules_old_unused_backup/` remain unused; keep quarantined.
- Assets: root-level logs/XML moved to `logs/`; root PNGs/screenshots moved to `docs/`.

## Refactor status
- Phase 1 (file moves + path cleanups): **done 2025-12-04** – backend split into config/controllers/services/repositories/integrations/domain/utils; routes now delegate to controllers; mobile UI primitives moved to `app/components/`; API hooks split by domain; root logs/screenshots relocated.
- Phase 2 (prune dead code/assets): **done 2025-12-04** – removed unused status accessor, deleted `app/api/fakeData.ts` and unused signup/reset hooks, moved structure notes to docs, cleaned root artefacts. HTTP telemetry stub retained intentionally as a 501 placeholder.
- Phase 3+: planned – tighten typing and repository boundaries, richer status/push/control error reporting, improved mobile loading/error/command UX, and optional infra/tooling upgrades (CI caching, devcontainer/docker, env parity checks, stricter lint rules).

## Upcoming refactor plan (Phase 3+)
- Backend: tighten repository/domain typing, add error normalization and richer status/push/control health signals, and improve observability/backoff around MQTT/control/alerts.
- Mobile: improve loading/error/empty states, surface control command failures, and refresh push tokens on permission changes.
- Infra/CI/tooling: optional additions such as CI caching/coverage, npm audit/snyk, devcontainer/docker-compose for Postgres+MQTT, env parity checks, and stricter lint/TS rules.

## Application Health (current snapshot)
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

## Phased refactor plan (forward-looking)
- **Phase 3: Small internal refactors**
  - Tighten repository typing; introduce/expand shared domain types; normalize errors in control/telemetry paths; improve status/push health reporting and observability.
  - Add richer UI states (errors/empty/loading) and control command error toasts; refresh push token on permission change.
  - Re-run full lint/typecheck/test.
- **Phase 4: Optional improvements**
  - CI: add backend lint/typecheck caching, coverage upload, mobile detox/e2e placeholder; add npm audit or snyk job.
  - Tooling: devcontainer/docker-compose for Postgres + MQTT, add `.env.example` parity checks, stricter ESLint (no-explicit-any on), TS path aliases; consider observability (structured logging, health metrics), durable job scheduling, and feature flags for telemetry provider selection.
