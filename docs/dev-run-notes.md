# Local dev run & smoke (Windows + VS Code)

## Recent updates
- dev-all now checks ports 4000/8081 first (exits if non-Node/Expo processes own them), honors GREENBRO_PG_SERVICE with clearer messaging, prefers attached devices before launching Pixel_7_API_34, and warns if adb is missing.
- Mobile CI now enforces `npm run typecheck` (`tsc --noEmit`) alongside lint/test; run it locally before pushing.
- Theming rollout completed across all screens.
- Unused styles are now enforced as errors across app/components/screens/theme; lint fails on warnings.
- Navigation/data error guards added and covered by new tests.
- Error-surface theming unified and exercised by ErrorCard theme snapshots.

## One-command dev environment
- `npm run dev:all` - checks ports 4000/8081 and bails if they are held by non-Node/Expo processes, honors GREENBRO_PG_SERVICE (logs if missing), kills stale Node/Expo/Metro on 4000/8081/8082, starts backend (install + migrate + optional seed + dev), starts Metro on 8081, wires adb reverse, reuses attached devices/running emulators before launching Pixel_7_API_34, and launches the app (`com.greenbro.mobile/.MainActivity`).
- `npm run stop:all` - stops Node/Expo/Metro and attempts to shut down any running Android emulator (safe if nothing is running).

Requirements:
- Postgres service or Docker compose configured as per `scripts/dev-all.ps1`.
- adb and Android SDK (Pixel_7_API_34) installed and on PATH.

## Web dashboard (Next.js)
- Bring up the API first via `npm run dev:all` (or `npm run dev:backend` if you only need the backend) so `http://localhost:4000` is live with seed data.
- In a second terminal run `npm run web:dev` (Next dev server on `http://localhost:3000`, respects `NEXT_PUBLIC_API_URL` in `web/.env.local`). This can run alongside the mobile dev client.

## Pre-release checklist
- Backend: `cd backend && npm run lint && npm run typecheck && npm test`
- Mobile: `cd mobile && npm run lint && npm run typecheck && npm test -- --runInBand` (same lint/type/test trio runs in CI, including `npm run typecheck`)
- Optional: Detox E2E: `npm run e2e:android` (emulator + backend required)
- Vendor disable flags are for CI/local only and must remain **false** in staging/prod (`HEATPUMP_HISTORY_DISABLED`, `CONTROL_API_DISABLED`, `MQTT_DISABLED`, `PUSH_NOTIFICATIONS_DISABLED`).
- Theming snapshots and ErrorCard guard tests are part of the UI regression safety net; do not skip them when cutting builds.
- Demo seed: `npm run demo:seed` resets the shared demo org/user/device (`demo@greenbro.com` / `GreenbroDemo#2025!`, MAC `38:18:2B:60:A9:94`) so web + mobile smoke paths line up.

## Backend API (`http://localhost:4000`)
- `.env` (local-only) should match: `PORT=4000`, `NODE_ENV=development`, `DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_dev`, `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test`, `JWT_SECRET=local-dev-secret-e72c3f97f833499ab93f7f62d9f3d10c`, `ALLOW_TEST_DB_RESET=true`, `FILE_STORAGE_ROOT=./storage`, `FILE_STORAGE_BASE_URL=http://localhost:4000/files`, leave `HEATPUMP_*`, `MQTT_URL`, `CONTROL_API_*` empty for UI testing. `/files/*` responses now require an Authorization header and are org-scoped.
- Commands (PowerShell):
  1) `cd backend`
  2) `npm install`
  3) `npm run migrate:dev`
  4) `npm run seed:demo -- --reset` (seeds Demo Organisation + Demo HQ/Plant, hero device "Heat Pump #1" MAC `38:18:2B:60:A9:94`, alert rules + warning/critical alerts, schedules, telemetry, work orders + clean attachments, documents incl. one AV-blocked, share links; demo owner `demo@greenbro.com` / `GreenbroDemo#2025!`)
  5) `npm run dev` (binds to `http://localhost:4000`)
- Health check: `curl http://localhost:4000/health-plus` should return `{ env: "development", db: "ok", ok: true }` plus blocks for `mqtt`, `control`, `heatPumpHistory` (configured: false if HEATPUMP_* unset), `alertsEngine`, `maintenance`, and `storage` (writable). If `heatPumpHistory.configured` is false/disabled, that is expected for local UI tests.

