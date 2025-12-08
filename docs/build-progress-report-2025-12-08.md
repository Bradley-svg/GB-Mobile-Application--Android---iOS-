# Build Progress Report - 2025-12-08

## Executive Summary
- Backend migrations, Postgres-backed tests, and TypeScript build now pass locally on Node 20/Postgres 16; added regression coverage for CSV export RBAC (owner/admin/facilities vs contractor), heat-pump history scoping/env gating, and `/files` org isolation.
- Mobile typecheck, lint (share-link `no-explicit-any` break fixed), and Jest suites pass with the noisy `act()` warnings from RootNavigator flows quieted via targeted mocks. Offline caching covers dashboard/site/device/alerts/search/work orders. Branding uses the official assets/palette.
- Roadmap fit: 0.2 fleet visibility/search and core telemetry/control flows are present; 0.3 alerts/rules/control and 0.4 work orders/maintenance are partial but usable; 0.5 sharing/reporting is partially delivered; PV integrations, dark mode, commissioning, richer reporting remain open.

## Backend Status
- Commands this run (Node 20 / Postgres 16): `npm run migrate:dev` (pass), `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm run migrate:test` (pass), `npm test` (pass), `npm run build` (pass). Typecheck/lint not rerun in this pass.
- Auth/RBAC/share: JWT login/refresh with refresh rotation; optional signup gate; roles (`owner|admin|facilities|contractor`) attached to tokens; RBAC guards control/schedules/work orders/doc uploads/share links. This sweep fixed test fixtures by returning user context in auth refresh mocks and by signing schedule tokens with role claims. Tests: `authRoutes.api.test.ts`, `authRbac.test.ts`, `authConfig.test.ts`. Risks: no password reset/2FA; share links read-only only.
- Telemetry/history: MQTT ingest is primary; HTTP ingest returns 501. Telemetry downsampled per metric. Heat-pump history posts vendor body (`aggregation/from/to/mode/fields/mac`) with `application/json-patch+json` + `x-api-key`, timeout + circuit breaker, normalises arbitrary series. Tests: `telemetryService.test.ts`, `heatPumpHistoryClient.test.ts`, `heatPumpHistory.api.test.ts`. Risks: vendor call disabled outside development if URL/API key unset; relies on upstream availability; validation only checks timestamp order.
- Alerts/rules/worker: Worker lock (`worker_locks`), offline/high-temp plus rule engine (threshold/ROC/offline) with load-shedding downgrades, push notify on critical, heartbeat + metrics into `system_status` and `/health-plus`. Tests: `alertsWorker.*`, `alerts*.api.test.ts`, `alertsAckMute.api.test.ts`, `alertRules*`. Risk: single-worker assumption; relies on site schedules for load-shedding context.
- Device control/schedules: HTTP or MQTT control with throttle window (`CONTROL_COMMAND_THROTTLE_MS`), validation errors recorded in command history, per-device schedules with validation. Tests: `deviceControlService.test.ts`, `deviceControl.api.test.ts`, `deviceSchedules.api.test.ts`, `deviceControlValidationService.test.ts`. Risks: commands blocked if CONTROL/MQTT envs unset; UI not role-gated (backend rejects).
- Work orders/tasks/attachments/SLA: Status transitions enforced, SLA breach recomputed, checklist replace, maintenance summary buckets, attachments stored under `FILE_STORAGE_ROOT`. Tests: `workOrders*.test.ts`, `workOrdersMaintenance.api.test.ts`, `workOrderAttachments.api.test.ts`, `workOrdersService.sla.test.ts`. Risks: no AV scanning; CDN/signed-URL fronting still TODO even though `/files` now requires auth + org scope.
- Documents/storage: Site/device upload + list, path sanitisation, public URL mapping. Tests: `documents.api.test.ts`. Risk: `/files` now auth/org-scoped but still lacks AV/signed URLs/AV scanning.
- CSV exports/reporting: Site devices CSV and device telemetry CSV with range validation/metric allowlist, org scoped, and RBAC (`owner|admin|facilities`). Tests: `exportCsv.api.test.ts`. Risk: potential heavy queries without paging and wide date ranges.
- Share links: 90-day max expiry, read-only, site/device payloads with telemetry snapshot, revoke + public resolver. Tests: `shareLinks.api.test.ts`, `shareLinksPublic.api.test.ts`. Risk: None beyond token handling; still read-only only.
- Health/diagnostics: `/health-plus` aggregates DB/MQTT/control/heatPumpHistory/push/alerts worker/storage/maintenance; relies on `system_status` rows. Tests: `healthPlus.test.ts`, `healthPlus.mqttControlStatus.test.ts`. Risk: requires migrations + seeded status row.
- Issues/Risks
  - P1: `/files` is auth/org-scoped but still lacks AV scanning/signed URL flow; CDN/proxy frontends must forward auth.
  - P2: Heat-pump history depends on upstream availability and URL/API key config (disabled outside dev when unset).
  - P3: No password reset/2FA/lockout flow (known gap).

