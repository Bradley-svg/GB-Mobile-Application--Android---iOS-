# Greenbro Backend

Node/Express API that powers the Greenbro mobile app. Includes authentication, site/device CRUD, telemetry storage, and workers for MQTT ingest and alert evaluation.

## Environment variables
- Copy `.env.example` to `.env` and fill in real values.
- `DATABASE_URL` should point to your Postgres database.
- `JWT_SECRET` must be a long random string.
- `MQTT_*` are required if MQTT ingest is enabled.
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
