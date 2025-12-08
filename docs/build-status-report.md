**Greenbro Build Status (local sweep 2025-12-08)**

- **Backend**
- Commands executed this sweep (Node 20 / Postgres 16): `npm run migrate:dev`; `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm run migrate:test`; `npm test`; `npm run build` — all passed on Postgres-backed runs; migrations/tests now run against Postgres each sweep. Typecheck/lint last known green on 2025-12-07 (not rerun). Fixes: auth refresh tests now return user context with role, schedule RBAC tokens include role claims, and control spy cleanup lives in `afterAll`. Vitest held to single-thread/file-serial in `vitest.config.ts`; no Jest `--runInBand` flag needed.
  - Migrations: node-pg-migrate baseline under `backend/migrations/` (includes `worker_locks`); `npm run migrate:dev` / `npm run migrate:test` wire to DATABASE_URL/TEST_DATABASE_URL; test harness runs migrations before seeding. Legacy `sql/*.sql` references removed to keep migrations as the source of truth.
  - `STAGING_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_staging npm run staging:bootstrap` (env guard) applied migrations and demo seed on a local staging DB for a dry-run; summary `{"stage":"staging","db":"ok","migrations":"applied","seed":"ok"}`.
  - Preferences: `/user/preferences` GET/PUT backed by `user_preferences` (`alerts_enabled` default true) with API coverage for auth/validation/default/update paths.
  - Logging: pino JSON logger to stdout with `LOG_LEVEL` (default info) and service/env fields; console.* replaced across API/workers/scripts.
  - Workers: MQTT ingest + alerts worker take DB locks (`worker_locks`) with configurable TTL (`WORKER_LOCK_TTL_SEC`); non-owners log and exit/idle rather than double-run.
  - Auth: login/refresh/me plus logout and logout-all are live; password reset endpoint remains intentionally absent.
  - Control: throttling enforced from the last command in DB; `/devices/:id/last-command` surfaces the latest control attempt; supports MQTT or HTTP control channel via env (`CONTROL_COMMAND_THROTTLE_MS` for the window). Health-plus currently shows `configured:false` with lastError `CONTROL_CHANNEL_UNCONFIGURED` (dev run without control config).
  - Telemetry: HTTP ingest route stays a 501 stub; telemetry read path enforces maxPoints with downsampling and metric bounds.
  - Health: not rerun this sweep; last dev `health:check` (2025-12-05) exited non-zero because `ok:false` while Azure history was configured:true/healthy:false (dev keeps HEATPUMP_HISTORY_* set; upstream idle/unconfigured). Body from that sample:
    ```json
    {
      "ok": false,
      "env": "development",
      "db": "ok",
      "version": "0.1.0-dev",
      "mqtt": {
        "configured": false,
        "lastIngestAt": null,
        "lastErrorAt": "2025-12-05T12:49:30.201Z",
        "lastError": "",
        "healthy": true
      },
      "control": {
        "configured": false,
        "lastCommandAt": null,
        "lastErrorAt": null,
        "lastError": "CONTROL_CHANNEL_UNCONFIGURED",
        "healthy": true
      },
      "heatPumpHistory": {
        "configured": true,
        "lastSuccessAt": null,
        "lastErrorAt": null,
        "lastError": null,
        "healthy": false
      },
      "alertsWorker": {
        "lastHeartbeatAt": null,
        "healthy": true
      },
      "push": {
        "enabled": false,
        "lastSampleAt": "2025-12-05T21:11:14.538Z",
        "lastError": null
      }
    }
    ```