## Mobile Status
- Commands: `npm run typecheck` (pass); `npm run lint` (pass after typing share-link tests that briefly failed `no-explicit-any`); `npm test -- --runInBand` (pass) with RootNavigator/QueryClient suites now quiet after mocking heavy screens + useNetworkBanner.
- Dashboard/Search: Hero metrics (sites/online devices/active alerts), health/connectivity chips, offline banner + cache age, search with health filters and offline cached results. Risk: stale cache beyond 24h only warned; backend errors show generic messaging.
- Site overview: Site status/last-seen/health pills, device cards with firmware + quick actions, CSV export (online only), documents link; offline shows cached data + stale note.
- Device detail: Telemetry charts (1h/24h/7d) for supply/return/power/flow/COP, delta-T tile, Azure history card (compressor current) with error mapping, control setpoint/mode with throttle/error messages, schedule edit modal, command history, active alerts, telemetry export (online). Risks: UI not role-gated (contractor can attempt control/exports, backend denies); history disabled offline.
- Alerts + detail: Alerts list with severity filters/offline cache; detail shows rule metadata, snooze chips (15m/1h/4h/until resolved), ack/mute actions, work-order creation; offline disables actions. Risk: ack/mute not role-gated; generic error messages.
- Work orders/Maintenance: List with SLA/due pills and filters, offline cached; detail (per tests) handles status transitions, checklist, attachments; maintenance calendar from `/maintenance/summary`. Risks: offline actions disabled but caches rely on previous session.
- Documents/vault: Site/device documents list with category/status pills, opens via API base URL; offline read-only banner when cached; no mobile upload UI.
- Sharing & access: Profile shows role pill; Sharing screen gated to owner/admin/facilities, site/device share-link management (create 24h/7d/30d, copy, revoke) with offline disable. Risk: copied link uses `API_BASE_URL` so bad env misconfig breaks links.
- Profile/Diagnostics: Push preference toggle persists via `/user/preferences`; session-expired banner; Diagnostics shows `/health-plus` snapshot (control/MQTT/heatPumpHistory/alerts engine counts, push status). No dark mode.
- Issues/Risks
  - P1: Control/ack/mute/export UI not role-gated; relies on backend errors for contractors.
  - P2: Keep an eye on new `act()` warnings as async screens grow; current suites are quiet after mocks.
  - P3: Env-dependent URLs (API_BASE_URL in share copy/diagnostics) must be set per deployment.

## Operational Readiness
- Dev: Follow `docs/dev-run-notes.md` (Postgres + MQTT). Set `TEST_DATABASE_URL` and `ALLOW_TEST_DB_RESET=true` before running backend tests/migrations. Heat-pump and control envs can stay unset locally; `/health-plus` will mark them unconfigured but healthy.
- Staging: Not exercised this run; needs staging DB/API + `HEATPUMP_HISTORY_URL`/`API_KEY`, control API/MQTT creds, and alerts worker running so `/health-plus` shows live heartbeats.
- `/health-plus` expected healthy when DB reachable, storage writable, alerts worker heartbeat recent, control/mqtt configured flags accurate, heat-pump history last success recent, maintenance counts returned.

## Codebase Hygiene
- Gitignore covers node_modules/dist; runtime dirs `backend/storage`, `backend/uploads`, `backend/uploads-test` are now ignored to avoid accidental commits. `logs/`/`archive/` already isolated and `archive/logs/` cleaned + ignored.
- Docs now note backend migrations/tests passing on 2025-12-08 against Postgres and the share-link lint break now resolved; mobile lint now green (act() warnings still noted).
- Audit snapshots: backend 6 moderate + 2 high (dev tooling: vitest/vite/node-pg-migrate/glob); mobile 3 low (Expo CLI/send). No changes applied.
- No obvious dead code flagged by quick `rg` scans; legacy assets live under `archive/` only.

## Prioritised Next Steps
- **P0:** None blocking production identified.
- **P1:**
  1) Add AV scanning and/or signed URL/CDN fronting for `/files` now that auth/org scoping is enforced.
- **P2:**
  1) Keep Jest noise low by wrapping new async UI flows in `act`/`waitFor` (RootNavigator suites are quiet after mocking heavy screens).
  2) Refresh documentation (repo overview/feature map) to reflect current lint/test status and partial features.
  3) Add front-end role gating for control/ack/mute/export actions to mirror RBAC.
- **P3:**
  1) Broader observability/metrics beyond `/health-plus` (push metrics, alert engine stats export).
  2) Plan Expo/React Native upgrades to clear audit advisories.
  3) Expand offline cache expiry/enforcement and queued action handling for work orders/alerts/control.
