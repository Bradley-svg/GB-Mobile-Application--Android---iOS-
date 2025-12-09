# Audit Summary

## What was checked
- Backend scripts/build (tsc, eslint, vitest), tsconfig strictness, env templates, and vitest coverage config.
- Mobile scripts (Expo dev client, Jest, Detox), tsconfig/lint/theme guardrails, env template, and E2E configs.
- CI workflow in `.github/workflows/ci.yml` plus root scripts; docs for envs/runbooks/checklists.
- Ran: `npm run typecheck` + `npm run lint` in `backend/` and `mobile/` (no tests executed locally).

## Fixes made
- Added missing backend env keys and docs: `STAGING_DATABASE_URL`, `DEMO_USER_PASSWORD`, `ALERT_RULE_REFRESH_MINUTES`, `HEALTH_BASE_URL` in `backend/.env.example`, `docs/envs.md`, and `docs/checklists/operational-readiness.md`.
- Added coverage reporting/thresholds plus a dedicated script (`npm run test:coverage`) in `backend/package.json` and `backend/vitest.config.ts`.
- Cleaned env reference to ASCII and clarified operational readiness expectations across backend/mobile.

## Not fixed / notes
- Backend ESLint still reports `no-explicit-any` warnings across controllers/repositories/services; left untouched to avoid large refactors.
- Coverage is not yet enforced in CI; new script/config is available but workflow unchanged.
- Detox remains manual; tests rely on seeded demo accounts (`demo@greenbro.com`, `contractor@greenbro.com`, password `password`) and emulator `Pixel_7_API_34`.

### TODOs
- [P1][Backend] Replace remaining `any` usages and then raise `@typescript-eslint/no-explicit-any` to error.
  - Files: `backend/src/config/db.ts`, `backend/src/controllers/authController.ts`, `backend/src/controllers/deviceController.ts`, `backend/src/repositories/*`, `backend/src/services/deviceControlService.ts`, `backend/src/services/pushService.ts`, `backend/src/services/shareLinksService.ts`
  - Notes: align with existing repository/service types; re-run `npm run lint`.

- [P1][Backend] Enforce coverage thresholds in CI via `npm run test:coverage`.
  - Files: `backend/vitest.config.ts`, `.github/workflows/ci.yml`
  - Notes: run after `npm run migrate:test`; adjust thresholds if baseline differs.

- [P2][Backend] Enable `noImplicitReturns` once early-return handlers are cleaned up.
  - Files: `backend/tsconfig.json`
  - Notes: start with controllers/services that return conditionally.

- [P2][Mobile] Add an unused-style guard compatible with `createStyles`/hooks (avoid false positives seen with `react-native/no-unused-styles`).
  - Files: `mobile/.eslintrc.cjs`, `mobile/app/components/*`, `mobile/app/screens/*`
  - Notes: consider static `StyleSheet.create` exports or a custom rule before enabling.

- [P3][Full-stack] Add an optional Detox CI job/schedule using `Pixel_7_API_34`.
  - Files: `.github/workflows/ci.yml`, `mobile/detox.config.js`, `docs/dev-run-notes.md`
  - Notes: start Metro on 8081/8082 with `EXPO_PUBLIC_API_URL` pointing to the test backend and seed data via `backend/scripts/init-local-db.js`.
