# Audit Summary

## What was checked
- Backend scripts/build (tsc, eslint, vitest), tsconfig strictness, env templates, and vitest coverage config.
- Mobile scripts (Expo dev client, Jest, Detox), tsconfig/lint/theme guardrails, env template, and E2E configs.
- CI workflow in `.github/workflows/ci.yml` plus root scripts; docs for envs/runbooks/checklists.
- Ran: `npm run typecheck` + `npm run lint` in `backend/` and `mobile/` (no tests executed locally).

## Fixes made
- Removed/typed all lingering `any` usages in backend controllers/repositories/services and elevated `@typescript-eslint/no-explicit-any` to `error`.
- Wired backend CI to enforce coverage via `npm run test:coverage` (Vitest thresholds already configured) and kept typecheck/lint/build steps intact.
- Hardened file delivery: signed URLs now embed file/org/user/action metadata, enforce expiry/org scope, and default to `FILE_SIGNED_URL_TTL_MINUTES`; `/files` only serves AV-clean files.
- Clarified AV/quarantine semantics with a `file_status` column (`clean`/`infected`/`scan_failed`) and 503s on scan failures; non-clean files never stream.
- Added persistent `audit_events` for file uploads (success/failure), signed URL issuance/download, and share link create/revoke, plus env/docs/test coverage.
- Made Detox E2E workflow self-contained: starts Postgres, installs backend deps, runs migrate + seed (`seed:e2e`), boots backend server, waits on `/health-plus`, then runs Metro + Detox (`.github/workflows/e2e-android.yml`).
- Added `seed:e2e` script (`backend/package.json`) and used `wait-on` for backend readiness; vendor heat-pump history is disabled in CI via `HEATPUMP_HISTORY_DISABLED=true`.
- Added vendor-disable flags/guards for control/MQTT/push (CI only) plus prod-like warnings via `checkVendorDisableFlags`; documented flags in env templates/checklists/dev notes.
- Promoted `react-native/no-unused-styles` to `error` across app/components/screens/theme and set backend/mobile lint scripts to `--max-warnings=0` to keep the baseline warning-free.
- Lint baseline is now warning-free for backend and mobile (except known React act warnings in theme tests).
- Theming rollout completed across all screens; unused styles cleaned; navigation/data/error guards applied with fallback tests (DocumentsScreen, ShareLinksScreen, WorkOrderDetailScreen, SiteOverviewScreen) and unified error surfaces with ErrorCard light/dark coverage.
- Added light/dark theming snapshot test coverage for core components (`app/__tests__/ThemedComponentsAppearance.test.tsx`).
- Added pre-release run notes/checklists covering lint/type/test gates, CI-only vendor-disable flags, and the UI regression safety net (theming snapshots + ErrorCard tests).
- Retained earlier env/doc improvements (`STAGING_DATABASE_URL`, `DEMO_USER_PASSWORD`, `ALERT_RULE_REFRESH_MINUTES`, `HEALTH_BASE_URL`) in templates and checklists.

## Dev tooling / hygiene
- Added dev:all and stop:all orchestration scripts for backend + mobile + emulator; dev:all now logs clear steps and handles missing seed/adb/DB more gracefully.

## Not fixed / notes
- Detox workflow still depends on default dev env vars for other integrations; flags exist to disable control/MQTT/push/history in CI, but fully offline prod-like runs should supply real secrets.
- React Native act warnings still surface from ThemeProvider during theme snapshot runs; known noise accepted in the current baseline.

### TODOs
- [P1][Backend] Enable `noImplicitReturns` once early-return handlers are cleaned up.
  - Files: `backend/tsconfig.json`
  - Notes: start with controllers/services that return conditionally.

- [P2][Mobile] Quieten ThemeProvider act warnings in tests without masking regressions (wrap hydration in `act` or add test-friendly hook).

- [P2][Full-stack] Harden Detox workflow secrets/mocks for offline runs (heat-pump history/control/MQTT/push flags exist; signed URLs/other vendors still to be stubbed if required).
  - Files: `.github/workflows/e2e-android.yml`, `backend/.env.example`
  - Notes: set safe defaults or stub integrations so `/health-plus` stays green without external vendors.

- [P3][Docs] Keep the Detox/Expo dev notes synced with any port/profile changes (Metro vs dev client) and seeded credentials.

## Hygiene status
- Theming rollout is complete.
- Unused styles are enforced as errors.
- Core guards (nav/data/error-surface) have tests.
- Vendor-disable flags are guarded and documented.
