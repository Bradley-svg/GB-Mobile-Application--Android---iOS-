# Developer setup

Pragmatic notes for getting the backend, worker, and Expo app running locally.

## Prerequisites
- Node 20.x with npm.
- Postgres 14+ running locally (or a remote connection string).
- Android Studio + emulator (Pixel/Android 14 works) or a physical device with Expo Go.
- Optional: bash/PowerShell if you want to use the helper scripts.
- Optional: VS Code Dev Containers; opening the repo will launch the devcontainer defined in `.devcontainer/devcontainer.json` using `docker-compose.dev.yml` to start Postgres + MQTT alongside a Node 20 workspace.

## Environment files
- `backend/.env` – copy from `.env.example` and set:
  - `DATABASE_URL=postgres://USER:PASS@HOST:5432/greenbro_dev`
  - `JWT_SECRET` to a long random string.
  - `CORS_ALLOWED_ORIGINS` for prod-like runs (e.g. `https://app.greenbro.co.za`).
  - `MQTT_URL` and credentials if you want live telemetry ingest.
  - `CONTROL_API_URL` + `CONTROL_API_KEY` if HTTP control is wired; otherwise leave blank to force MQTT.
  - `EXPO_ACCESS_TOKEN` if you want push notifications; toggle `PUSH_HEALTHCHECK_ENABLED` to allow the `/health-plus` sample push.
- `mobile/.env` – copy from `.env.example` and set:
  - `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000` for Android emulator.
  - Use your LAN IP for real devices, or a staging URL once that exists.

## Database
From `backend/` run:
```bash
npm run migrate:dev
node scripts/init-local-db.js
```
Migrations create/align the schema; the seed script populates a demo org/site/device plus telemetry and a sample alert.
Tests run migrations automatically against `TEST_DATABASE_URL`, but you can run `npm run migrate:test` yourself when preparing a fresh test database.

## Running services
- Backend API: `cd backend && npm run dev`
- Alerts worker: `cd backend && npm run dev:alerts`
- MQTT ingest worker (if `MQTT_URL` is set): `cd backend && npm run dev:mqtt`
- Expo app: `cd mobile && npx expo start --localhost -c` then press `a` for Android emulator or scan the QR code on device.

Helper scripts in the repo root:
- `./dev.sh` (bash) or `.\dev.ps1` (PowerShell) starts backend, alerts worker, and Expo together. Stop with `Ctrl+C` and the script will tear down the child processes.

## Happy-path sanity checks
1) Backend: `curl http://localhost:4000/health-plus` (expects `ok:true` with MQTT/control/worker/push status).
2) Mobile: login with the seeded user, navigate Dashboard → Site → Device → Alerts → Profile → Logout.
3) Control commands: expect clear error messages when control is not configured (HTTP API key missing or MQTT URL absent).
4) Alerts: ack/mute flows should scope to the org seeded above.