## Vendor MQTT/control sandbox check
- Populate broker + control secrets locally (do not commit): `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_TELEMETRY_TOPIC`/`MQTT_CONTROL_TOPIC_TEMPLATE` if the vendor uses non-default topics, `CONTROL_API_URL`, `CONTROL_API_KEY`, and keep `MQTT_DISABLED=false`, `CONTROL_API_DISABLED=false`.
- Start the backend normally (`npm run dev`) and watch logs for `mqttIngest` connect + subscribe. `/health-plus` should show `mqttIngest.configured=true`, `mqttIngest.connected=true`, and `lastMessageAt` ticking after telemetry arrives.
- `/health-plus` `control.configured=true` once `CONTROL_API_URL`/`CONTROL_API_KEY` are present and the disable flag is false; `lastCommandAt`/`lastError` echo status from the shared system_status table.
- From the mobile Device screen, send a test setpoint/mode command: backend should log the command, persist it to history, and the vendor sandbox should reflect the change where possible.

## Mobile / Metro (Android dev client)
- API base: `EXPO_PUBLIC_API_URL` if set; otherwise falls back to `http://10.0.2.2:4000` (Android emulator -> host loopback). Icons/splash/header use `mobile/assets/greenbro/greenbro-icon-1024.png`, `greenbro-splash.png`, and `greenbro-logo-horizontal.png`.
- Commands:
  1) `cd mobile`
  2) `npm install`
  3) `npm run start:devclient` (starts Metro on `localhost:8081` with cache clear). Equivalent manual command: `npx expo start --dev-client --localhost -c --port 8081`.
- Port forwarding (emulator running): `adb reverse tcp:8081 tcp:8081` and `adb reverse tcp:4000 tcp:4000`. Helper scripts `./dev.sh` / `.\dev.ps1` now try to run these automatically when Expo starts; rerun the reverse commands after restarting the emulator.
- Launch dev client: `adb shell am start -n com.greenbro.mobile/.MainActivity`
- Typecheck: `npm run typecheck` (tsc --noEmit); this runs in CI alongside lint/test.
- If the dev client is missing/out-of-date: `npx expo run:android --variant debug` then re-run the start command above.

## Near-prod Android build (qaRelease)
- Preconditions: backend running on port 4000 with vendor history/MQTT/control envs set; keep the safety flags on for local demos (`PUSH_NOTIFICATIONS_DISABLED=true`, `MQTT_DISABLED=true`, `CONTROL_API_DISABLED=true`, `HEATPUMP_HISTORY_DISABLED=false` if you want live history).
- Commands: `npm run stop:all`; `npm run dev:all` (or bring up backend + Metro separately); `cd mobile && npm run android:qa` to build/install the debuggable release-like `qaRelease` variant (bundles JS via `bundleQaReleaseJsAndAssets`, default API `http://10.0.2.2:4000`).
- Expect: Pixel_7_API_34 boots the app without the Metro “Loading from 10.0.2.2:8081” screen; device detail/history/gauges load against the local backend; Diagnostics shows heatPumpHistory as HEALTHY and MQTT/control as UNCONFIGURED or HEALTHY depending on flags; no “Unable to load script /index.android.bundle” error.

