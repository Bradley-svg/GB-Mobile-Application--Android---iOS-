# Greenbro Build Progress Report â€“ 0.1.0

_Date: 2025-12-07_  
_Scope: Backend API, workers, mobile app, branding, E2E tests, staging/deploy tooling._

## Executive Summary
- 0.1.0 remains staging-blocked pending DNS/infra bring-up; code and docs are ready for staging bootstrap once hosts and DB exist.
- Backend commands run this session: typecheck ok, lint ok, tests ok (`npm test` with Vitest serialized in config, no `--runInBand`), build ok. Mobile commands: typecheck ok (NetInfo mock typed to `NetInfoState`), lint ok, Jest tests ok (`--runInBand`).
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
- `npm run typecheck` ok (Node 20).
- `npm run lint` ok (eslint over `src`).
- `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test` ok (Vitest serialized via `vitest.config.ts`; `--runInBand` is not used).
- `npm run build` ok (tsc).

### Runtime health
- /health-plus was not hit in this session. Last recorded dev samples show env=development, version=0.1.0-dev, db ok, MQTT/control configured:false healthy:true (control lastError `CONTROL_CHANNEL_UNCONFIGURED`), heatPumpHistory configured true/healthy false when Azure idle; alerts worker healthy; push disabled unless Expo token provided.ã€1ace06â€ L12-L49ã€‘

### Known gaps / risks (backend)
- No password reset or 2FA/trusted-device protections (manual resets only).ã€ce037câ€ L1-L20ã€‘ã€d32464â€ L76-L83ã€‘
- Workers remain single-instance despite DB locks; no HA scheduler/metrics pipeline yet.ã€ce037câ€ L11-L20ã€‘ã€d32464â€ L91-L99ã€‘
- Metrics/alerting beyond health-plus and logs is absent; npm audit highs/moderates limited to dev tooling.ã€d32464â€ L45-L58ã€‘ã€d32464â€ L91-L99ã€‘

## Mobile Status
### App structure snapshot
- Navigation uses RootNavigator with Auth vs App stacks; App tabs: Dashboard, Alerts, Profile; stack detail screens for Site, Device (telemetry + control + heat-pump history), and Alert detail.ã€d32464â€ L12-L31ã€‘
- Domains: auth with refresh/secure store, telemetry + history hooks, control actions with pending/throttling UI, alerts list/detail with ack/mute, notification preferences backed by `/user/preferences`, and offline caches for Dashboard/Site/Device/Alerts.ã€d32464â€ L31-L40ã€‘ã€1ace06â€ L39-L70ã€‘

### Branding state
- Assets: app icon `mobile/assets/greenbro/greenbro-icon-1024.png`, splash `mobile/assets/greenbro/greenbro-splash.png`, horizontal logo `mobile/assets/greenbro/greenbro-logo-horizontal.png`; originals in `docs/branding/official/`.ã€075a58â€ L6-L16ã€‘
- Palette from `app/theme/colors.ts`: brandGreen `#39B54A`, darker gradient end `#2D9C3E`, brandGrey `#414042`, textPrimary `#111111`, textSecondary/muted `#555555`, background `#FFFFFF`/`#F5F7F9`, brandSoft `#E9F7EC`, borderSubtle `#E1E5EA`, error `#DC2626`, warning `#D97706`, success `#16A34A`, with gradients brandPrimary `#39B54A -> #2D9C3E` and brandSoft `#E9F7EC -> #FFFFFF`.ã€075a58â€ L10-L19ã€‘ã€ad3c9eâ€ L1-L26ã€‘
- Login/header use the horizontal logo; no split â€œGREEN BROâ€ or generated SVGs are present per branding rules.ã€075a58â€ L21-L30ã€‘

### UX robustness snapshot
- Session expiry covered via auth store/RootNavigator switching Auth/App stacks; offline banners and cached data for Dashboard/Site/Alerts/Device with commands/ack/mute disabled when offline; control UI shows pending/throttling and disables offline; heat-pump history card handles range selection, stale-data banners, and error copy; Profile push preferences toggle integrates OS permission and `/user/preferences` caching via React Query + AsyncStorage.ã€1ace06â€ L39-L70ã€‘ã€6d6a22â€ L3-L18ã€‘

