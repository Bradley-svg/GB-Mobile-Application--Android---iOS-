# Full Audit & Cleanup - 0.1.0 (2025-12-07)

## Backend
- Removed legacy schema snapshots under `backend/sql/*.sql`; migrations remain the single source of truth.
- Deleted tracked runtime log stubs (`backend/$logA`, `backend/$logB`) and ignored future `$log*` noise.
- Added `CONTROL_COMMAND_THROTTLE_MS` to `.env.example`/env reference and refreshed README/testing notes.
- Sweep found no unused controllers/services/routes; kept heat-pump history, control, auth/refresh/logout-all intact.

## Mobile
- Fixed the unused `mapHistoryError` parameter in `app/screens/Device/DeviceDetailScreen.tsx` (lint-only; no runtime change).
- Screens/components/hooks reviewed; all remain referenced via `RootNavigator` and tests (no dead screens/components to remove).

## Cross-cutting / tooling
- `.gitignore` now blocks Detox `artifacts/` and backend `$log*` artifacts.
- Docs refreshed (`repo-overview.md`, `envs.md`, `build-status-report.md`, `build-progress-report-0.1.0.md`, `dev-run-notes.md`) to reflect schema cleanup, throttle env, and current run status.

## Verification
- Backend (Node 20 / Postgres 16): `npm run typecheck`; `npm run lint`; `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test`; `npm run build` — all green.
- Mobile: `npm run typecheck`; `npm run lint`; `npm test -- --runInBand` — all green (only expected console/act warnings).
- CI workflow unchanged (`.github/workflows/ci.yml` still runs typecheck/lint/test/build for backend and typecheck/lint/test for mobile).

## Issues fixed
- Removed the unused `mapHistoryError` argument that tripped ESLint in Device Detail history handling.
- Cleared stale schema reference files and tracked runtime logs to reduce noise.
- Documented control command throttle env to avoid hidden config assumptions.

## Remaining risks / TODOs
- Password reset/2FA/trusted-device flows still absent; staging infra (DNS/DB) still missing; metrics/alerting pipeline still unwired.
- Heat-pump history upstream health not re-run this sweep (last sample 2025-12-05 showed upstream idle); recheck once configured.
- Detox E2E not rerun this pass; coverage remains the navigation smoke only.

## Commands run
- Backend: `npm run typecheck`; `npm run lint`; `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test`; `npm run build`.
- Mobile: `npm run typecheck`; `npm run lint`; `npm test -- --runInBand`.
