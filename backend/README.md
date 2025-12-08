# Greenbro Backend

Node/Express API that powers the Greenbro mobile app. Includes authentication, site/device CRUD, telemetry storage, and workers for MQTT ingest and alert evaluation.

## Environment variables
- Copy `.env.example` to `.env` and fill in real values.
- `DATABASE_URL` should point to your Postgres database.
- `JWT_SECRET` must be a long random string.
- `APP_VERSION` can be set to surface a release identifier via `/health-plus`.
- `LOG_LEVEL` controls the structured JSON logger level (info by default).
- `MQTT_*` are required if MQTT ingest is enabled.
- `ALERT_OFFLINE_MINUTES` / `ALERT_OFFLINE_CRITICAL_MINUTES` set the warning vs critical thresholds for offline alerts (only critical sends push); `ALERT_HIGH_TEMP_THRESHOLD` controls high-temp alerts.
- `CONTROL_*` configure HTTP control when enabled; `CONTROL_COMMAND_THROTTLE_MS` bounds repeat commands to the same device.
- `HEATPUMP_HISTORY_URL` / `HEATPUMP_HISTORY_API_KEY` configure the upstream Heat Pump History API client. Both are required when `NODE_ENV` is not `development`; missing values disable `/heat-pump-history` with a 503 instead of falling back to the dev URL. Legacy `HEAT_PUMP_*` envs are still accepted but deprecated.
- `EXPO_ACCESS_TOKEN` is optional but recommended for sending push notifications.

## Heat pump history
- Upstream Azure dev endpoint (`https://za-iot-dev-api.azurewebsites.net/api/HeatPumpHistory/historyHeatPump`) accepts the vendor payload shape: top-level `aggregation` (e.g., `"raw"`), `from`, `to`, `mode`, `fields`, and `mac`, sent as JSON (`content-type: application/json-patch+json`) with `x-api-key`.
- Responses come back as `series` entries with `name` + `data` pairs like `[[timestampMs, value], ...]`; the client normalizes these into `HeatPumpHistoryResponse.series[].points` with ISO timestamps and numeric values for the mobile app.
- `/heat-pump-history` now scopes by organisation and device: it resolves the device by ID within the requesting user’s org, uses the device’s stored MAC for the vendor call, returns 404 if the device is outside the org, and 400 if the device has no MAC configured. The vendor payload sent upstream stays `aggregation/from/to/mode/fields/mac` at the top level with `content-type: application/json-patch+json` and `accept: text/plain`.
- Manual probing: `npm run script:debug:heat-pump-history` runs `src/scripts/debugHeatPumpHistory.ts` against Azure. As of 2025-12-04, the vendor/top-level shape succeeds (HTTP 200); nested `query` variants return HTTP 400. Keep API keys in `.env`, never log them.
- The canonical env vars are `HEATPUMP_HISTORY_URL`, `HEATPUMP_HISTORY_API_KEY`, and `HEATPUMP_HISTORY_TIMEOUT_MS`; `HEAT_PUMP_*` names remain temporarily supported for compatibility only.

## Environments
- **development**: Run locally with `NODE_ENV=development` (default). `dotenv` loads values from `.env` (or `.env.development` if you prefer that naming) to point at your local `DATABASE_URL`, MQTT broker, etc. Logging can stay verbose here to aid debugging.
- **staging**: Deployed instance with `NODE_ENV=staging` and its own `DATABASE_URL`, `MQTT_URL`, and secrets. Configure these through your hosting provider's environment management (Railway, Render, etc.), not committed files.
- **production**: Deployed instance with `NODE_ENV=production` and production-grade database URLs, MQTT endpoints, and secrets, also injected via the hosting provider.

Environment files `.env.development`, `.env.staging`, and `.env.production` should **not** be committed; only `.env.example` is tracked as the template. CORS can be tightened per-environment later (e.g., restrict allowed origins in staging/prod while keeping local development more permissive).

