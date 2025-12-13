# State of the World (TL;DR)
- Versions: repo/back/mobile 0.8.0, web 0.1.0.
- Backend is green (lint/typecheck/coverage all pass at ~82% statements); web/mobile are yellow because specific unit tests fail despite clean lint/typecheck.
- CI is red: `npm run release:check` aborts on the first lint step even though `npm run lint` is green, and the web/mobile unit failures would block their CI jobs.
- E2E is yellow: Detox/Playwright configs exist but were not executed here; live vendor history was not proven with real keys.

# Green/Yellow/Red Status
- Backend: Green — `npm run lint`, `npm run typecheck`, and `cd backend && npm run test:coverage` all pass; coverage 82.17/71.94/84.98/82.17 (statements/branches/functions/lines).
- Web: Yellow — `npm run lint` + `npm run typecheck` pass after hook/typing fixes; `cd web && npm run test:coverage` fails `tests/diagnosticsPage.test.tsx` (demo flags element missing) and `tests/deviceDetailPage.test.tsx` (“Waiting for live data” copy missing).
- Mobile: Yellow — `cd mobile && npm run lint` and `npm run typecheck` pass; `cd mobile && npm test -- --runInBand --forceExit` fails `app/__tests__/DeviceDetailScreen.history.test.tsx` (expects “No history for this metric in the selected range.”).
- CI: Red — `npm run release:check` stops at “Lint (backend, web, mobile)” despite lint succeeding; `npm test` would fail because of the web/mobile unit regressions.
- E2E: Yellow — Playwright config `web/playwright.config.ts` and Detox workflow `.github/workflows/e2e-android.yml` exist but were not run; both depend on seeded envs and vendor flags.

# What’s Working
- Lint/typecheck baseline is clean across packages (`npm run lint`, `npm run typecheck`).
- Backend test+coverage suite is green (`cd backend && npm run test:coverage`), covering heat-pump history proxy, auth, file guards, share links, vendor guards, and migrations.
- Mobile and web unit suites mostly pass (13/14 vitest files, 49/50 Jest suites); failures are localized to history/demo-flag UIs.
- Local orchestration remains `npm run dev:all` / `npm run stop:all` (scripts/dev-all.ps1) for backend + Metro + emulator wiring.

# Known Risks & Gaps (Prioritized)
| Priority | Area | Issue | Impact | Evidence (file/command) | Suggested Fix | Owner role |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | Web | Vitest coverage failing: diagnostics demo flags card never renders and device history empty-state copy is absent | Web CI/deploy blocked; demo/vendor flag mismatch warning not visible; device history waiting state unverified | `cd web && npm run test:coverage` fails `tests/diagnosticsPage.test.tsx` (missing `data-testid="diagnostics-demo-flags"`) and `tests/deviceDetailPage.test.tsx` (missing “Waiting for live data”) | Align Diagnostics page to render demo flag block when `/demo/status` resolves and restore history “waiting” copy (or update fixtures to intended UX); rerun coverage | Web |
| P0 | Mobile | Jest history empty-state failure | Mobile CI + qaRelease gate fail; demo/CI history fallback may regress | `cd mobile && npm test -- --runInBand --forceExit` fails `app/__tests__/DeviceDetailScreen.history.test.tsx` (no “No history for this metric in the selected range.”) | Ensure empty history renders placeholder when vendor returns zero points (or adjust test expectations); rerun Jest without masking with `--forceExit` | Mobile |
| P1 | Release gate | `npm run release:check` exits at the initial lint step even though `npm run lint` is green (Windows spawn bug) | Release checklist/staging smoke never runs; CI “green” cannot be trusted | Investigate `scripts/release-check.js` on Windows (npm.cmd resolution/exit codes); rerun after unit tests are fixed | Devops |
| P2 | Vendor history proof | Live vendor history not exercised this audit; only unit coverage | Client demo mode claim unproven end-to-end | Run `node backend/scripts/check-vendor-history.js --hours 6 --deviceId <DEMO_DEVICE_ID> --token <Bearer>` with `HEATPUMP_HISTORY_URL/API_KEY`; confirm `/health-plus.heatPumpHistory.healthy=true` and charts show points in web/mobile | Backend/Mobile/Web |
| P2 | Hidden Jest leaks | Tests run with `--forceExit`, so open handles remain unknown | Potential flakiness in qaRelease/CI | After fixing failing suite, run `npm test -- --runInBand --detectOpenHandles` to surface timers/subscriptions and remove `--forceExit` | Mobile |
| P3 | Embed frame policy drift | `FRAME_ANCESTORS` only defaults to self+marketing in dev; prod/staging must set envs | Missing env weakens CSP/X-Frame headers for embed | Ensure `FRAME_ANCESTORS`/`NEXT_FRAME_ANCESTORS` set in deploy envs per `web/next.config.mjs`; verify response headers post-deploy | Web/Devops |

