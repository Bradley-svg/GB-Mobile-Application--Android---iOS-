# Greenbro Build Progress Report – 0.1.0

_Date: 2025-12-07_  
_Scope: Backend API, workers, mobile app, branding, E2E tests, staging/deploy tooling._

## Executive Summary
- 0.1.0 remains staging-blocked pending DNS/infra bring-up; code and docs are ready for staging bootstrap once hosts and DB exist.
- Backend commands run this session: typecheck ✅, lint ✅, tests ❌ (vitest rejected `--runInBand` flag), build ✅. Mobile commands: typecheck ❌ (NetInfo test type mismatch), lint ✅, Jest tests ✅.
- Critical gaps unchanged: no password reset/2FA, workers are single-instance despite DB locks, and metrics/alerting pipeline is still absent.
- Branding is aligned with the approved GREENBRO assets and palette (app icon/splash/login/header using the provided PNGs and theme colours).
- Runtime health not exercised here; health-plus expectations rely on prior dev runs (ok true/false depending on configured integrations; heat-pump history/control often unconfigured in dev).
- Build status for unavailable checks is inferred from previous reports where node/Postgres are required.

## Backend Status
### Code & architecture snapshot
- Express API layered per docs: `src/controllers` and `src/routes` for auth/sites/devices/alerts/health/telemetry stub/heat-pump history; `src/services` handling auth, telemetry ingest/read with downsampling, alerts, control, push, status, sites/devices, user preferences; `src/repositories` for users/refresh tokens/sites/devices/telemetry/alerts/control_commands/push_tokens/system_status/worker_locks; integrations for MQTT ingest/control, HTTP control, Expo push, Azure heat-pump history; middleware for auth/CORS/errors; workers for mqttIngest and alertsWorker; scripts for snapshot backfill and history debug; migrations under `migrations/` with node-pg-migrate baseline.
- Key integrations: MQTT ingest on `greenbro/+/+/telemetry`, control over MQTT or HTTP with throttle and `/devices/:id/last-command`, Azure heat-pump history client with circuit breaker, Expo push sampling, worker locks to avoid double-run, and structured pino logging.

### Recent changes since early 0.1.0 work
- Worker locks added for MQTT ingest and alerts worker (DB-backed TTL).
- Structured JSON logging via pino; console.* replaced.
- Migrations established under node-pg-migrate including `worker_locks`.
- Staging bootstrap script (`npm run staging:bootstrap`) and `health:check` wiring.
- Control throttling and last-command endpoint; logout and logout-all flows; user preferences at `/user/preferences` with default alerts enabled.
- Heat-pump history client guarded with circuit breaker and timeout.
- Test harness seeds demo data, sites/devices, and status rows before API tests.

### Build & test status (this session)
- `npm run typecheck` — ✅ (Node 20).【734a67†L1-L6】【139ad6†L1-L1】
- `npm run lint` — ✅ (eslint over `src`).【a660db†L1-L5】【e2ed81†L1-L1】
- `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test -- --runInBand` — ❌ (`vitest` does not accept `--runInBand`).【5771c7†L1-L22】
- `npm run build` — ✅ (tsc).【76acc2†L1-L5】【3a8ce7†L1-L1】

### Runtime health
- /health-plus was not hit in this session. Last recorded dev samples show env=development, version=0.1.0-dev, db ok, MQTT/control configured:false healthy:true (control lastError `CONTROL_CHANNEL_UNCONFIGURED`), heatPumpHistory configured true/healthy false when Azure idle; alerts worker healthy; push disabled unless Expo token provided.【1ace06†L12-L49】

### Known gaps / risks (backend)
- No password reset or 2FA/trusted-device protections (manual resets only).【ce037c†L1-L20】【d32464†L76-L83】
- Workers remain single-instance despite DB locks; no HA scheduler/metrics pipeline yet.【ce037c†L11-L20】【d32464†L91-L99】
- Metrics/alerting beyond health-plus and logs is absent; npm audit highs/moderates limited to dev tooling.【d32464†L45-L58】【d32464†L91-L99】

## Mobile Status
### App structure snapshot
- Navigation uses RootNavigator with Auth vs App stacks; App tabs: Dashboard, Alerts, Profile; stack detail screens for Site, Device (telemetry + control + heat-pump history), and Alert detail.【d32464†L12-L31】
- Domains: auth with refresh/secure store, telemetry + history hooks, control actions with pending/throttling UI, alerts list/detail with ack/mute, notification preferences backed by `/user/preferences`, and offline caches for Dashboard/Site/Device/Alerts.【d32464†L31-L40】【1ace06†L39-L70】

