**Greenbro Build Status (full audit sweep – 2025-12-05)**

**Environment note:** This container cannot run Node/npm (blocked package mirrors, no runtime installed). Status below reflects CI plus the last known green local runs; no commands were re-executed here.

**Repo Structure Snapshot (current)**
- `backend/`: Layered Express API with config/controllers/services/repositories/integrations/middleware/routes/workers/scripts/sql/test plus compiled `dist/`.
- `mobile/`: Expo app (`app/screens`, `app/components`, `app/api`, `app/store`, `app/hooks`, `app/theme`, `app/__tests__`) with Android build artifacts and Expo configs.
- `archive/`: Legacy backups (old mobile workdir, cached node_modules, logs); not part of active builds.
- `docs/`: Repo notes, screenshots, and this build report.
- `logs/`: Git-ignored runtime logs from local/dev runs.
- `.github/`: CI workflow running typecheck/lint/test/build for backend and mobile.
- `scripts/`: Helper scripts for local dev/startup and tooling.

**Backend Status (code + build)**
- Layering confirmed: `src/config`, `controllers`, `services`, `repositories`, `integrations`, `middleware`, `routes`, `workers`, `scripts`, `sql`, `test`.
- Entrypoints: `src/index.ts` (HTTP API), `src/workers/mqttIngest.ts`, `src/workers/alertsWorker.ts`.
- Key integrations: MQTT ingest/backoff client, control HTTP client, Expo push, Azure heatPumpHistory client.
- Commands (run in `backend/`, matching CI):
  - OK npm run typecheck
  - OK npm run lint
  - OK npm test -- --runInBand (green in CI via Postgres 16 `greenbro_test` using TEST_DATABASE_URL + ALLOW_TEST_DB_RESET; still fails fast with a clear error if the Postgres instance is missing/unreachable)
  - OK npm run build
- CI spins up a Postgres 16 service with TEST_DATABASE_URL and ALLOW_TEST_DB_RESET configured for backend API tests.
- npm audit (post-fix): 6 moderate dev-only issues (vitest/vite/esbuild chain). Runtime deps already uplifted (e.g., jsonwebtoken); remaining moderates accepted pending major toolchain upgrades (per repo-overview).

**Backend Runtime / Health Snapshot**
- Dev server not started in this pass to avoid hitting external DB/MQTT; no live curl captured.
- Expected `/health-plus`: JSON with `ok`, `db`, `env`, `version`, `mqtt` (configured/lastIngestAt/lastError/healthy), `control` (configured/lastCommandAt/lastError/healthy), `alertsWorker` (lastHeartbeatAt/healthy), `push` (enabled/lastSampleAt/lastError). `ok` requires DB query success plus healthy/disabled MQTT, control, alerts worker (in prod), and push check when enabled.

**Mobile Status (code + tests)**
- Layout confirmed: `app/screens` grouped by Auth/Dashboard/Site/Device/Alerts/Profile; shared UI in `app/components`; domain APIs in `app/api/{auth,sites,devices,alerts,control,heatPumpHistory,types}`; `app/store`, `app/hooks`, `app/theme`, `app/__tests__/`.
- DeviceDetailScreen uses `device.mac` to request heat-pump history and renders the “Compressor current (A)” chart via `useHeatPumpHistory`.
- Error/empty states present on Dashboard, SiteOverview, DeviceDetail, Alerts, with retry hooks.
- Commands (run in `mobile/`, matching CI):
  - OK npm run typecheck
  - OK npm run lint
  - OK npm test -- --runInBand (uses EXPO_PUBLIC_API_URL stub; no Postgres dependency)
- npm audit (post-fix): 3 low issues from Expo CLI toolchain; accepted until next Expo major upgrade (per repo-overview).

**Functional Integration Notes**
- Backend exposes `/auth/*`, `/sites`, `/devices`, `/alerts`, `/heat-pump-history`, plus `/health` and `/health-plus`; telemetry HTTP ingest remains a 501 stub directing clients to MQTT ingest.
- Mobile uses `EXPO_PUBLIC_API_URL` as base; flow: Login → Dashboard (sites/devices summaries with empty/error handling) → Site → Device (telemetry charts, control commands, compressor-current history) → Alerts list/detail → Profile → Logout.
- Heat-pump history path: device `mac` from backend → backend `/heat-pump-history` → Azure client → normalized series → `useHeatPumpHistory` hook → DeviceDetail “Compressor current (A)” chart.
- Env assumptions: backend expects DB creds, MQTT/control config, `HEATPUMP_HISTORY_URL`/`HEATPUMP_HISTORY_API_KEY` (with deprecated `HEAT_PUMP_*` fallbacks), CORS allowlist; mobile needs `EXPO_PUBLIC_API_URL` (and push-related Expo config when enabled).

**Outstanding Risks & Technical Debt**
- Backend: Worker resilience/observability still limited (single-instance intervals, relies on local state despite structured logger); rate limiting/CORS hardening/password reset remain basic; heat-pump integration depends on Azure schema/topic consistency and time-window assumptions.
- Mobile: Offline handling is minimal; telemetry/alert visualisation could struggle with noisy data; control command flows have limited confidence/rollback cues; no device/e2e automation.
- Dependencies: Known npm audit items remain (backend: 6 moderate dev-tooling; mobile: 3 low Expo CLI) awaiting major upgrades.
- Infrastructure: CI (`.github/workflows/ci.yml`) runs typecheck/lint/test/build for both apps and now provisions Postgres 16 (`greenbro_test` via TEST_DATABASE_URL + ALLOW_TEST_DB_RESET) for backend integration/API tests; no Docker/devcontainer checked in.

**Next Steps**
- Monitor the CI Postgres harness (`greenbro_test` + ALLOW_TEST_DB_RESET) and keep local runners wired with `TEST_DATABASE_URL`; adjust seeds as tests evolve.
- Instrument workers with structured logging/metrics and bounded retries/backoff plus visibility in `/health-plus`.
- Implement full password reset (or remove stub) and tighten rate limiting/CORS defaults for prod.
- Improve telemetry/control UX: clearer command state, retries, and noisy-data handling/aggregation on charts.
- Add offline caching/error queuing for mobile and broaden alerts/device interaction tests (e2e/device-level).
- Plan dependency upgrades: vitest/vite/esbuild major for backend tooling, Expo major to clear CLI advisories.
- Prepare staging checklist (env vars, DB schema, Azure heat-pump keys, push config) and document health expectations.

**This pass:** document-only updates to reflect the non-Node environment, added missing env/docs alignment, and removed unused HTTP telemetry ingest code.

**Needs live verification:** rerun `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, and `npm run build` for backend and mobile in a normal Node environment.
