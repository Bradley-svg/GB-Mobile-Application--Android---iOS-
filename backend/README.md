# Greenbro Backend

Node/Express API that powers the Greenbro mobile app. Includes authentication, site/device
CRUD, telemetry storage, and an MQTT ingest worker for time-series metrics.

## Telemetry storage

SQL to create telemetry tables (run against your Postgres instance):

- `sql/telemetry_schema.sql` – creates `telemetry_points` (time series) and
  `device_snapshots` (latest view) with indexes.

## Local development

```bash
npm install
# API server
npm run dev
# MQTT ingest worker (requires MQTT_* env vars)
npm run dev:mqtt
```

Copy `.env.example` to `.env` and fill in your Postgres, JWT, and MQTT connection values.
