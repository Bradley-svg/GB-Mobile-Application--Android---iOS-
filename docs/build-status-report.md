**Greenbro Build Status (local sweep 2025-12-05)**

- **Backend**
  - npm install, npm run migrate:test (tests/CI), npm run typecheck, npm run lint, TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test, npm run build; all green locally on Node 20 / Postgres 16 (vitest forced single-thread/file-serial to avoid DB contention).
  - Migrations: node-pg-migrate baseline under `backend/migrations/` (includes `worker_locks`); `npm run migrate:dev` / `npm run migrate:test` wire to DATABASE_URL/TEST_DATABASE_URL; test harness runs migrations before seeding.
  - Preferences: `/user/preferences` GET/PUT backed by `user_preferences` (`alerts_enabled` default true) with API coverage for auth/validation/default/update paths.
  - Logging: pino JSON logger to stdout with `LOG_LEVEL` (default info) and service/env fields; console.* replaced across API/workers/scripts.
  - Workers: MQTT ingest + alerts worker take DB locks (`worker_locks`) with configurable TTL (`WORKER_LOCK_TTL_SEC`); non-owners log and exit/idle rather than double-run.
  - Auth: login/refresh/me plus logout and logout-all are live; password reset endpoint remains intentionally absent.
  - Control: throttling enforced from the last command in DB; `/devices/:id/last-command` surfaces the latest control attempt; supports MQTT or HTTP control channel via env. Health-plus currently shows `configured:false` with lastError `CONTROL_CHANNEL_UNCONFIGURED` (dev run without control config).
  - Telemetry: HTTP ingest route stays a 501 stub; telemetry read path enforces maxPoints with downsampling and metric bounds.
  - Heat-pump history: Azure client with retry/circuit breaker; health-plus includes `heatPumpHistory` block (current dev curl: `configured:true`, `healthy:false`, `lastSuccessAt:null` while upstream is idle).
  - Health-plus sample (`curl http://localhost:4000/health-plus`): `{ ok:false, env:"development", db:"ok", version:"0.1.0-dev", mqtt:{configured:false, lastIngestAt:null, lastErrorAt:"2025-12-05T12:49:30.201Z", lastError:"", healthy:true}, control:{configured:false, lastCommandAt:null, lastErrorAt:null, lastError:"CONTROL_CHANNEL_UNCONFIGURED", healthy:true}, heatPumpHistory:{configured:true, lastSuccessAt:null, lastErrorAt:null, lastError:null, healthy:false}, alertsWorker:{lastHeartbeatAt:null, healthy:true}, push:{enabled:false, lastSampleAt:"2025-12-05T19:10:05.948Z", lastError:null} }`.

- **Mobile**
  - npm run typecheck, npm run lint, npm test -- --runInBand all green locally after wiring preferences to `/user/preferences`.
  - Device Detail supports 1h/24h/7d ranges with stale-data banners for cached/lagging telemetry.
  - Offline caching: Dashboard, Site, Device detail, and Alerts show cached read-only data with commands/ack/mute disabled when offline.
  - Added AppNavigation and Dashboard large-list regression tests alongside history/push suites.
  - Profile push notification preferences now round-trip to the backend with React Query + AsyncStorage cache, keeping the OS-denied warning and push registration gating.

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
  - Next steps once DNS/DB exist: provision Postgres (`greenbro_staging`), set envs on staging backend, deploy (`npm install && npm run build` / `npm run start`), run migrations + seed against staging DB, verify `/health-plus`, then generate staging mobile build and perform the smoke (login→dashboard→site→device→alerts→profile→logout) with screenshots.
  - Once infra exists, run: `npm run staging:bootstrap`, `HEALTH_BASE_URL=https://staging-api.greenbro.co.za npm run health:check`, then `eas build --profile staging`.
