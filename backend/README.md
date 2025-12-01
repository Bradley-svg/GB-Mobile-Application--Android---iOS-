# Greenbro Backend

Node/Express API that powers the Greenbro mobile app. Includes authentication, site/device CRUD, telemetry storage, and workers for MQTT ingest and alert evaluation.

## Environment variables
- Copy `.env.example` to `.env` and fill in real values.
- `DATABASE_URL` should point to your Postgres database.
- `JWT_SECRET` must be a long random string.
- `APP_VERSION` can be set to surface a release identifier via `/health-plus`.
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
- `sql/refresh_tokens_schema.sql` - keeps refresh token rotation/revocation records.

## Telemetry Ingest & Schema

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
# API server
npm run dev
# MQTT ingest worker (requires MQTT_* env vars)
npm run dev:mqtt
# Alerts evaluation worker (uses ALERT_* env vars)
npm run dev:alerts
```

Copy `.env.example` to `.env` and fill in your Postgres, JWT, MQTT, and alert worker thresholds. Optional `EXPO_ACCESS_TOKEN` lets the Expo push SDK send through your project access token.
