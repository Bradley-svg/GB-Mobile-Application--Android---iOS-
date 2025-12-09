# Audit Summary

## What was checked
- Backend scripts, TypeScript config, linting, tests, and env templates.
- Mobile scripts (Expo, Jest, Detox), theming guardrails, and env template.
- CI coverage for backend/mobile workflows.
- Cross-repo docs and runbooks.

## Fixes made
- Tightened backend TypeScript hygiene with unused-variable and switch fallthrough checks, leaving a note for stricter returns later.
- Nudged backend lint rules to discourage `any`/loose equality while keeping existing allowances.
- Added repo-level npm scripts to orchestrate lint/typecheck/test across backend and mobile.
- Synced Detox port reversal with the dev-client port and documented signed file URL feature flag in the mobile env template.
- Added an operational readiness checklist and linked it from the README for quicker staging/prod preflight.

## TODOs
- [P1][Backend] Add Vitest coverage thresholds and enforce in CI to prevent regression creep.
  - Files: backend/vitest.config.ts, .github/workflows/ci.yml
  - Notes: set reasonable statements/branches targets (e.g., 75–80%) based on current suite.

- [P2][Mobile] Add lint guard for unused StyleSheet entries to catch dead styling early.
  - Files: mobile/.eslintrc.cjs
  - Notes: use eslint-plugin-react-native `no-unused-styles` or similar; align with existing theme guardrails.

- [P3][Full-stack] Add a scheduled Detox E2E workflow (or gated manual job) to cover navigation/theme/regression flows.
  - Files: .github/workflows/ci.yml, mobile/detox.config.js
  - Notes: reuse the Pixel_7_API_34 config; ensure Metro port 8081/8082 is reversed before running tests.
