# Operational Readiness Checklist

Use this before staging/production releases to confirm services and clients are configured.

## Staging
- [ ] Web build - staging: staging envs set (`NEXT_PUBLIC_API_URL=https://staging.api.greenbro.co.za`, `NEXT_PUBLIC_EMBEDDED=true`); `npm run web:build:prod` passes; Vercel staging project + secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_STAGING`) present.
- [ ] Secrets populated with `NODE_ENV=production`, `APP_VERSION=0.8.0`, staging `DATABASE_URL`, `CORS_ALLOWED_ORIGINS`, strong `JWT_SECRET`, and 2FA settings (`AUTH_2FA_ENABLED=true`, `AUTH_2FA_ENFORCE_ROLES=owner,admin`).
- [ ] Migrations applied to the staging database; bootstrap/seed run where appropriate (`npm run staging:bootstrap`).
- [ ] `/health-plus` returns ok: db/storage writable, AV configured or explicitly disabled, push block reflects staging Expo token, MQTT/control/history blocks show configured vs disabled flags as intended.
- [ ] MQTT/control wired with vendor topics/commands: `MQTT_URL`/`MQTT_USERNAME`/`MQTT_PASSWORD` (and topic templates) present, `CONTROL_API_URL`/`CONTROL_API_KEY` set when enabled, disable flags false; `/health-plus` shows `mqttIngest.connected` after samples and `control.configured=true`.
- [ ] File storage root writable, `FILE_STORAGE_BASE_URL` points at the staging API/CDN origin, and `FILE_SIGNING_SECRET` set; signed URLs tested if enabled for mobile.
- [ ] AV scanner reachable when `AV_SCANNER_ENABLED=true`; failures investigated before release.
- [ ] Push: `EXPO_ACCESS_TOKEN` set, `PUSH_NOTIFICATIONS_ENABLED_ROLES` correct; `/me/push/test` succeeds from a staging client.
- [ ] Heat-pump history enabled: `HEATPUMP_HISTORY_URL`/`HEATPUMP_HISTORY_API_KEY` set, `HEATPUMP_HISTORY_DISABLED=false`, range caps aligned (`HEATPUMP_HISTORY_MAX_RANGE_HOURS`, `HEATPUMP_HISTORY_PAGE_HOURS`), `/health-plus.heatPumpHistory.configured=true` with recent `lastSuccessAt`.
- [ ] Audit MAC coverage before launch: `cd backend && npm run devices:missing-macs` (uses `DATABASE_URL`); fix any listed devices so history works per-device.
- [ ] Disable flags (`MQTT_DISABLED`, `CONTROL_API_DISABLED`, `HEATPUMP_HISTORY_DISABLED`, `PUSH_NOTIFICATIONS_DISABLED`) match the intended staging posture (CI/offline vs fully integrated); keep them false for prod-like staging.
- [ ] Alerts worker enabled with recent heartbeat; `DB_SLOW_QUERY_MS` tuned for staging.

## Production
- [ ] Web build - production: envs ready (`NEXT_PUBLIC_API_URL=https://api.greenbro.co.za`, `NEXT_PUBLIC_EMBEDDED=true`), `app.greenbro.co.za` mapped in Vercel production project (`VERCEL_PROJECT_ID_PROD`), and CI `web-deploy` workflow ready for tag-triggered release.
- [ ] Secrets set with production endpoints and unique secrets (`JWT_SECRET`, `FILE_SIGNING_SECRET`), `APP_VERSION=0.8.0`, and restricted `CORS_ALLOWED_ORIGINS`.
- [ ] Migrations applied as part of deployment; no demo seed data pushed to production.
- [ ] `/health-plus` green for db/storage/AV/push, MQTT/control/history configured with disable flags left `false`.
- [ ] MQTT/control endpoints reachable with correct topic templates/keys; `/health-plus` shows `mqttIngest.connected` with recent `lastMessageAt` and control status includes `lastCommandAt`/`lastError` as expected.
- [ ] File storage durable and writable; AV scanner enabled and reachable; signed URLs issued with a production-only signing secret.
- [ ] Push configured with production `EXPO_ACCESS_TOKEN`; sample push checks pass when enabled.
- [ ] MQTT/control/history endpoints reachable; vendor disable flags stay false unless deliberately offline (document if toggled). `HEATPUMP_HISTORY_URL`/`HEATPUMP_HISTORY_API_KEY` set with `HEATPUMP_HISTORY_DISABLED=false`; `/health-plus.heatPumpHistory` shows configured + recent success.
- [ ] Audit MAC coverage before launch: `cd backend && npm run devices:missing-macs` (uses `DATABASE_URL`); remediate missing MACs so history is available in clients.
- [ ] RBAC verified for owner/admin/facilities/contractor across control, work orders, documents, sharing, and QR/device lookup.

## Web
- [ ] Dev server healthy against the target API (`npm run dev:all` or backend up on :4000, then `npm run web:dev` on :3000 with `NEXT_PUBLIC_API_URL` set as needed).
- [ ] Unit + coverage run clean: `npm run web:test:coverage` (app/lib coverage thresholds 65/60/60/65).
- [ ] Browser smoke passes: `npm run web:e2e` against a seeded env (`WEB_E2E_BASE_URL`/`WEB_E2E_EMAIL`/`WEB_E2E_PASSWORD` set; Playwright browsers installed or workflow `web-e2e` triggered).

## Mobile
- [ ] `EXPO_PUBLIC_API_URL` matches the target environment in the chosen `eas.json` profile; Android versionCode and iOS buildNumber align with the release (0.8.0 / 8 / 0.8.0).
- [ ] Expo credentials available for the selected profile; staging/production builds reference the correct API URL.
- [ ] Lint/type/tests clean; Detox targets the Pixel_7_API_34 emulator with Metro on 8081.
- [ ] Push tested end-to-end against the target backend (registration + `/me/push/test` via Diagnostics).
- [ ] Branded assets/theme validated (light/dark/system), navigation and error guards hold across dashboard and device flows plus QR scanning.