### Branding state
- Assets: app icon `mobile/assets/greenbro/greenbro-icon-1024.png`, splash `mobile/assets/greenbro/greenbro-splash.png`, horizontal logo `mobile/assets/greenbro/greenbro-logo-horizontal.png`; originals in `docs/branding/official/`.【075a58†L6-L16】
- Palette from `app/theme/colors.ts`: brandGreen `#39B54A`, darker gradient end `#2D9C3E`, brandGrey `#414042`, textPrimary `#111111`, textSecondary/muted `#555555`, background `#FFFFFF`/`#F5F7F9`, brandSoft `#E9F7EC`, borderSubtle `#E1E5EA`, error `#DC2626`, warning `#D97706`, success `#16A34A`, with gradients brandPrimary `#39B54A -> #2D9C3E` and brandSoft `#E9F7EC -> #FFFFFF`.【075a58†L10-L19】【ad3c9e†L1-L26】
- Login/header use the horizontal logo; no split “GREEN BRO” or generated SVGs are present per branding rules.【075a58†L21-L30】

### UX robustness snapshot
- Session expiry covered via auth store/RootNavigator switching Auth/App stacks; offline banners and cached data for Dashboard/Site/Alerts/Device with commands/ack/mute disabled when offline; control UI shows pending/throttling and disables offline; heat-pump history card handles range selection, stale-data banners, and error copy; Profile push preferences toggle integrates OS permission and `/user/preferences` caching via React Query + AsyncStorage.【1ace06†L39-L70】【6d6a22†L3-L18】

### Tests & quality
- `npm run typecheck` — ❌ (NetInfo mock missing `type/details` in `useNetworkBanner` test).【656353†L1-L9】
- `npm run lint` — ✅ (eslint on `app/`).【bc435e†L1-L5】【6c52d8†L1-L1】
- `npm test -- --runInBand` — ✅ (17 suites, 46 tests).【0b21d0†L1-L5】【743dd5†L1-L41】
- Unit/integration coverage spans auth/navigation/device/history/push/preferences; Detox E2E scaffold present for Android (appNavigation smoke) but not run in this session.【1ace06†L29-L38】【d32464†L40-L56】

## E2E & Performance
- Detox setup (`mobile/e2e`, `detox.config.js`, Android test runner) targets navigation smoke: Login → Dashboard → Site → Device → Alerts → Profile → Logout; build/test scripts `npm run e2e:build:android` and `npm run e2e:test:android` (requires Android SDK/emulator and backend at http://10.0.2.2:4000). Not executed here; status inferred from prior runs.【1ace06†L29-L38】
- Large-list Jest tests for Dashboard and Alerts ensure FlatList virtualization and offline cache behaviour with 600–800 item fixtures; pass in current test run.【1ace06†L33-L39】【743dd5†L33-L38】

## Staging / Deployment Readiness
- Staging bootstrap (`STAGING_DATABASE_URL=... npm run staging:bootstrap`) migrates and seeds demo data; `npm run health:check` hits `/health-plus` using `HEALTH_BASE_URL`. Requires staging DATABASE_URL, JWT_SECRET, CORS allowlist, APP_VERSION, HEATPUMP_*, CONTROL_*, WORKER_LOCK_TTL_SEC, ALERT_WORKER_* envs, and EXPO_ACCESS_TOKEN for push.【1ace06†L8-L27】【8047ec†L1-L46】
- DNS/DB for `https://staging-api.greenbro.co.za` remain unavailable per last report, so staging deploy and mobile staging build are still blocked.【1ace06†L69-L86】【ce037c†L13-L23】

## Branding & Documentation
- Branding source of truth is `docs/branding/README.md`; approved artwork in `docs/branding/official/` and runtime assets in `mobile/assets/greenbro/`. No inline/fake logos or “GREEN BRO” lockups allowed; stay within defined palette/gradients.【075a58†L1-L30】

## Open Risks & To-Dos (P0–P3)
- **P0:** Password reset/2FA/trusted-device strategy unresolved; clarify or implement before production.【ce037c†L1-L20】
- **P1:** Improve control/worker robustness and metrics pipeline; add staging infra/DNS to enable real smoke runs and `/health-plus` checks.【ce037c†L13-L23】【d32464†L91-L99】
- **P2:** Expand offline cache/retry strategy and history UX depth; broaden E2E coverage beyond navigation smoke and large lists.【d32464†L99-L107】【1ace06†L33-L39】
- **P3:** UX polish and repo cleanup (act warnings in tests, optional Dev Client rebuild with NetInfo native module).【55f10b†L16-L24】【6d6a22†L13-L20】

## Suggested next steps
1. Bring staging DNS/DB online, set env vars, and run `npm run staging:bootstrap` followed by `npm run health:check` against the staging host.
2. Re-run backend vitest without the unsupported `--runInBand` flag (or configure serial via config) to validate tests in this environment.
3. Fix `useNetworkBanner` test type expectations to restore mobile typecheck green, then re-run lint/tests.
4. Execute Detox navigation smoke against local/staging backend and archive results/screenshots.
5. Decide on password reset/2FA path (implement or document internal-only) ahead of any production push.
6. Wire metrics/alerting pipeline (logs + health-plus scraping) and validate worker lock behaviour under load.
7. Once staging backend is live, trigger Expo staging build with `EXPO_PUBLIC_API_URL=https://staging-api.greenbro.co.za` and perform end-to-end smoke (login → dashboard → site → device → alerts → profile → logout).
