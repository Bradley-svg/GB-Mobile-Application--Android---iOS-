# Full audit notes (initial snapshot)

## Backend
- CI commands (from docs/workflow): `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run build` (with Postgres 16 service, `TEST_DATABASE_URL`, `ALLOW_TEST_DB_RESET`).
- Docs report prior local runs as green for typecheck/lint/test/build; npm audit previously left 6 moderate dev-only issues (vite/vitest/esbuild).
- Test harness requires `TEST_DATABASE_URL`; resets allowed when DB name includes `test` or `ALLOW_TEST_DB_RESET=true`.
- Local verification on this sweep was blocked because `node`/`npm` are not available (proxy errors during `apt-get update`).

## Mobile
- CI commands: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand` (with `EXPO_PUBLIC_API_URL` for tests).
- Docs report prior local runs green for typecheck/lint/tests; npm audit previously flagged 3 low Expo CLI items.
- Local verification on this sweep was blocked because `node`/`npm` are not available (proxy errors during `apt-get update`).

## Noted TODOs / risks
- Backend: layering exceptions in `healthController`/`heatPumpHistoryController`; worker resilience/backoff and structured logging lacking; legacy `HEAT_PUMP_*` envs deprecated in favor of `HEATPUMP_*`; password reset stub; telemetry HTTP ingest intentionally disabled.
- Mobile: limited offline/error handling and control-command feedback; push token registration does not re-run on permission changes.
- Dependencies: remaining npm audit items deferred pending toolchain upgrades (backend dev dependencies, Expo CLI).
