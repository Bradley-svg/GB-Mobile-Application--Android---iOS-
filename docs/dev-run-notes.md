## Dev run on 2025-12-06
- Starting full stack spin-up in VS Code.
- Verified local Postgres greenbro_dev/greenbro_test/greenbro_staging databases exist.
- Configured backend .env for local dev (APP_ENV=development, version 0.1.0-dev, dev/test DB URLs, JWT secret, alerts worker disabled, heat pump history envs unset).
### health-plus (dev)

{"ok":true,"env":"development","db":"ok","version":"0.1.0-dev","mqtt":{"configured":false,"lastIngestAt":null,"lastErrorAt":"2025-12-05T12:49:30.201Z","lastError":"","healthy":true},"control":{"configured":false,"lastCommandAt":null,"lastErrorAt":null,"lastError":"CONTROL_CHANNEL_UNCONFIGURED","healthy":true},"heatPumpHistory":{"configured":false,"lastSuccessAt":null,"lastErrorAt":null,"lastError":null,"healthy":true},"alertsWorker":{"lastHeartbeatAt":null,"healthy":true},"push":{"enabled":false,"lastSampleAt":"2025-12-06T15:13:56.588Z","lastError":null}}
- Backend npm install, migrate:dev, init-local-db, typecheck, lint, test (TEST_DATABASE_URL + ALLOW_TEST_DB_RESET), and build all succeeded (`npm test` uses Vitest serialization from `vitest.config.ts` so no Jest `--runInBand` flag is required).
- Backend dev server running via npm run dev (logs at logs/backend-dev-run.log).
- Mobile npm install completed.
- Mobile typecheck, lint, and npm test -- --runInBand passed (jest logs include expected act() warnings).
- Metro running via npx expo start --dev-client --localhost -c --port 8082 (logs at logs/metro-dev-run.log).
- Emulator Pixel_7_API_34 booted; adb reverse set for ports 8082 and 4000.
- Ran npx expo run:android (command timed out after ~10m but build progressed; package com.greenbro.mobile present; launched via adb to prompt bundle load, Metro still waiting to serve bundle).
- Manual app navigation and Detox E2E still pending.
- NetInfo native crash is guarded in JS via app/lib/safeNetInfo.ts; still need to rebuild the dev client with @react-native-community/netinfo bundled to get real connectivity events.

### Heat-pump history E2E checklist (2025-12-07)
- backend/.env (dev only): set `HEATPUMP_HISTORY_URL=https://za-iot-dev-api.azurewebsites.net/api/HeatPumpHistory/historyHeatPump`, `HEATPUMP_HISTORY_API_KEY=M1t0o9bGqWf2Y0KxX4iJ7aRuR9f8ZqDdG6vN2pLwS3uT0cA5hK8jM3cR0qE4uY9`, `HEATPUMP_HISTORY_TIMEOUT_MS=10000` (keep .env local; do not commit real keys).
- Vendor curl sanity (run before debugging our code): the contract must return 200 for a direct POST with the vendor body (aggregation/from/to/mode/fields/mac as per MAC `38:18:2B:60:A9:94` and `metric_compCurrentA`). If the vendor curl returns 4xx/5xx, resolve with the vendor first.
- Backend wrapper sanity: login via `/auth/login` with `demo@greenbro.com` / `password`, then call `curl -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json-patch+json" -X POST http://localhost:4000/heat-pump-history -d '{ "aggregation": "raw", "from": "<iso-from>", "to": "<iso-to>", "mode": "live", "fields": [{ "field": "metric_compCurrentA", "unit": "A", "decimals": 1, "displayName": "Current", "propertyName": "" }], "mac": "38:18:2B:60:A9:94" }'` and expect 200 with `{ "series": [{ "field": "metric_compCurrentA", "points": [...] }] }`. Upstream failures should surface 502; circuit-open should surface 503.
- Mobile Device Detail sanity: with backend + Metro running, login as demo user → Dashboard → Demo Site → Demo Device → Compressor current (A). Expect loading spinner that becomes a chart with points; if empty window shows “No history for this period.”; 503 shows “History temporarily unavailable, please try again later.”; 502 shows “Error loading history from the data source.”
