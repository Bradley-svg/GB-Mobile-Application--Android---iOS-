# Audit Summary

## What was checked
- Backend scripts/build (tsc, eslint, vitest), tsconfig strictness, env templates, and vitest coverage config.
- Mobile scripts (Expo dev client, Jest, Detox), tsconfig/lint/theme guardrails, env template, and E2E configs.
- CI workflow in `.github/workflows/ci.yml` plus root scripts; docs for envs/runbooks/checklists.
- Ran: `npm run typecheck` + `npm run lint` in `backend/` and `mobile/` (no tests executed locally).

## Fixes made
- Removed/typed all lingering `any` usages in backend controllers/repositories/services and elevated `@typescript-eslint/no-explicit-any` to `error`.
- Wired backend CI to enforce coverage via `npm run test:coverage` (Vitest thresholds already configured) and kept typecheck/lint/build steps intact.
- Added optional Detox workflow `.github/workflows/e2e-android.yml` (manual + nightly cron) targeting `Pixel_7_API_34` with Metro on 8081.
- Scoped a low-noise unused-style guard to static theme files in `mobile/.eslintrc.cjs` to avoid false positives with dynamic `createStyles`.
- Retained earlier env/doc improvements (`STAGING_DATABASE_URL`, `DEMO_USER_PASSWORD`, `ALERT_RULE_REFRESH_MINUTES`, `HEALTH_BASE_URL`) in templates and checklists.

## Not fixed / notes
- The Detox workflow still assumes a reachable backend with seeded data; currently documented as a TODO in the workflow script.
- Unused-style lint is limited to theme files; component-level coverage still needs a createStyles-friendly rule.

### TODOs
- [P1][Backend] Enable `noImplicitReturns` once early-return handlers are cleaned up.
  - Files: `backend/tsconfig.json`
  - Notes: start with controllers/services that return conditionally.

- [P2][Mobile] Extend unused-style lint beyond theme files in a way that supports `createStyles(theme)` without false positives.
  - Files: `mobile/.eslintrc.cjs`, `mobile/app/components/*`, `mobile/app/screens/*`
  - Notes: consider a helper/wrapper that names the StyleSheet consistently or a custom rule.

- [P2][Full-stack] Wire backend bring-up/seed into the Detox workflow so E2E runs are self-contained.
  - Files: `.github/workflows/e2e-android.yml`, `backend/scripts/init-local-db.js`
  - Notes: start Postgres service, apply migrations/seed, and set `EXPO_PUBLIC_API_URL` accordingly.

- [P3][Docs] Document the Detox CI flow and backend requirements in the dev runbook.
  - Files: `docs/dev-run-notes.md`, `mobile/README.md`
  - Notes: call out Metro port (8081), emulator name, and seeded credentials.
