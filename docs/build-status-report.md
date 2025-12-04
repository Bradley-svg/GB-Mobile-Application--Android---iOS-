# Build Status Report (Post-Maintenance)

Greenbro is a monorepo with a Node/Express backend API and an Expo-based mobile app for managing sites/devices, telemetry, alerts, and heat-pump history. This report reflects the state after the last five refactor/maintenance prompts (env standardisation, new services, worker hardening, mobile UX/resilience, npm audit). Overall state: builds mostly green; backend fully passing, mobile typecheck currently failing due to a test typing issue while lint/tests pass.

## Repo Structure Snapshot
- `backend/`: Express API with config/controllers/services/repositories/integrations/middleware/routes/workers/scripts/sql/test. Entry at `src/index.ts`; workers `src/workers/mqttIngest.ts`, `src/workers/alertsWorker.ts`.
- `mobile/`: Expo app with screens (Auth/Dashboard/Site/Device/Alerts/Profile), shared components, domain APIs (auth/sites/devices/alerts/control/heatPumpHistory), store/hooks/theme, and Jest tests.
- `archive/`: Legacy copies kept isolated; not part of active builds.
- `docs/`: Repo notes, screenshots, audit/build reports (this file).
- `logs/`: Git-ignored runtime logs.
- `.github/`: CI workflows (lint/test/build scripts as configured).
- `scripts/`: Helper scripts for local/dev tasks.

## Backend Status
- Structure confirmed: config/, controllers/, services/, repositories/, integrations/, middleware/, routes/, workers/, scripts/, sql/, test/; key entrypoints `src/index.ts`, `src/workers/mqttIngest.ts`, `src/workers/alertsWorker.ts`; integrations include MQTT, control (HTTP/MQTT), Expo push, Azure heatPumpHistory client.
- Commands (run from `backend/`):
  - `npm run typecheck` — ✅
  - `npm run lint` — ✅
  - `npm test` — ✅ (vitest suite; expected upstream error log mock remains)
  - `npm run build` — ✅
- npm audit (post-fix): 6 moderates (0 low/0 high/0 critical) remaining, all in dev tooling (vitest/vite/esbuild) requiring major upgrades; runtime `jsonwebtoken` updated to 9.0.3. Risk accepted for remaining dev-only issues (documented in repo-overview).

### Backend Health (/health-plus)
- Dev server not started in this report. Expected behaviour from `healthService`: `/health-plus` returns JSON with `ok` flag, `db` status, env/version, and sections for mqtt/control/alertsWorker/push. Healthy when DB query succeeds and configured integrations are not stale/error; mqtt/control marked unconfigured = healthy. Alerts worker health depends on recent heartbeat; push health depends on samples/EXPO_ACCESS_TOKEN.

## Mobile Status
- Layout confirmed: `app/screens` by feature (Auth, Dashboard, Site, Device, Alerts, Profile); shared UI in `app/components` (including new ErrorCard/EmptyState); domain APIs in `app/api` (auth/sites/devices/alerts/control/heatPumpHistory/types); store/hooks/theme; `app/__tests__`. DeviceDetail uses device.mac to drive heat pump history “Compressor current (A)” chart; error/empty components applied on Dashboard, SiteOverview, DeviceDetail, Alerts.
- Commands (run from `mobile/`):
  - `npm run typecheck` — ❌ `app/api/sites/hooks.test.ts`: TS2454 variable used before assignment (test typing guard missing).
  - `npm run lint` — ✅
  - `npm test -- --runInBand` — ✅ (Jest suites all passing)
- npm audit (post-fix): 3 low (expo/@expo/cli via `send` advisory); fix requires Expo 54 major upgrade. Accepted until planned Expo upgrade.

## Functional Integration Notes
- Backend exposes `/auth/*`, `/sites`, `/devices`, `/alerts`, `/heat-pump-history` plus MQTT/control workers.
- Mobile uses `EXPO_PUBLIC_API_URL` for API base; flow: Login → Dashboard (sites/alerts) → SiteOverview (devices) → DeviceDetail (telemetry, commands, heat-pump history chart) → Alerts → Profile → Logout.
- Heat pump history path: backend device.mac → POST `/heat-pump-history` (uses `HEATPUMP_*` envs with legacy fallback) → Azure client normalises series → `useHeatPumpHistory` hook → DeviceDetail “Compressor current (A)” chart. Local envs still required: `HEATPUMP_HISTORY_URL/API_KEY`, CORS allowlist, `EXPO_PUBLIC_API_URL`, MQTT/control credentials as applicable.

## Outstanding Risks & Technical Debt
- Backend: Workers improved but rely on in-process backoff; no structured log sink; rate limiting/CORS hardening still basic; password reset remains stub; Azure heat-pump schema assumptions (payload shape/time windows) remain implicit.
- Mobile: No offline mode; telemetry/alert visualisation basic; control-command confidence/UX limited; no e2e/device-level tests for navigation/commands/alerts under failure.
- Dependencies: Backend dev-tooling moderates (vitest/vite/esbuild) pending major upgrade; mobile low Expo advisories pending Expo 54 upgrade.
- Infrastructure: CI limited to repo workflows; no Docker/devcontainer; log shipping/observability pipeline absent.

## Next Steps
- Add e2e/device tests for core mobile flow (Login → Device detail → Commands/history → Alerts → Logout).
- Resolve mobile typecheck error in `app/api/sites/hooks.test.ts` and consider tightening TS on tests.
- Plan Vitest/Vite major upgrade to clear dev-tooling advisories; verify test suite stability afterward.
- Schedule Expo 54 upgrade to address remaining mobile audit findings.
- Add structured JSON logging and centralised sink for backend workers/APIs.
- Implement full password reset or remove UI/API stubs; review rate limit/CORS policies.
- Extend telemetry/history UI with better aggregation/zoom and clearer error handling for real-world data.