# Release Readiness
- Blocking tests: `cd web && npm run test:coverage` (2 failures) and `cd mobile && npm test -- --runInBand --forceExit` (1 failure). Backend coverage is already green.
- `npm run release:check` currently fails at the lint step inside the script; needs a fix before it can gate releases or run staging smoke (`scripts/release-check.js`).
- Client demo mode (live vendor history): require `HEATPUMP_HISTORY_DISABLED=false`, `HEATPUMP_HISTORY_URL/API_KEY` configured, and `/health-plus.heatPumpHistory.healthy=true`; prove with `backend/scripts/check-vendor-history.js` against the hero device and verify charts on web/mobile.
- CI demo mode (vendor disabled): set `HEATPUMP_HISTORY_DISABLED=true`, `CONTROL_API_DISABLED=true`, `MQTT_DISABLED=true`, `PUSH_NOTIFICATIONS_DISABLED=true`; `/health-plus.vendorFlags.disabled` should list all four (see `backend/src/config/vendorGuards.ts`), and Diagnostics should surface the disabled state.
- qaRelease “no Metro” demo path: `cd mobile && npm run android:qa` bundles JS (no Metro); currently blocked only by the failing Jest suite, not by Metro wiring (`docs/dev-run-notes.md`).

# E2E & Smoke Coverage
- Detox workflow `.github/workflows/e2e-android.yml` seeds via `backend/scripts/seed-demo.ts --reset`, disables vendor integrations for CI, waits on `/health-plus`, then runs `npm run e2e:test:android`; not executed in this audit.
- Playwright smoke `npm run web:e2e` uses `web/playwright.config.ts` (1 worker, retries=1, trace retain-on-failure) and requires `WEB_E2E_BASE_URL/EMAIL/PASSWORD`; not run here. `scripts/release-check.js` will skip smoke if envs are missing.
- Seeded demo flow stays available via `npm run demo:seed`; `/demo/status` and `/health-plus` include demo metadata consumed by Diagnostics and history charts.
- Emulator readiness tooling: `scripts/android-wait.js` and `logs/detox-preflight` capture emulator/app readiness; use before running Detox locally.

# Security Posture
- Auth hardening: login rate limiting/lockout (`backend/src/middleware/rateLimit.ts`), refresh rotation + revocation and logout-all (`backend/src/services/authService.ts`), password reset tokens (`backend/src/modules/auth/passwordResetService.ts`), role-based 2FA enforcement (`backend/src/modules/auth/twoFactorService.ts`), audit events for auth actions (`backend/src/modules/audit/auditService.ts`).
- Sessions on web: idle/absolute timeouts default 30m/8h (`web/config/session.ts`) enforced client-side via `web/lib/useSessionTimeout.ts`; return-to sanitization tested (`web/tests/returnToSanitizer.test.ts`).
- Files: only `file_status='clean'` streams (`backend/src/controllers/filesController.ts`); signed URLs require `FILE_SIGNING_SECRET` and embed org/user/action/expiry (default 60m, max bounded) (`backend/src/services/fileUrlSigner.ts`); AV knobs in `backend/.env.example` with status reported under `/health-plus.antivirus`.
- Audit logging: `audit_events` cover file uploads/downloads, share links, signed URLs, and auth/2FA events (`backend/src/modules/audit/auditService.ts`).
- CSP/embed: `web/next.config.mjs` emits CSP + `X-Frame-Options` with `frame-ancestors` driven by `NEXT_PUBLIC_EMBEDDED` + `FRAME_ANCESTORS`; ensure envs set for staging/prod.

# Operational Readiness
- Env matrix: `backend/.env.example` and `docs/envs.md` enumerate required secrets for local/staging/prod (DB URLs, JWT_SECRET, FILE_SIGNING_SECRET, Expo tokens, vendor URLs/keys, FRAME_ANCESTORS, APP_VERSION=0.8.0, disable flags).
- `/health-plus` (backend) surfaces db/storage health, vendor flags, mqtt/control/heatPumpHistory status, alerts worker heartbeat, push sample, antivirus target, perf hints, and demo metadata (`backend/src/services/healthService.ts`); Diagnostics in web/mobile depend on it.
- Vendor flags are centralized via `backend/src/config/vendorGuards.ts` and reused by `/demo/status`; ensure disable flags are false in prod/staging unless intentionally offline.
- Performance/indexes: migrations `backend/migrations/000012_hot_path_indexes.js` and `000011_file_security_and_audit.js` enforce hot-path indexes and file/audit tables; alerts/maintenance/work-order schemas live in earlier migrations.
- Standard local run: `npm run dev:all` / `npm run stop:all` orchestrate backend + Metro + emulator with port checks and adb reverse (see `docs/dev-run-notes.md`).

# Next 7 / 14 / 30 Days Plan
- Next 7 days: Fix web vitest failures (Diagnostics demo flags + device history empty state) and mobile history Jest failure; rerun `npm run test:coverage` (web) and `npm test -- --runInBand` (mobile) without `--forceExit`; repair `npm run release:check` on Windows.
- Next 14 days: Execute Playwright smoke and Detox workflows against a seeded env; capture artifacts from `scripts/android-wait.js` to validate emulator readiness; validate `/health-plus` with both vendor-enabled and vendor-disabled flags.
- Next 30 days: Prove live vendor history end-to-end with real keys (script + UI), enforce frame-ancestor envs in staging/prod, and remove the need for `--forceExit` by cleaning lingering handles after tests are green.
