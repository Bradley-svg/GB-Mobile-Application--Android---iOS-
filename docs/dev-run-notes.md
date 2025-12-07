## Dev run on 2025-12-07
- Backend: typecheck, lint, `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test`, and build all green on Node 20/Postgres 16. Legacy `backend/sql/*.sql` snapshots removed; migrations remain the schema source.
- Mobile: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand` all green (expected console noise from mocks/act warnings).
- Tooling cleanup: `.gitignore` now ignores Detox `artifacts/` and backend `$log*`; tracked `$logA`/`$logB` removed.
### health-plus (dev)

Last recorded sample (2025-12-05; not rerun this sweep):

{"ok":true,"env":"development","db":"ok","version":"0.1.0-dev","mqtt":{"configured":false,"lastIngestAt":null,"lastErrorAt":"2025-12-05T12:49:30.201Z","lastError":"","healthy":true},"control":{"configured":false,"lastCommandAt":null,"lastErrorAt":null,"lastError":"CONTROL_CHANNEL_UNCONFIGURED","healthy":true},"heatPumpHistory":{"configured":false,"lastSuccessAt":null,"lastErrorAt":null,"lastError":null,"healthy":true},"alertsWorker":{"lastHeartbeatAt":null,"healthy":true},"push":{"enabled":false,"lastSampleAt":"2025-12-06T15:13:56.588Z","lastError":null}}

### Heat-pump history E2E checklist (2025-12-07)
- backend/.env (dev only): set `HEATPUMP_HISTORY_URL=https://za-iot-dev-api.azurewebsites.net/api/HeatPumpHistory/historyHeatPump`, `HEATPUMP_HISTORY_API_KEY=M1t0o9bGqWf2Y0KxX4iJ7aRuR9f8ZqDdG6vN2pLwS3uT0cA5hK8jM3cR0qE4uY9`, `HEATPUMP_HISTORY_TIMEOUT_MS=10000` (keep .env local; do not commit real keys).
- Vendor curl sanity (run before debugging our code): the contract must return 200 for a direct POST with the vendor body (aggregation/from/to/mode/fields/mac as per MAC `38:18:2B:60:A9:94` and `metric_compCurrentA`). If the vendor curl returns 4xx/5xx, resolve with the vendor first.
- Backend wrapper sanity: login via `/auth/login` with `demo@greenbro.com` / `password`, then call `curl -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json-patch+json" -X POST http://localhost:4000/heat-pump-history -d '{ "aggregation": "raw", "from": "<iso-from>", "to": "<iso-to>", "mode": "live", "fields": [{ "field": "metric_compCurrentA", "unit": "A", "decimals": 1, "displayName": "Current", "propertyName": "" }], "mac": "38:18:2B:60:A9:94" }'` and expect 200 with `{ "series": [{ "field": "metric_compCurrentA", "points": [...] }] }`. Upstream failures should surface 502; circuit-open should surface 503.
- Mobile Device Detail sanity: with backend + Metro running, login as demo user → Dashboard → Demo Site → Demo Device → Compressor current (A). Expect loading spinner that becomes a chart with points; if empty window shows “No history for this period.”; 503 shows “History temporarily unavailable, please try again later.”; 502 shows “Error loading history from the data source.”