## Smoke walkthrough (Android emulator)
- Login: white background, horizontal GREENBR(gear)O logo, brand gradient button. Use `demo@greenbro.com` / `GreenbroDemo#2025!`.
- Dashboard: fleet summary (sites/devices/alerts/health), search entry, connectivity pills, no offline banner when online, brand greens/greys only.
- Search: `/fleet` search over sites/devices/alerts with health filter chips; offline uses cached data and shows stale indicator.
- Site overview: site card status/last seen, device list with health + connectivity pills, last seen, quick actions (Device, Alerts, Documents).
- Device detail: hero (name/firmware/connectivity), telemetry charts (1h/24h/7d tabs), GÇ£Compressor current (A)GÇ¥ history card shows GÇ£history disabled/unavailableGÇ¥ if HEATPUMP_* unset; control panel/setpoint/mode disabled when offline; schedule card + edit modal; control history from `/devices/:id/commands`; Documents link to documents screen.
- Alerts: list with severity/health filters + offline cache; alert detail shows rule summary, snooze chips (15m/1h/4h/until resolved, max 24h), GÇ£Create work orderGÇ¥ button and linked work-order preview.
- Work orders & maintenance: list with status filter chips/SLA pills; detail supports status transitions (open GåÆ in_progress GåÆ done/cancelled), notes, checklist toggles, attachments card; maintenance calendar shows upcoming items from SLA/maintenance summary.
- Documents: site/device documents list with upload/delete online-only; URLs point at `/files` and require auth (404 outside your org); Auth header must be forwarded if fronted by a CDN/proxy.
- Sharing & access: Profile shows role pill (Owner) and GÇ£Sharing & accessGÇ¥ GåÆ Share Links screen (list/create/revoke) for Admin/Owner; contractor flow remains disabled/read-only.
- Diagnostics: Diagnostics screen shows `/health-plus` snapshot (db/mqtt/control/heatPumpHistory/alertsEngine/push/storage/workOrders) and alerts engine metrics (last run/duration/rules/active counts).
- Offline smoke: toggle Airplane Mode GåÆ offline banner; Dashboard/Site/Device/Alerts use cached data and mark it stale; control/ack/mute/work-order mutations disabled with clear messaging.

## Shared demo tenant path (web + mobile)
- Seed/reset: `npm run demo:seed` (or `cd backend && npm run seed:demo -- --reset`) aligns the demo org/user/device across web + mobile. Creds: `demo@greenbro.com` / `GreenbroDemo#2025!`.
- Web path: login ? `/app` shows hero tile "Heat Pump #1"; open the device, view History 6h (non-zero), Alerts (warning + critical) ? open + acknowledge, Work orders (open/in-progress/done) with clean attachments, Documents (manual/schematic + one AV-blocked incident report), Sharing (active + expired + revoked links), Diagnostics health snapshot.
- Mobile path: same creds; Fleet ? hero device history (6h), Alerts detail + ack/mute, Work orders + attachments, Documents + sharing links, Diagnostics. Keep demo MAC `38:18:2B:60:A9:94` for history vendor alignment.
## Tests / verification commands (manual run as needed)
- Backend: `cd backend && npm run typecheck && npm run lint && TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test && npm run build`
- Web: `npm run web:test:coverage` (or `cd web && npm run test:coverage`) collects coverage over `app/**` and `lib/**` with current thresholds 65/60/60/65; use `npm run web:test` for a quick run without coverage. Idle/absolute session defaults are 30m/8h; override with `NEXT_PUBLIC_SESSION_IDLE_MINUTES` / `NEXT_PUBLIC_SESSION_ABSOLUTE_HOURS` for staging/QA.
- Web Playwright smoke: `WEB_E2E_BASE_URL=http://localhost:3000 WEB_E2E_EMAIL=demo@greenbro.com WEB_E2E_PASSWORD=GreenbroDemo#2025! npm run web:e2e` (requires the API running/seeded and the web app served at the base URL; run `npm exec --prefix web playwright install --with-deps` once to fetch browsers; manual GitHub workflow `web-e2e` accepts inputs/secrets for seeded envs). Optional idle timeout check: set `WEB_E2E_IDLE_TEST=true WEB_E2E_IDLE_WAIT_MS=<short-ms>` and build with a reduced `NEXT_PUBLIC_SESSION_IDLE_MINUTES`.
- 2025-12-08: ran `npm run migrate:dev`; `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm run migrate:test`; `npm test`; `npm run build` against local Postgres 16 GÇö all passed. CSV export RBAC (owner/admin/facilities vs contractor), heat pump history scoping/env gating (good MAC, other-org, non-dev env missing), and `/files` org isolation now live in the standard `npm test` suite.
- AV scan tests: env knobs are `AV_SCANNER_ENABLED`, `AV_SCANNER_CMD` (or `AV_SCANNER_HOST`/`AV_SCANNER_PORT` for clamd) plus `FILE_STORAGE_ROOT`. With the bundled stub: `cd backend && npm run test:av`; or `cross-env AV_SCANNER_ENABLED=true AV_SCANNER_CMD="node ./test/fixtures/av-sim.js" npm test -- test/virusScanner.test.ts`; or `cross-env AV_SCANNER_ENABLED=true AV_SCANNER_CMD="node ./test/fixtures/av-sim.js" npm test -- test/workOrderAttachments.api.test.ts test/documents.api.test.ts`. CI uses the stubbed script, not a real ClamAV daemon.
- Mobile: `cd mobile && npm run typecheck && npm run lint && npm test -- --runInBand`
- CI mirrors this (`npm test` plain for backend; `npm test -- --runInBand` for mobile). Detox configs remain intact; do not run Detox here.

