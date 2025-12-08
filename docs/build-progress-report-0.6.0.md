# Build Progress Report 0.6.0

## Backend
- Added `role`/`can_impersonate` to users with JWT/login/me payloads carrying roles; centralised RBAC helpers now gate control, schedules, work-order mutations/attachments, and document uploads (contractors read-only). New RBAC vitests cover control/schedule/work-order permissions per role.
- Introduced `share_links` table, repository/service/controller/routes with scoped creation/list/revoke + public `/public/share/:token` payloads (site with devices or device with telemetry summary). Seeds include demo tokens plus expired sample; API/public tests added.
- CSV export service + routes: `/sites/:id/export/devices.csv` and `/devices/:id/export/telemetry.csv?from&to&metrics`. Seeded telemetry points for demo device and added export Vitest.

## Mobile
- Auth store now carries user roles with helpers; Profile shows role pill and Sharing entry (disabled for contractors). New SharingScreen lists sites/devices and navigates to ShareLinksScreen for per-scope link management (create 24h/7d/30d links, copy public URL, revoke; offline-disabled).
- Added share link hooks and UI; export buttons on Site/Device screens fetch CSV and open data URLs (online-only). Device telemetry export uses current time range; site export covers devices.

## Tests / commands
- Backend: added `authRbac.test.ts`, `shareLinks.api.test.ts`, `shareLinksPublic.api.test.ts`, `exportCsv.api.test.ts` (run with `cd backend && TEST_DATABASE_URL=... ALLOW_TEST_DB_RESET=true npm test`; not executed in this summary).
- Mobile: added Sharing/ShareLinks and export button coverage in Jest suites (run with `cd mobile && npm test -- --runInBand`; not executed in this summary).

## Limitations / follow-ups
- Share links are read-only with fixed permissions; no SSO/2FA/impersonation UI yet.
- CSV export is in-memory and geared to small datasets; streaming/pagination still TODO.
- Sharing/export buttons hide offline; data-URL open is a temporary download approach pending a file manager/downloader pass.

## Verification commands (local)
- Backend: `cd backend && npm run typecheck && npm run lint && TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test && npm run build`
- Mobile: `cd mobile && npm run typecheck && npm run lint && npm test -- --runInBand`
