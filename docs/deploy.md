# Deploying Greenbro (staging & production)

## Environments & services
- Backend: Node 20, Postgres 16, MQTT broker, Azure heat-pump history API reachability, optional Expo push (EXPO_ACCESS_TOKEN).
- Mobile: EAS builds pointing `EXPO_PUBLIC_API_URL` at the correct backend (staging or production).

## Required environment variables
- Backend core: `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`.
- Auth: `REFRESH_TOKEN_DAYS`, `AUTH_ALLOW_PUBLIC_SIGNUP`.
- Workers: `ALERT_WORKER_ENABLED`, `ALERT_WORKER_INTERVAL_SEC`, `WORKER_LOCK_TTL_SEC`.
- Integrations: `MQTT_URL` (+ `MQTT_USERNAME`/`MQTT_PASSWORD`), `CONTROL_API_URL`, `CONTROL_API_KEY`, `HEATPUMP_HISTORY_URL`, `HEATPUMP_HISTORY_API_KEY`, `HEATPUMP_HISTORY_TIMEOUT_MS`, Expo push (`EXPO_ACCESS_TOKEN`, optional `PUSH_HEALTHCHECK_*`).
- Logging: `LOG_LEVEL` (default `info`).
- Mobile: `EXPO_PUBLIC_API_URL` per environment plus any push/EAS profile envs.

## Deploy steps
### Staging
1) Provision Postgres 16 and an MQTT broker (or stub MQTT if not testing ingest).
2) Set env vars above (DATABASE_URL, JWT_SECRET, CORS_ALLOWED_ORIGINS, MQTT/control/heatPump/push as needed).
3) `npm ci`, then `npm run migrate` (DATABASE_URL must be set), then start the backend (`npm run build && npm start` or your process manager).
4) Seed demo data if desired: `node scripts/init-local-db.js` (expects migrations already applied).
5) Verify `curl /health-plus` shows `ok:true`, `mqtt.configured`/`control.configured` flags match your config, and `alertsWorker.healthy:true`.
6) Build/install a staging mobile app with an EAS profile that sets `EXPO_PUBLIC_API_URL` to the staging backend.

### Production
1) Provision Postgres 16 (with backups) and MQTT broker.
2) Set env vars with production secrets (`JWT_SECRET`, `HEATPUMP_HISTORY_API_KEY`, control/MQTT creds, CORS_ALLOWED_ORIGINS, LOG_LEVEL).
3) Run migrations as part of deployment (e.g., pre-deploy job: `npm ci && npm run migrate`).
4) Start backend via your supervisor (pm2/systemd/container). Do **not** run the demo seed script in production.
5) Point the production EAS build at the production API (`EXPO_PUBLIC_API_URL`).
6) Verify `/health-plus` shows `ok:true`, `mqtt.configured:true`/`control.configured:true` when wired, recent `alertsWorker.lastHeartbeatAt`, and heatPumpHistory config/health aligned with upstream.

## Staging 0.1.0 promotion checklist

Prereqs (outside this repo)
- DNS: `staging-api.greenbro.co.za` points at your staging backend host.
- DB: managed Postgres with a database named `greenbro_staging`.

One-time staging bootstrap
```
cd backend
export STAGING_DATABASE_URL=postgres://<user>:<pass>@<host>:<port>/greenbro_staging?sslmode=require
npm install
npm run staging:bootstrap
```

Check health
```
HEALTH_BASE_URL=https://staging-api.greenbro.co.za npm run health:check
```

Expect:
- HTTP 200
- `ok:true`
- `env:"production"`, `version:"0.1.0"`
- `db:"ok"`
- Known values for mqtt/control/heatPumpHistory based on your staging env.

Mobile staging build
```
cd mobile
npm install
npx eas build --platform android --profile staging
```

Install the artifact on a device and follow the smoke path in `docs/mobile-ux-notes.md`.

## Health expectations
- Staging without control/MQTT: `/health-plus` should report `configured:false` but `healthy:true` for MQTT/control, alerts worker heartbeat present if enabled.
- Production with integrations wired: `/health-plus` should show `configured:true` for MQTT/control/heatPumpHistory with `lastSuccessAt` timestamps within expected windows (MQTT ingest within ~5m of traffic, alerts worker heartbeat within ~2x `ALERT_WORKER_INTERVAL_SEC`), and no recent errors.

## Rollback notes
- Backend: redeploy the previous build or image tag; if using a process manager, restart with the last known-good artifact and verify `/health-plus`.
- Migrations: if a migration fails mid-deploy, fix the script and rerun `npm run migrate`. If data is corrupted or an irreversible migration shipped, restore the database from backup/snapshot, redeploy the prior app build, and rerun migrations only after the fix is ready.