## WordPress embedding (marketing site)
- Use a full-width WordPress page and drop an iframe pointing to `https://app.greenbro.co.za/embed` (forces `embed=true` + slim chrome).
- Minimal snippet:
  ```html
  <iframe src="https://app.greenbro.co.za/embed" style="width: 100%; height: 1000px; border: none;" loading="lazy" allow="camera; microphone"></iframe>
  ```
- Set `NEXT_PUBLIC_EMBEDDED=true` on the web build; backend CORS must include `https://www.greenbro.co.za` and `https://app.greenbro.co.za` and the web CSP/frame headers allow those hosts.
- Recommended height: 1000–1200px (scrollable). Allow `camera` for QR scanning; `microphone` only if needed by future features. See `docs/wp-embed.md` for the full checklist.

### E2E (Detox + backend bring-up)
- CI workflow `.github/workflows/e2e-android.yml` now boots Postgres, runs `backend` migrate + `seed:e2e`, starts the API (waits on `/health-plus`), then runs Metro on 8081 and Detox (`npm run e2e:test:android`). Heat-pump history calls are disabled via `HEATPUMP_HISTORY_DISABLED=true` to avoid vendor dependency.
- Local run (manual): start backend with `npm run migrate:dev && npm run seed:e2e && npm run dev`, then in a new terminal `cd mobile && npx expo start --dev-client --localhost --port 8081 --clear`, and from repo root run `npm run e2e:android` (emulator `Pixel_7_API_34`).
- Vendor-disable flags (`HEATPUMP_HISTORY_DISABLED`, `CONTROL_API_DISABLED`, `MQTT_DISABLED`, `PUSH_NOTIFICATIONS_DISABLED`) are for CI/E2E/local only. They must be **false** in staging/production; prod-like boots log warnings if set.

### 2025-12-08: end-to-end local stack spin-up (Windows, Pixel_7_API_34 emulator)
- Backend commands (PowerShell): `cd backend`; `npm install`; `npm run migrate:dev`; `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm run migrate:test`; `npm run seed:demo -- --reset`; `npm run typecheck`; `npm run lint`; `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test`; `npm run build`; `npm run dev` (running in its own terminal).
- Health: `curl http://localhost:4000/health-plus` GçÆ `ok:true`, `db:"ok"`, storage writable, integrations configured:false where expected.
- Mobile/Metro: `cd mobile`; `npm install`; `npx expo start --dev-client --localhost -c --port 8081 --android` (Metro listening on 8081).
- Emulator wiring: `emulator -avd Pixel_7_API_34` (via `C:\Users\bradl.CRABNEBULA\AppData\Local\Android\Sdk\emulator\emulator.exe`); `adb reverse tcp:8081 tcp:8081`; `adb reverse tcp:4000 tcp:4000`; dev client installed with `npx expo run:android --variant debug`; app launched with `adb shell am start -n com.greenbro.mobile/.MainActivity`.
- Verification: `adb logcat` shows Metro URL `localhost:8081` and JS bundle loaded; backend login succeeds for `demo@greenbro.com` / `password` via `curl`/`Invoke-RestMethod`; no Metro/backend error spam observed after launch.

## Branding quick-check
- Canonical assets only: `docs/branding/official/greenbro-logo-horizontal-gearO.{svg,png}`, `mobile/assets/greenbro/greenbro-logo-horizontal.png`, `greenbro-splash.png`, `greenbro-icon-1024.png`.
- Quick grep sanity: run the two `rg` checks referenced in `docs/branding/README.md`; expected hits are limited to that warning, and app assets already point to the official PNG.