### Tests & quality
- `npm run typecheck` ok (NetInfo mock/state now matches `NetInfoState` shape in `useNetworkBanner` test).
- `npm run lint` ok (eslint on `app/`).
- `npm test -- --runInBand` ok (17 suites, 46 tests).
- Unit/integration coverage spans auth/navigation/device/history/push/preferences; Detox E2E scaffold present for Android (appNavigation smoke) but not run in this session.

## E2E & Performance
- Detox setup (`mobile/e2e`, `detox.config.js`, Android test runner) targets navigation smoke: login -> dashboard -> site -> device -> alerts -> profile -> logout; build/test scripts `npm run e2e:build:android` and `npm run e2e:test:android` (requires Android SDK/emulator and backend at http://10.0.2.2:4000). Not executed here; status inferred from prior runs.ã€1ace06â€ L29-L38ã€‘
- Large-list Jest tests for Dashboard and Alerts ensure FlatList virtualization and offline cache behaviour with 600â€“800 item fixtures; pass in current test run.ã€1ace06â€ L33-L39ã€‘ã€743dd5â€ L33-L38ã€‘

## Staging / Deployment Readiness
- Staging bootstrap (`STAGING_DATABASE_URL=... npm run staging:bootstrap`) migrates and seeds demo data; `npm run health:check` hits `/health-plus` using `HEALTH_BASE_URL`. Requires staging DATABASE_URL, JWT_SECRET, CORS allowlist, APP_VERSION, HEATPUMP_*, CONTROL_*, WORKER_LOCK_TTL_SEC, ALERT_WORKER_* envs, and EXPO_ACCESS_TOKEN for push.ã€1ace06â€ L8-L27ã€‘ã€8047ecâ€ L1-L46ã€‘
- DNS/DB for `https://staging-api.greenbro.co.za` remain unavailable per last report, so staging deploy and mobile staging build are still blocked.ã€1ace06â€ L69-L86ã€‘ã€ce037câ€ L13-L23ã€‘

## Branding & Documentation
- Branding source of truth is `docs/branding/README.md`; approved artwork in `docs/branding/official/` and runtime assets in `mobile/assets/greenbro/`. No inline/fake logos or â€œGREEN BROâ€ lockups allowed; stay within defined palette/gradients.ã€075a58â€ L1-L30ã€‘

## Open Risks & To-Dos (P0â€“P3)
- **P0:** Password reset/2FA/trusted-device strategy unresolved; clarify or implement before production.ã€ce037câ€ L1-L20ã€‘
- **P1:** Improve control/worker robustness and metrics pipeline; add staging infra/DNS to enable real smoke runs and `/health-plus` checks.ã€ce037câ€ L13-L23ã€‘ã€d32464â€ L91-L99ã€‘
- **P2:** Expand offline cache/retry strategy and history UX depth; broaden E2E coverage beyond navigation smoke and large lists.ã€d32464â€ L99-L107ã€‘ã€1ace06â€ L33-L39ã€‘
- **P3:** UX polish and repo cleanup (act warnings in tests, optional Dev Client rebuild with NetInfo native module).ã€55f10bâ€ L16-L24ã€‘ã€6d6a22â€ L13-L20ã€‘

## Suggested next steps
1. Bring staging DNS/DB online, set env vars, and run `npm run staging:bootstrap` followed by `npm run health:check` against the staging host.
2. Execute Detox navigation smoke against local/staging backend and archive results/screenshots.
3. Decide on password reset/2FA path (implement or document internal-only) ahead of any production push.
4. Wire metrics/alerting pipeline (logs + health-plus scraping) and validate worker lock behaviour under load.
5. Once staging backend is live, trigger Expo staging build with `EXPO_PUBLIC_API_URL=https://staging-api.greenbro.co.za` and perform end-to-end smoke (login -> dashboard -> site -> device -> alerts -> profile -> logout).

