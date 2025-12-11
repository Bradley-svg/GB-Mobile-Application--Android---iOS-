# Deploying staging from a clean environment

Use these steps to bring up staging without assuming prior state.

## Prerequisites
- Node 20+, Postgres 16, and an Expo/EAS-capable workstation.
- DNS for `staging-api.greenbro.co.za` (or equivalent) pointing at your staging host/load balancer.
- A Postgres database for staging (for example `greenbro_staging`) and an Expo project ready for staging builds.

## Bootstrap steps
1) Clone the repo
```
git clone <repo-url> greenbro && cd greenbro
```
2) Backend env file
- Copy `backend/.env.example` to `backend/.env.staging` (do not commit).
- Populate placeholders for staging:
  - `NODE_ENV=production`, `APP_VERSION=0.7.0`, `PORT=4000`
  - `DATABASE_URL=postgres://<host>:5432/greenbro_staging`
  - `CORS_ALLOWED_ORIGINS=https://staging.greenbro.co.za`
  - Long `JWT_SECRET`, `AUTH_2FA_ENABLED=true`, `AUTH_2FA_ENFORCE_ROLES=owner,admin`
  - Storage/signing: `FILE_STORAGE_ROOT=/var/lib/greenbro/storage`, `FILE_STORAGE_BASE_URL=https://staging-api.greenbro.co.za/files`, `FILE_SIGNING_SECRET=<unique>`
  - AV: `AV_SCANNER_ENABLED=true` with `AV_SCANNER_CMD` or `AV_SCANNER_HOST`/`AV_SCANNER_PORT`
  - Integrations: `MQTT_URL`, `CONTROL_API_URL`/`CONTROL_API_KEY`, `HEATPUMP_HISTORY_URL`/`HEATPUMP_HISTORY_API_KEY`, or explicitly set the `*_DISABLED` flags.
  - Push: `EXPO_ACCESS_TOKEN=<staging token>`, `PUSH_NOTIFICATIONS_ENABLED_ROLES=owner,admin,facilities`
3) Install backend deps and bootstrap the database
```
cd backend
npm ci
$env:STAGING_DATABASE_URL="postgres://<host>:5432/greenbro_staging"
npm run staging:bootstrap
```
  - Bash equivalent: `STAGING_DATABASE_URL=postgres://<host>:5432/greenbro_staging ./scripts/bootstrap-staging.sh`
4) Start the backend (production mode)
```
npm run build
$env:DATABASE_URL="postgres://<host>:5432/greenbro_staging"; $env:NODE_ENV="production"; $env:APP_VERSION="0.7.0"; npm start
```
Use your process manager (systemd/pm2/container) for persistent hosting.

## Mobile staging build
1) Ensure the staging API URL is set via `EXPO_PUBLIC_API_URL` (already provided in `eas.json` staging profile).
2) Build and install the staging client
```
cd ../mobile
npm ci
npx eas build --platform android --profile staging
```
Install the resulting artifact on a device/emulator.

## Smoke curl examples (staging)
Replace placeholders with staging values; keep credentials out of commits/logs.
```
curl https://staging-api.greenbro.co.za/health-plus

curl -X POST https://staging-api.greenbro.co.za/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"<staging-user>\",\"password\":\"<redacted>\"}"

curl -X POST https://staging-api.greenbro.co.za/auth/request-password-reset ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"<staging-user>@example.com\"}"

curl -X POST https://staging-api.greenbro.co.za/heat-pump-history ^
  -H "Authorization: Bearer <token>" ^
  -H "Content-Type: application/json" ^
  -d "{\"deviceId\":\"<device-uuid>\",\"rangeHours\":6}"

curl https://staging-api.greenbro.co.za/alerts ^
  -H "Authorization: Bearer <token>"
```
- Expect `/health-plus` to show db/storage/AV status, vendor disable flags, and `version: "0.7.0"`.
- For login, staging credentials should reflect seeded bootstrap users; rotate passwords via `/auth/reset-password` before sharing with testers.
