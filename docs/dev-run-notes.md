# Local dev run & smoke (Windows + VS Code)

## Backend API (`http://localhost:4000`)
- `.env` (local-only) should match: `PORT=4000`, `NODE_ENV=development`, `DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_dev`, `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test`, `JWT_SECRET=local-dev-secret-e72c3f97f833499ab93f7f62d9f3d10c`, `ALLOW_TEST_DB_RESET=true`, `FILE_STORAGE_ROOT=./storage`, `FILE_STORAGE_BASE_URL=http://localhost:4000/files`, leave `HEATPUMP_*`, `MQTT_URL`, `CONTROL_API_*` empty for UI testing. `/files/*` responses now require an Authorization header and are org-scoped.
- Commands (PowerShell):
  1) `cd backend`
  2) `npm install`
  3) `npm run migrate:dev`
  4) `node scripts/init-local-db.js` (seeds demo org/site/device/user, alert rules + alerts, schedules, work orders + tasks/attachments, documents, share links, telemetry; demo user `demo@greenbro.com` / `password`; demo MAC pinned to `38:18:2B:60:A9:94`)
  5) `npm run dev` (binds to `http://localhost:4000`)
- Health check: `curl http://localhost:4000/health-plus` should return `{ env: "development", db: "ok", ok: true }` plus blocks for `mqtt`, `control`, `heatPumpHistory` (configured: false if HEATPUMP_* unset), `alertsEngine`, `maintenance`, and `storage` (writable). If `heatPumpHistory.configured` is false/disabled, that is expected for local UI tests.

## Mobile / Metro (Android dev client)
- API base: `EXPO_PUBLIC_API_URL` if set; otherwise falls back to `http://10.0.2.2:4000` (Android emulator -> host loopback). Icons/splash/header use `mobile/assets/greenbro/greenbro-icon-1024.png`, `greenbro-splash.png`, and `greenbro-logo-horizontal.png`.
- Commands:
  1) `cd mobile`
  2) `npm install`
  3) `npm run start:devclient` (starts Metro on `localhost:8082` with cache clear). Equivalent manual command: `npx expo start --dev-client --localhost -c --port 8082`.
- Port forwarding (emulator running): `adb reverse tcp:8082 tcp:8082` and `adb reverse tcp:4000 tcp:4000`. Helper scripts `./dev.sh` / `.\dev.ps1` now try to run these automatically when Expo starts; rerun the reverse commands after restarting the emulator.
- Launch dev client: `adb shell am start -n com.greenbro.mobile/.MainActivity`
- If the dev client is missing/out-of-date: `npx expo run:android --variant debug` then re-run the start command above.

## Smoke walkthrough (Android emulator)
- Login: white background, horizontal GREENBR(gear)O logo, brand gradient button. Use `demo@greenbro.com` / `password`.
- Dashboard: fleet summary (sites/devices/alerts/health), search entry, connectivity pills, no offline banner when online, brand greens/greys only.
- Search: `/fleet` search over sites/devices/alerts with health filter chips; offline uses cached data and shows stale indicator.
- Site overview: site card status/last seen, device list with health + connectivity pills, last seen, quick actions (Device, Alerts, Documents).
- Device detail: hero (name/firmware/connectivity), telemetry charts (1h/24h/7d tabs), “Compressor current (A)” history card shows “history disabled/unavailable” if HEATPUMP_* unset; control panel/setpoint/mode disabled when offline; schedule card + edit modal; control history from `/devices/:id/commands`; Documents link to documents screen.
- Alerts: list with severity/health filters + offline cache; alert detail shows rule summary, snooze chips (15m/1h/4h/until resolved, max 24h), “Create work order” button and linked work-order preview.
- Work orders & maintenance: list with status filter chips/SLA pills; detail supports status transitions (open → in_progress → done/cancelled), notes, checklist toggles, attachments card; maintenance calendar shows upcoming items from SLA/maintenance summary.
- Documents: site/device documents list with upload/delete online-only; URLs point at `/files` and require auth (404 outside your org); Auth header must be forwarded if fronted by a CDN/proxy.
- Sharing & access: Profile shows role pill (Owner) and “Sharing & access” → Share Links screen (list/create/revoke) for Admin/Owner; contractor flow remains disabled/read-only.
- Diagnostics: Diagnostics screen shows `/health-plus` snapshot (db/mqtt/control/heatPumpHistory/alertsEngine/push/storage/workOrders) and alerts engine metrics (last run/duration/rules/active counts).
- Offline smoke: toggle Airplane Mode → offline banner; Dashboard/Site/Device/Alerts use cached data and mark it stale; control/ack/mute/work-order mutations disabled with clear messaging.

