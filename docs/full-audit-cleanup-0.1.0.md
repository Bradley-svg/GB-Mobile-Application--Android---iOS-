# Full Audit & Cleanup - 0.1.0 (2025-12-07)

## Backend
- Inlined `src/domain/*` types into repositories/services and moved the org resolver into `src/controllers/organisation.ts`, removing `src/utils/organisation.ts` so `src/` only contains config/controllers/services/repositories/integrations/middleware/routes/workers/scripts/index.ts.
- Kept migrations as the single schema source by removing the empty `backend/sql/` snapshot folder; CONTROL_COMMAND_THROTTLE_MS remains documented in env templates/docs.
- Purged stray runtime logs from the repo root to keep tracked files limited to source/docs.

## Mobile
- Deleted emulator screenshots and Metro/logcat/bundle tmp artifacts from the mobile root; only the canonical branding assets remain under `assets/greenbro/`.
- Screens/components/hooks remain live via `RootNavigator` and tests (Auth/Login+Signup+ForgotPassword; Dashboard/Alerts/Profile tabs; Site/Device/Alert detail).

## Cross-cutting / tooling
- `.gitignore` tightened (added `build/`, `*.dmp`, removed blanket ignores for `mobile/*.png|*.jpg`).
- Docs refreshed (`repo-overview.md`, `build-status-report.md`, `build-progress-report-0.1.0.md`, `dev-run-notes.md`) to reflect the cleanup; CI workflow unchanged and still matches current scripts.

## Verification
- Backend (Node 20 / Postgres 16): `npm run typecheck`; `npm run lint`; `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test`; `npm run build` (all green).
- Mobile: `npm run typecheck`; `npm run lint`; `npm test -- --runInBand` (all green with expected console/act warnings only).

## Issues fixed
- Removed unused backend domain/util exports and ensured controllers use the new organisation resolver.
- Cleared stray tracked assets/logs outside `docs/`/`logs/` and kept branding canonical.

## Remaining risks / TODOs
- Password reset/2FA/trusted-device flows still absent; staging DNS/DB still missing; metrics/alerting pipeline still unwired.
- Heat-pump history upstream health not rerun this sweep (last sample 2025-12-05); recheck once configured.
- Detox E2E not rerun this pass; coverage remains the navigation smoke only.

## Commands run
- Backend: `npm run typecheck`; `npm run lint`; `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test`; `npm run build`.
- Mobile: `npm run typecheck`; `npm run lint`; `npm test -- --runInBand`.
