# Build Progress Report - 2025-12-08

## Executive Summary
- Backend sweep (Node 20/Postgres 16) is fully green: migrations, typecheck, lint, full Vitest run, and build all pass after stabilising env-sensitive tests (`NODE_ENV` reset in heatPumpHistory/health suites) and tightening the ClamAV socket stream typing.
- Mobile sweep is fully green: typecheck, lint, and Jest `--runInBand` pass with navigation/work-order attachment tests stubbing signed-file URLs and heavy screens without new `act()` warnings. Offline caching remains intact across dashboard/site/device/alerts/work orders.
- AV scanning and signed URLs are intact: uploads still flow temp -> AV scan -> persist-only-when-clean; infected => 400 `ERR_FILE_INFECTED`, scanner error => 503 `ERR_FILE_SCAN_FAILED`. JWT `/files/:path` stays primary; signed URLs require `FILE_SIGNING_SECRET` and the mobile flag (`EXPO_PUBLIC_USE_SIGNED_FILE_URLS`) remains false by default.
- Staging/prod wiring documented: env expectations for AV targets and file signing, storage base URL guidance, /health-plus checklist with curl examples, a signed-URL rollout plan (dev off -> staging on with mobile flag -> optional prod/CDN), and a staging smoke runbook for signed URLs.

## Backend Status
- Commands (Node 20 / Postgres 16): `npm run migrate:dev`, `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm run migrate:test`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` - all pass.
- AV/files: uploads stored under `FILE_STORAGE_ROOT` after AV; infected => 400 `ERR_FILE_INFECTED`, scanner error => 503 `ERR_FILE_SCAN_FAILED`, temp files cleaned. Authenticated `/files/:path` enforces org/RBAC. Signed URLs (`/files/:id/signed-url` -> `/files/signed/:token`) only when `FILE_SIGNING_SECRET` is set; otherwise 503 `ERR_FILE_SIGNING_DISABLED`. Tests: `files.api.test.ts`, `workOrderAttachments.api.test.ts`, `documents.api.test.ts`, `fileUrlSigner.test.ts`, `virusScanner.test.ts`.
- Auth/RBAC/share: JWT login/refresh rotation; roles (`owner|admin|facilities|contractor`) enforced for control/schedules/work orders/uploads/share links. Tests: `authRoutes.api.test.ts`, `authRbac.test.ts`, `authConfig.test.ts`, `shareLinks*.api.test.ts`. Gap: no password reset/2FA.
- Telemetry/control/history: MQTT ingest primary; HTTP ingest still 501 stub. Control throttled via `CONTROL_COMMAND_THROTTLE_MS`; schedules validated. Heat-pump history gated by env (URL/API key required outside dev) with timeout/circuit breaker. Tests: `deviceControl*.test.ts`, `telemetryService.test.ts`, `heatPumpHistory*.test.ts`, `alertsWorker*.test.ts`, `exportCsv.api.test.ts`.
- Work orders/maintenance: status transitions enforced, SLA recompute, checklist replace, maintenance summary buckets. Tests: `workOrders*.test.ts`, `workOrdersMaintenance.api.test.ts`, `workOrdersService.sla.test.ts`.
- Health/diagnostics: `/health-plus` reports db/mqtt/control/heatPumpHistory/push/alerts worker/storage/maintenance/antivirus; storage block checks FILE_STORAGE_ROOT writable and AV configured/healthy. Tests: `healthPlus.test.ts`, `healthPlus.mqttControlStatus.test.ts`.

## Mobile Status
- Commands: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand` - all pass.
- File access: default uses JWT `/files`; optional signed URLs fetched when `EXPO_PUBLIC_USE_SIGNED_FILE_URLS=true` (kept false in dev/prod). Work-order/doc tests cover signed URL issuance and opening.
- Navigation/data: RootNavigator/Auth/App stacks with cached dashboard/site/device/alerts/work orders; offline banners and stale indicators remain. Control/ack/mute/export are backend-gated (UI still allows taps; backend enforces RBAC). Diagnostics reads `/health-plus`; share links gated to owner/admin/facilities.
- No new `act()` warnings; console logs remain noisy but expected.

## Operational Readiness
- Dev: follow `docs/dev-run-notes.md`; Postgres 16 + MQTT; `TEST_DATABASE_URL` + `ALLOW_TEST_DB_RESET=true` required for tests. AV/signing optional locally.
- Staging/prod health checklist: expect `db:"ok"`, storage `writable:true`, antivirus `configured:true` and `healthy:true` after a scan, mqtt/control configured flags matching env, heatPumpHistory reflecting URL/API key presence, maintenance counts returned. Example checks:
```
curl https://staging-api.greenbro.co.za/health-plus
curl https://api.greenbro.co.za/health-plus
```
- Staging signed-URL smoke (with valid JWT): issue `POST /files/<id>/signed-url`, then hit the returned `/files/signed/...` without Authorization; AV stays enforced on upload. Staging EAS profile should flip `EXPO_PUBLIC_USE_SIGNED_FILE_URLS=true` only after `FILE_SIGNING_SECRET` is set.

## Issues/Risks
- P1: Prod/staging must set `FILE_SIGNING_SECRET`, `FILE_STORAGE_BASE_URL`, and enable AV with a real command or clamd target; otherwise uploads or signed URLs will error.
- P2: Heat-pump history depends on upstream availability and URL/API key config (disabled outside dev when unset).
- P3: Front-end UI still allows control/ack/mute/export taps for contractors; backend rejects but UX should be role-aware. Password reset/2FA still absent.

## Next Steps
1) Apply staging/prod env wiring: writable FILE_STORAGE_ROOT/BASE_URL, unique `FILE_SIGNING_SECRET`, and `AV_SCANNER_ENABLED=true` with a valid scanner target; rerun `/health-plus` curls.
2) Run the staging signed-URL smoke (POST signed-url + GET signed token) and decide on CDN forwarding before turning on the mobile signed-URL flag beyond staging.
3) Add UI role gating for control/ack/mute/export to mirror backend RBAC and reduce contractor-facing errors; plan auth hardening (reset/2FA) after rollout.