## Tests / verification commands (manual run as needed)
- Backend: `cd backend && npm run typecheck && npm run lint && TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test && npm run build`
- 2025-12-08: ran `npm run migrate:dev`; `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm run migrate:test`; `npm test`; `npm run build` against local Postgres 16 — all passed. CSV export RBAC (owner/admin/facilities vs contractor), heat pump history scoping/env gating (good MAC, other-org, non-dev env missing), and `/files` org isolation now live in the standard `npm test` suite.
- AV scan tests: env knobs are `AV_SCANNER_ENABLED`, `AV_SCANNER_CMD` (or `AV_SCANNER_HOST`/`AV_SCANNER_PORT` for clamd) plus `FILE_STORAGE_ROOT`. With the bundled stub: `cd backend && npm run test:av`; or `cross-env AV_SCANNER_ENABLED=true AV_SCANNER_CMD="node ./test/fixtures/av-sim.js" npm test -- test/virusScanner.test.ts`; or `cross-env AV_SCANNER_ENABLED=true AV_SCANNER_CMD="node ./test/fixtures/av-sim.js" npm test -- test/workOrderAttachments.api.test.ts test/documents.api.test.ts`. CI uses the stubbed script, not a real ClamAV daemon.
- Mobile: `cd mobile && npm run typecheck && npm run lint && npm test -- --runInBand`
- CI mirrors this (`npm test` plain for backend; `npm test -- --runInBand` for mobile). Detox configs remain intact; do not run Detox here.

### 2025-12-08: end-to-end local stack spin-up (Windows, Pixel_7_API_34 emulator)
- Backend commands (PowerShell): `cd backend`; `npm install`; `npm run migrate:dev`; `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm run migrate:test`; `node scripts/init-local-db.js`; `npm run typecheck`; `npm run lint`; `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test`; `npm run build`; `npm run dev` (running in its own terminal).
- Health: `curl http://localhost:4000/health-plus` ⇒ `ok:true`, `db:"ok"`, storage writable, integrations configured:false where expected.
- Mobile/Metro: `cd mobile`; `npm install`; `npx expo start --dev-client --localhost -c --port 8082 --android` (Metro listening on 8082).
- Emulator wiring: `emulator -avd Pixel_7_API_34` (via `C:\Users\bradl.CRABNEBULA\AppData\Local\Android\Sdk\emulator\emulator.exe`); `adb reverse tcp:8082 tcp:8082`; `adb reverse tcp:4000 tcp:4000`; dev client installed with `npx expo run:android --variant debug`; app launched with `adb shell am start -n com.greenbro.mobile/.MainActivity`.
- Verification: `adb logcat` shows Metro URL `localhost:8082` and JS bundle loaded; backend login succeeds for `demo@greenbro.com` / `password` via `curl`/`Invoke-RestMethod`; no Metro/backend error spam observed after launch.

## Branding quick-check
- Canonical assets only: `docs/branding/official/greenbro-logo-horizontal-gearO.{svg,png}`, `mobile/assets/greenbro/greenbro-logo-horizontal.png`, `greenbro-splash.png`, `greenbro-icon-1024.png`.
- Quick grep sanity: run the two `rg` checks referenced in `docs/branding/README.md`; expected hits are limited to that warning, and app assets already point to the official PNG.
