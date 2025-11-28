# Greenbro Backend

Node/Express API that powers the Greenbro mobile app. Includes authentication, site/device CRUD, telemetry storage, and workers for MQTT ingest and alert evaluation.

## Environment variables
- Copy `.env.example` to `.env` and fill in real values.
- `DATABASE_URL` should point to your Postgres database.
- `JWT_SECRET` must be a long random string.
- `MQTT_*` are required if MQTT ingest is enabled.
- `ALERT_OFFLINE_MINUTES` / `ALERT_OFFLINE_CRITICAL_MINUTES` set the warning vs critical thresholds for offline alerts (only critical sends push); `ALERT_HIGH_TEMP_THRESHOLD` controls high-temp alerts.
- `TELEMETRY_*` and `CONTROL_*` are only needed if using HTTP providers.
- `EXPO_ACCESS_TOKEN` is optional but recommended for sending push notifications.

## Environments
- **development**: Run locally with `NODE_ENV=development` (default). `dotenv` loads values from `.env` (or `.env.development` if you prefer that naming) to point at your local `DATABASE_URL`, MQTT broker, etc. Logging can stay verbose here to aid debugging.
- **staging**: Deployed instance with `NODE_ENV=staging` and its own `DATABASE_URL`, `MQTT_URL`, and secrets. Configure these through your hosting provider's environment management (Railway, Render, etc.), not committed files.
- **production**: Deployed instance with `NODE_ENV=production` and production-grade database URLs, MQTT endpoints, and secrets, also injected via the hosting provider.

Environment files `.env.development`, `.env.staging`, and `.env.production` should **not** be committed; only `.env.example` is tracked as the template. CORS can be tightened per-environment later (e.g., restrict allowed origins in staging/prod while keeping local development more permissive).

## Telemetry storage

SQL to create telemetry tables (run against your Postgres instance):

- `sql/telemetry_schema.sql` - creates `telemetry_points` (time series) and `device_snapshots` (latest view) with indexes.
- `sql/alerts_schema.sql` - creates alert tables with indexes for status and severity.
- `sql/push_tokens_schema.sql` - stores Expo push tokens per user for notifications.

## Telemetry Ingest & Schema

### Incoming payload (MQTT or HTTP)
`telemetryIngestService` accepts MQTT messages and HTTP posts with a normalized envelope containing a timestamp plus core sensor readings. Example:

```json
{
  "device_id": "heatpump-1234",
  "timestamp": "2025-01-12T10:15:00.000Z",
  "supply_temp_c": 45.2,
  "return_temp_c": 39.8,
  "power_kw": 5.4,
  "flow_lpm": 18.2,
  "cop": 3.1
}
```

### Mapping into storage
- The ingest service normalizes units and names (e.g., `supply_temp_c` -> `supply_temp`, `flow_lpm` -> `flow_rate`) before writing.
- For each numeric field it writes a `telemetry_points` row:
  - `device_id` from payload
  - `metric` in `{supply_temp, return_temp, power_kw, flow_rate, cop}`
  - `ts` from `timestamp`
  - `value` from the corresponding field after normalization
- It also updates `device_snapshots.data` to keep the latest view per device using a canonical shape:

```json
{
  "metrics": {
    "supply_temp": { "ts": "2025-01-12T10:15:00.000Z", "value": 45.2 },
    "return_temp": { "ts": "2025-01-12T10:15:00.000Z", "value": 39.8 },
    "power_kw": { "ts": "2025-01-12T10:15:00.000Z", "value": 5.4 },
    "flow_rate": { "ts": "2025-01-12T10:15:00.000Z", "value": 18.2 },
    "cop": { "ts": "2025-01-12T10:15:00.000Z", "value": 3.1 }
  },
  "raw": {
    "device_id": "heatpump-1234",
    "timestamp": "2025-01-12T10:15:00.000Z",
    "supply_temp_c": 45.2,
    "return_temp_c": 39.8,
    "power_kw": 5.4,
    "flow_lpm": 18.2,
    "cop": 3.1
  }
}
```

### Reading telemetry
`GET /devices/:id/telemetry?range=24h|7d` returns metric series for the selected window:

```json
{
  "range": "24h",
  "metrics": {
    "supply_temp": [{ "ts": "2025-01-12T10:15:00.000Z", "value": 45.2 }],
    "return_temp": [{ "ts": "2025-01-12T10:15:00.000Z", "value": 39.8 }],
    "power_kw": [{ "ts": "2025-01-12T10:15:00.000Z", "value": 5.4 }],
    "flow_rate": [{ "ts": "2025-01-12T10:15:00.000Z", "value": 18.2 }],
    "cop": [{ "ts": "2025-01-12T10:15:00.000Z", "value": 3.1 }]
  }
}
```

`alertsWorker` and the mobile app both rely on these metric names (`supply_temp`, `return_temp`, `power_kw`, `flow_rate`, `cop`), so keep them stable when adding fields or changing ingest logic.

## Local development

```bash
npm install
# API server
npm run dev
# MQTT ingest worker (requires MQTT_* env vars)
npm run dev:mqtt
# Alerts evaluation worker (uses ALERT_* env vars)
npm run dev:alerts
```

Copy `.env.example` to `.env` and fill in your Postgres, JWT, MQTT, and alert worker thresholds. Optional `EXPO_ACCESS_TOKEN` lets the Expo push SDK send through your project access token.
