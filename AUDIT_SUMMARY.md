# Audit Summary

## What was checked
- Backend scripts/build (tsc, eslint, vitest), tsconfig strictness, env templates, and vitest coverage config.
- Mobile scripts (Expo dev client, Jest, Detox), tsconfig/lint/theme guardrails, env template, and E2E configs.
- CI workflow in `.github/workflows/ci.yml` plus root scripts; docs for envs/runbooks/checklists.
- Ran: `npm run typecheck` + `npm run lint` in `backend/` and `mobile/` (no tests executed locally).

## Fixes made
- Removed/typed all lingering `any` usages in backend controllers/repositories/services and elevated `@typescript-eslint/no-explicit-any` to `error`.
- Wired backend CI to enforce coverage via `npm run test:coverage` (Vitest thresholds already configured) and kept typecheck/lint/build steps intact.
- Made Detox E2E workflow self-contained: starts Postgres, installs backend deps, runs migrate + seed (`seed:e2e`), boots backend server, waits on `/health-plus`, then runs Metro + Detox (`.github/workflows/e2e-android.yml`).
- Added `seed:e2e` script (`backend/package.json`) and used `wait-on` for backend readiness.
- Introduced `createThemedStyles` helper and extended unused-style lint (warn) to representative component/screen (`StatusPill`, `DeviceGaugesSection`) via `mobile/.eslintrc.cjs`.
- Retained earlier env/doc improvements (`STAGING_DATABASE_URL`, `DEMO_USER_PASSWORD`, `ALERT_RULE_REFRESH_MINUTES`, `HEALTH_BASE_URL`) in templates and checklists.

## Not fixed / notes
- Detox workflow still depends on default dev env vars (e.g., heat-pump history credentials are not mocked); configure secrets or stub integrations if needed for air-gapped runs.
- Unused-style lint is only enabled (warn) for `StatusPill` and `DeviceGaugesSection`; helper exists but broader rollout is pending.

### TODOs
- [P1][Backend] Enable `noImplicitReturns` once early-return handlers are cleaned up.
  - Files: `backend/tsconfig.json`
  - Notes: start with controllers/services that return conditionally.

- [P2][Mobile] Roll out `createThemedStyles` + unused-style lint (warn/error) to additional components/screens.
  - Files: `mobile/.eslintrc.cjs`, `mobile/app/components/*`, `mobile/app/screens/*`
  - Notes: migrate createStyles usage gradually; silence false positives with targeted TODOs only when necessary.

- [P2][Full-stack] Harden Detox workflow secrets/mocks for offline runs (heat-pump history, signed URLs).
  - Files: `.github/workflows/e2e-android.yml`, `backend/.env.example`
  - Notes: set safe defaults or stub integrations so `/health-plus` stays green without external vendors.

- [P3][Docs] Document the Detox CI flow and backend requirements in the dev runbook.
  - Files: `docs/dev-run-notes.md`, `mobile/README.md`
  - Notes: call out Metro port (8081), emulator name, and seeded credentials.
