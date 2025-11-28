# Greenbro Backend

Node/Express API that powers the Greenbro mobile app. Includes authentication, site/device CRUD, telemetry storage, and workers for MQTT ingest and alert evaluation.

## Telemetry storage

SQL to create telemetry tables (run against your Postgres instance):

- `sql/telemetry_schema.sql` - creates `telemetry_points` (time series) and `device_snapshots` (latest view) with indexes.
- `sql/alerts_schema.sql` - creates alert tables with indexes for status and severity.
- `sql/push_tokens_schema.sql` - stores Expo push tokens per user for notifications.

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