## Database migrations
- Schema is managed via `node-pg-migrate` under `backend/migrations/`. Run `npm run migrate:dev` (or `npm run migrate` with `DATABASE_URL` set) to apply migrations locally, and `npm run migrate:test` against `TEST_DATABASE_URL` for test databases.
- Keep schema changes in migrations; the old `sql/*.sql` snapshots were removed to avoid drift with the migration source of truth.
- `scripts/init-local-db.js` now seeds demo data and expects the migrations to have already run.

## Telemetry storage

Telemetry data lives in `telemetry_points` (time series) and `device_snapshots` (latest view), created via migrations with supporting indexes. `alerts`, `control_commands`, `push_tokens`, `refresh_tokens`, and `system_status` are also migration-managed.

## Telemetry Ingest & Schema

HTTP telemetry ingest is disabled in this build. Only MQTT ingest is supported for v1; `POST /telemetry/http` responds with `501` to avoid unsafe usage.

### Incoming payload (MQTT or HTTP)
Messages land on `greenbro/{siteExternalId}/{deviceExternalId}/telemetry` and carry a normalized envelope with a timestamp plus core sensor readings. Example:

```json
{
  "timestamp": 1730000000000,
  "sensor": {
    "supply_temperature_c": 45.2,
    "return_temperature_c": 39.8,
    "power_w": 5400,
    "flow_lps": 0.28,
    "cop": 3.1
  },
  "meta": { "gateway": "gw-12" }
}
```

### Mapping into storage
- `telemetryIngestService` validates the topic, parses JSON, and looks up the device by `deviceExternalId`. Unknown topics or invalid payloads are ignored.
- Each numeric sensor field is normalized into canonical metrics (with unit conversion for watts -> kW):
  - `supply_temperature_c` -> `supply_temp`
  - `return_temperature_c` -> `return_temp`
  - `power_w` -> `power_kw`
  - `flow_lps` -> `flow_rate`
  - `cop` -> `cop`
- Only present numeric metrics are written to `telemetry_points` with `metric in ('supply_temp','return_temp','power_kw','flow_rate','cop')`, `ts` (payload timestamp or now), and `value`.
- `device_snapshots.data` keeps the latest payload in a canonical shape:

```json
{
  "metrics": {
    "supply_temp": 45.2,
    "return_temp": 39.8,
    "power_kw": 5.4,
    "flow_rate": 0.28,
    "cop": 3.1
  },
  "raw": {
    "timestamp": 1730000000000,
    "sensor": {
      "supply_temperature_c": 45.2,
      "return_temperature_c": 39.8,
      "power_w": 5400,
      "flow_lps": 0.28,
      "cop": 3.1
    },
    "meta": { "gateway": "gw-12" }
  }
}
```

Missing fields remain `null` in `metrics` but are preserved in `raw` for debugging.


### Reading telemetry
`GET /devices/:id/telemetry?range=24h|7d` returns time series grouped per metric:

```json
{
  "range": "24h",
  "metrics": {
    "supply_temp": [{ "ts": "2025-01-12T10:15:00.000Z", "value": 45.2 }],
    "return_temp": [],
    "power_kw": [{ "ts": "2025-01-12T10:15:00.000Z", "value": 5.4 }],
    "flow_rate": [{ "ts": "2025-01-12T10:15:00.000Z", "value": 0.28 }],
    "cop": [{ "ts": "2025-01-12T10:15:00.000Z", "value": 3.1 }]
  }
}
```

Alerts logic and the mobile UI depend on these metric names (`supply_temp`, `return_temp`, `power_kw`, `flow_rate`, `cop`), so keep them stable when extending the payload.

## Local development

```bash
npm install
# Apply migrations
npm run migrate:dev
# Seed demo data (sites/devices/sample telemetry)
node scripts/init-local-db.js
# API server
npm run dev
# MQTT ingest worker (requires MQTT_* env vars)
npm run dev:mqtt
# Alerts evaluation worker (uses ALERT_* env vars)
npm run dev:alerts
```

Copy `.env.example` to `.env` and fill in your Postgres, JWT, MQTT, and alert worker thresholds. Optional `EXPO_ACCESS_TOKEN` lets the Expo push SDK send through your project access token.