- **Mobile**
  - npm run typecheck, npm run lint, npm test -- --runInBand all green locally after wiring preferences to `/user/preferences` (lint briefly failed on share-link `no-explicit-any` but is now typed/fixed; `act()` warnings still appear from global wrappers). Latest spot run: `npm test -- --runInBand app/__tests__/DashboardLargeList.test.tsx app/__tests__/AlertsLargeList.test.tsx`.
  - Branding: horizontal logo now uses the gear-as-O artwork (`docs/branding/official/greenbro-logo-horizontal-gearO.png` → `mobile/assets/greenbro/greenbro-logo-horizontal.png`); icon and splash remain unchanged. Files touched: the two logo PNGs and `mobile/app/navigation/RootNavigator.tsx` for the header logo component.
  - Cleanup this sweep: deleted emulator screenshots/Metro/logcat/bundle tmp files from the mobile root so only canonical assets remain under `assets/greenbro/`.
  - Detox scaffolded for Android with `detox.config.js`, Jest circus runner under `e2e/`, Android instrumentation runner + DetoxButler (`android/app/src/androidTest/...`), and scripts `npm run e2e:build:android`, `npm run e2e:test:android` (headless).
  - Core navigation E2E added (`e2e/appNavigation.e2e.ts`): Login  ->  Dashboard  ->  Site  ->  Device (telemetry + compressor card)  ->  Alerts list/detail  ->  Profile  ->  Logout. Test IDs added to root screens, tabs, and critical controls to keep selectors stable.
  - Large-list sanity: Dashboard and Alerts tests ensure FlatList virtualization props are present with 600-800 item fixtures; offline alerts cache path covered.
  - Device Detail supports 1h/24h/7d ranges with stale-data banners for cached/lagging telemetry.
  - Offline caching: Dashboard, Site, Device detail, and Alerts show cached read-only data with commands/ack/mute disabled when offline.
  - Profile push notification preferences now round-trip to the backend with React Query + AsyncStorage cache, keeping the OS-denied warning and push registration gating.
  - How to run E2E locally (requires Android SDK/emulator + backend dev server at http://10.0.2.2:4000): from `mobile/` run `npm run e2e:build:android` then `npm run e2e:test:android`.

- **Manual smoke (2025-12-05)**
  - Flow to exercise on emulator/dev client: Login (demo@greenbro.com/password) ? Dashboard ? Site ? Device (telemetry 1h/24h/7d) ? Alerts list/detail (ack/mute) ? Profile toggle (/user/preferences) ? Logout.
  - Caveats to expect: heat-pump history currently `configured:true`/`healthy:false` in dev (Azure idle/missing data), control channel unconfigured so commands show healthy:true/configured:false, push health-check disabled without Expo token.

- **Functional Integration Notes**
  - Profile toggle hits `/user/preferences`, caches in React Query + AsyncStorage, and is gated by `useRegisterPushToken`/OS permission.

- **CI**
  - Backend job: Node 20, Postgres 16 service, TEST_DATABASE_URL provided, ALLOW_TEST_DB_RESET=true set for API tests, `npm run migrate:test` before tests.
  - Mobile job: Node 20 with EXPO_PUBLIC_API_URL supplied for tests.

- **Outstanding risks**
  - No 2FA or full password-reset flow yet.
  - No metrics/alerting stack beyond health-plus and logs.

- **Staging 0.1.0 (blocked)**
  - Target host `https://staging-api.greenbro.co.za` does not currently resolve, so no staging backend is reachable to deploy to or to run migrations/seeds against (`Invoke-RestMethod` fails DNS lookup).
  - Database: no managed Postgres connection string available for `greenbro_staging`, so `npm run migrate:dev` and `node scripts/init-local-db.js` have not been run against staging.
  - Backend deployment: awaiting host/DNS + DATABASE_URL; intended envs per checklist (`NODE_ENV=production`, `PORT=4000`, `APP_VERSION=0.1.0`, CORS allowlist, JWT secret, ALERT_WORKER_ENABLED=true, optional HEATPUMP_* and CONTROL_*).
  - Mobile: staging EAS profile exists with `EXPO_PUBLIC_API_URL=https://staging-api.greenbro.co.za`; staging build not triggered because backend endpoint is unresolved.
  - Next steps once DNS/DB exist: provision Postgres (`greenbro_staging`), set envs on staging backend, deploy (`npm install && npm run build` / `npm run start`), run migrations + seed against staging DB, verify `/health-plus`, then generate staging mobile build and perform the smoke (login -> dashboard -> site -> device -> alerts -> profile -> logout) with screenshots.
  - Once infra exists, run: `npm run staging:bootstrap`, `HEALTH_BASE_URL=https://staging-api.greenbro.co.za npm run health:check`, then `eas build --profile staging`.
**Staging 0.1.0 manual smoke - 2025-12-07**
- Backend /health-plus: blocked (staging-api.greenbro.co.za does not resolve; need DNS + staged DATABASE_URL before `npm run health:check`).
- Login: blocked (no reachable staging backend; staging build not produced).
- Dashboard: blocked (API unreachable).
- Site -> Device: blocked (telemetry/control paths untestable without backend).
- Alerts: blocked (ack/mute flows pending backend).
- Profile: blocked (preferences toggle untested pending backend).
- Logout: blocked (navigation/logout smoke deferred until staging app exists).

