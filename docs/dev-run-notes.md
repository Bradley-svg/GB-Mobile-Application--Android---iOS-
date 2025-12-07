## Local dev run & screenshots (0.1.0 – no staging)

### Backend – local API run flow
From repo root:
```bash
cd backend

# 1) Install deps (only if not already done)
npm install

# 2) Migrate dev DB
npm run migrate:dev

# 3) Seed demo org/site/device/user (demo@greenbro.com)
node scripts/init-local-db.js

# 4) Run dev server on http://localhost:4000
npm run dev
```
Prereqs: Postgres is running; `backend/.env` has `DATABASE_URL`, `JWT_SECRET`, etc.

If you don’t want to hit Azure while grabbing screenshots, leave `HEATPUMP_HISTORY_URL` and `HEATPUMP_HISTORY_API_KEY` unset in `.env`. The Device screen’s history card will show the “temporarily unavailable / disabled” copy instead of blowing up on vendor errors.

### Mobile / Metro + dev client
From repo root:
```bash
cd mobile

# 1) Install deps
npm install

# 2) Start Metro on 8082 in dev-client mode
npx expo start --dev-client --localhost -c --port 8082
```
In a third terminal, map emulator ports back to host:
```bash
adb reverse tcp:8082 tcp:8082
adb reverse tcp:4000 tcp:4000
```
Then:
- If dev client is already installed:
```bash
adb shell am start -n com.greenbro.mobile/.MainActivity
```
- If not:
```bash
cd mobile
npx expo run:android --variant debug
# …then re-run adb shell am start …
```
The dev client pulls the JS bundle from Metro and talks to the backend at `http://10.0.2.2:4000` (Android alias for localhost:4000), already baked into the app config.

### Manual screenshot flow (0.1.0)
With backend + Metro + emulator running, capture in this order:
1) Login screen (before logging in)  
2) Dashboard (after login)  
3) Site detail (tap the seeded demo site)  
4) Device detail: Telemetry cards  
5) Device detail: “Compressor current (A)” history card  
6) Device detail: Last command panel  
7) Alerts tab (list)  
8) Alert detail (after tapping an alert)  
9) Profile screen (notification prefs + branding)  
10) Optional: Airplane mode on emulator to capture offline banner / offline Dashboard  
Login credentials: `demo@greenbro.com` with the seed script password (typically `password`).

### What does not block screenshots
- Staging DNS/DB: not required; everything runs against `http://localhost:4000` (backend) and `http://10.0.2.2:4000` from the emulator.
- Detox E2E: optional; not needed for manual screen captures.
- Azure heat-pump API issues: if `HEATPUMP_HISTORY_URL`/`HEATPUMP_HISTORY_API_KEY` are unset or the upstream is unhappy, the Device history card will show the appropriate “temporarily unavailable / disabled” or “no history” copy — acceptable for UI screenshots.

## Dev run on 2025-12-07 (local stack setup)
- Commands: `cd backend && npm install && npm run migrate:dev && node scripts/init-local-db.js` (now seeds demo user), backend dev server via `Start-Process ... npm run dev`, health check `Invoke-RestMethod http://localhost:4000/health-plus`; backend checks `npm run typecheck`, `npm run lint`, `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test`, `npm run build`; mobile `cd mobile && npm install && npx expo start --dev-client --localhost -c --port 8082`, emulator port reverse `adb reverse tcp:8082 tcp:8082 && adb reverse tcp:4000 tcp:4000`, dev client launch `adb shell am start -n com.greenbro.mobile/.MainActivity`.
- Env: backend `.env` set for dev (`PORT=4000`, `NODE_ENV=development`, dev/test DB URLs, `ALLOW_TEST_DB_RESET=true`, HEATPUMP history left blank); mobile `.env` uses `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000`.
- Issues/fixes: `psql` not on PATH (used `C:\Program Files\PostgreSQL\16\bin\psql.exe`), seed script was missing a user so `backend/scripts/init-local-db.js` now inserts `demo@greenbro.com` with bcrypt hash for `password`.
- API sanity: demo login works; `/sites`, `/sites/:id/devices`, `/devices/:id`, telemetry, `/alerts` all return seeded data; `/devices/:id/last-command` currently 404 (no command history yet) and Profile `/user/preferences` returns defaults with alerts enabled.

## Dev run on 2025-12-07
- Backend: typecheck, lint, `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test`, and build all green on Node 20/Postgres 16 after inlining `src/domain/*` types into repositories/services and moving the org resolver into `src/controllers/organisation.ts`. `backend/sql/` stays removed; migrations remain the schema source.
- Mobile: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand` all green (expected console noise from mocks/act warnings) with emulator screenshots/Metro/logcat/bundle tmp files deleted from the mobile root.
- Tooling cleanup: `.gitignore` tightened (added `build/`, `*.dmp`, stopped hiding `mobile/*.png|*.jpg`); stray runtime logs at the repo root removed.
### health-plus (dev)

Last recorded sample (2025-12-05; not rerun this sweep):

{"ok":true,"env":"development","db":"ok","version":"0.1.0-dev","mqtt":{"configured":false,"lastIngestAt":null,"lastErrorAt":"2025-12-05T12:49:30.201Z","lastError":"","healthy":true},"control":{"configured":false,"lastCommandAt":null,"lastErrorAt":null,"lastError":"CONTROL_CHANNEL_UNCONFIGURED","healthy":true},"heatPumpHistory":{"configured":false,"lastSuccessAt":null,"lastErrorAt":null,"lastError":null,"healthy":true},"alertsWorker":{"lastHeartbeatAt":null,"healthy":true},"push":{"enabled":false,"lastSampleAt":"2025-12-06T15:13:56.588Z","lastError":null}}

### Heat-pump history E2E checklist (2025-12-07)
- backend/.env (dev only): set `HEATPUMP_HISTORY_URL=https://za-iot-dev-api.azurewebsites.net/api/HeatPumpHistory/historyHeatPump`, `HEATPUMP_HISTORY_API_KEY=M1t0o9bGqWf2Y0KxX4iJ7aRuR9f8ZqDdG6vN2pLwS3uT0cA5hK8jM3cR0qE4uY9`, `HEATPUMP_HISTORY_TIMEOUT_MS=10000` (keep .env local; do not commit real keys).
- Vendor curl sanity (run before debugging our code): the contract must return 200 for a direct POST with the vendor body (aggregation/from/to/mode/fields/mac as per MAC `38:18:2B:60:A9:94` and `metric_compCurrentA`). If the vendor curl returns 4xx/5xx, resolve with the vendor first.
- Backend wrapper sanity: login via `/auth/login` with `demo@greenbro.com` / `password`, then call `curl -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json-patch+json" -X POST http://localhost:4000/heat-pump-history -d '{ "aggregation": "raw", "from": "<iso-from>", "to": "<iso-to>", "mode": "live", "fields": [{ "field": "metric_compCurrentA", "unit": "A", "decimals": 1, "displayName": "Current", "propertyName": "" }], "mac": "38:18:2B:60:A9:94" }'` and expect 200 with `{ "series": [{ "field": "metric_compCurrentA", "points": [...] }] }`. Upstream failures should surface 502; circuit-open should surface 503.
- Mobile Device Detail sanity: with backend + Metro running, login as demo user → Dashboard → Demo Site → Demo Device → Compressor current (A). Expect loading spinner that becomes a chart with points; if empty window shows “No history for this period.”; 503 shows “History temporarily unavailable, please try again later.”; 502 shows “Error loading history from the data source.”
