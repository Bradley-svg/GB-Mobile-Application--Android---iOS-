# State of the World (TL;DR)
- Backend is healthy (lint/typecheck/coverage green at 82% statements) but frontends are blocking the build.
- Web is red: lint/typecheck fail in `web/app/**` and `web/lib/**`; vitest coverage fails in `tests/diagnosticsPage.test.tsx` and `tests/deviceDetailPage.test.tsx`.
- Mobile is yellow: lint/typecheck green, but Jest fails `app/__tests__/DeviceDetailScreen.history.test.tsx` (history empty-state copy missing); qaRelease workflow would fail on tests.
- CI is red: `.github/workflows/ci.yml` web + mobile jobs would stop on the above test failures; release:check not run because base steps are red.
- E2E is unverified: Detox/Playwright workflows exist but were not run; vendor history path still depends on real keys for a live proof.

# Green/Yellow/Red Status
- Backend: Green — `npm run lint` (backend) + `npm run typecheck` (backend) + `npm run test:coverage` (backend) all pass; coverage 82.17/71.94/84.98/82.17 (statements/branches/functions/lines) from `cd backend; npm run test:coverage`.
- Mobile: Yellow — lint (`cd mobile; npm run lint`) and typecheck (`cd mobile; npm run typecheck`) pass; Jest fails `DeviceDetailScreen.history.test.tsx` in `cd mobile; npm test -- --runInBand --forceExit`.
- Web: Red — `npm run lint` and `npm run typecheck` fail with hook purity/type errors in `web/app/(app)/**`, `web/app/(auth)/login/login.test.tsx`, `web/lib/useSessionTimeout.ts`, `web/lib/useEmbed.ts`, etc.; coverage run `cd web; npm run test:coverage` fails 2 tests.
- CI: Red — `.github/workflows/ci.yml` would fail the web job (`npm run web:test`/`web:test:coverage`) and mobile job (`npm test -- --runInBand`) with current regressions.
- E2E: Yellow — Detox workflow `.github/workflows/e2e-android.yml` and Playwright config `web/playwright.config.ts` are present; not executed in this audit and depend on seeded envs/vendor flags.

# What’s Working
- Backend: `cd backend; npm run test:coverage` green with 82% statements/72% branches; migrations + heat pump history + control/push/file/audit suites all passed (vitest output).
- Mobile lint/typecheck: `cd mobile; npm run lint` and `cd mobile; npm run typecheck` green.
- Root tooling: backend lint/typecheck passed inside `npm run lint` / `npm run typecheck` before web failures.
- Orchestration: `npm run dev:all` / `npm run stop:all` remain the standard local path (scripts/dev-all.ps1) including Postgres bootstrap, Metro start, adb reverse, and emulator wiring.

# Known Risks & Gaps (Prioritized)
| Priority | Area | Issue | Impact | Evidence (file/command) | Suggested Fix | Owner role |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | Web | Lint/typecheck failing: impure `Date.now()` usage, setState-in-effect, missing types, unused vars | Blocks CI/web deploy; risk of render churn/runtime instability | `npm run lint` errors in `web/app/app/alerts/[alertId]/page.tsx`, `web/app/app/alerts/page.tsx`, `web/app/app/devices/[deviceId]/page.tsx`, `web/app/app/sharing/page.tsx`, `web/app/app/work-orders/[workOrderId]/page.tsx`, `web/lib/useEmbed.ts`, `web/lib/useSessionTimeout.ts`; `npm run typecheck` errors for `qrcode`, `httpClient` headers, `authStore` storage, etc. | Wrap time reads in `useMemo`/`useRef`, remove synchronous setState in effects, add `@types/qrcode` or module shim, tighten types on Axios headers/storage; rerun lint/typecheck. | Web |
| P0 | Web | Vitest coverage failing (demo flags + device history) | CI web job fails; demo/vendor flag UI correctness unknown | `cd web; npm run test:coverage` fails `tests/diagnosticsPage.test.tsx` (no `[data-testid="diagnostics-demo-flags"]`) and `tests/deviceDetailPage.test.tsx` (missing “Waiting for live data” copy) | Restore diagnostics flag rendering and history empty-state copy or update fixtures to match intended UX; rerun coverage. | Web |
| P0 | Mobile | Jest failure on history empty state | Mobile CI + qaRelease workflow (`.github/workflows/mobile-qa-build.yml`) fail; history UX may regress | `cd mobile; npm test -- --runInBand --forceExit` fails `app/__tests__/DeviceDetailScreen.history.test.tsx` (no “No history for this metric in the selected range.” copy) | Ensure DeviceDetailScreen renders empty-state text for zero-point history (or adjust fixtures); rerun Jest (ideally without `--forceExit`). | Mobile |
| P1 | Web | Root `npm test` unstable (EPIPE during `npm test` before coverage run) | Dev ergonomics + CI flakiness risk when piping vitest output | `npm test` crashed with `Error: EPIPE: broken pipe, write` from vitest console logging (web) | Re-run after fixing web tests; if reproducible, cap console output or adjust reporter to avoid broken pipe on Windows shells. | Web |
| P1 | Release orchestration | `npm run release:check` not run because lint/type/test already red | Release gate cannot be trusted; staging smoke auto-skip unknown | Fix P0s, then run `npm run release:check` (or `release:check:fast`) to validate orchestration and staging smoke skips. | Devops |
| P2 | Vendor history proof | Live vendor history not exercised in this audit; relies on real keys | Demo/client “live history” claims unproven end-to-end | Use `backend/scripts/check-vendor-history.js --hours 6 --field metric_compCurrentA --deviceId <id> --token <Bearer>` with `HEATPUMP_HISTORY_URL/API_KEY` set; verify `/health-plus` heatPumpHistory healthy and charts in mobile/web show non-zero points. | Backend/Mobile/Web |
| P2 | Mobile test hygiene | `--forceExit` masks potential open handles | Harder to detect hanging timers/subscriptions | Run Jest without `--forceExit` + `--detectOpenHandles` after fixing failing test to surface lingering handles; clean up timers/subscribers. | Mobile |
| P3 | Embed/CSP config drift | `FRAME_ANCESTORS` must be set for embeds; defaults only in dev | Missing envs could weaken frame policy in staging/prod | Ensure `FRAME_ANCESTORS` (or `NEXT_FRAME_ANCESTORS`) set in envs used by `web/next.config.mjs`; verify with deployed response headers. | Web/Devops |

# Release Readiness
- Blocking items: web lint/typecheck/test failures; mobile Jest failure; release:check not executed. CI deploy (`web-deploy` workflow) would stop on web tests; `mobile-qa-build` would fail on current Jest.
- Client demo mode (live vendor history): requires `HEATPUMP_HISTORY_DISABLED=false`, `HEATPUMP_HISTORY_URL/API_KEY` set, and `/health-plus` `heatPumpHistory.healthy=true`. Proof path: run `node backend/scripts/check-vendor-history.js --deviceId <DEMO_DEVICE_ID> --token <Bearer>` then load mobile/web history chart (6h window) against the same device.
- CI demo mode (vendor disabled): set `HEATPUMP_HISTORY_DISABLED=true`, `CONTROL_API_DISABLED=true`, `MQTT_DISABLED=true`, `PUSH_NOTIFICATIONS_DISABLED=true`; `/health-plus` shows `disabled` flags (see `backend/src/config/vendorGuards.ts`).
- QA/mobile “no Metro” demo: qaRelease is produced via `expo run:android --variant qaRelease` / `.github/workflows/mobile-qa-build.yml` (gradle `assembleQaRelease`, bundles JS). Current blocker is the failing Jest suite, not Metro.

# E2E & Smoke Coverage
- Detox: workflow `.github/workflows/e2e-android.yml` boots Postgres, migrates + `seed:e2e`, starts backend, runs Metro on 8081, waits via `scripts/android-wait.js`, then `npm run e2e:test:android -- --headless --reuse`. Not run in this audit; vendor history/control/MQTT/push disabled via flags.
- Playwright (web): config `web/playwright.config.ts` (workers=1, retries=1, trace retain-on-failure); smoke suite `npm run web:e2e` covers smoke + embed when `WEB_E2E_*` envs are set. Not run here; staging smoke in `scripts/release-check.js` would auto-skip without envs.
- Seeded demo flow: backend `npm run demo:seed` available; /demo/status and /health-plus expose demo metadata for clients.
- Emulator readiness: `scripts/android-wait.js` probes emulator/app readiness; `logs/detox-preflight` captures hangs if Detox fails.

# Security Posture
- Auth hardening: login rate limiting + lockout (`backend/src/middleware/rateLimit.ts`), hashed refresh sessions with rotation and revocation (`backend/src/services/authService.ts` + `authSessionsRepository.ts`), password reset tokens revoke sessions on use, optional 2FA enforced by roles (`backend/src/modules/auth/twoFactorService.ts`, env `AUTH_2FA_ENABLED/AUTH_2FA_ENFORCE_ROLES`), audit events for 2FA enable/disable.
- File security: only `file_status='clean'` streams (`backend/src/controllers/filesController.ts`); signed URLs require `FILE_SIGNING_SECRET`, default TTL 60 minutes capped at 24h and org-scoped (`backend/src/services/fileUrlSigner.ts`); audit events for signed URL creation/download (`modules/audit/auditService.ts`).
- AV: optional scanner via command or clamd with status in `/health-plus.antivirus` (`backend/src/services/virusScanner.ts`); `AV_SCANNER_ENABLED` false in dev, true expected in staging/prod.
- Audit logging: `audit_events` capture file uploads, signed URLs, share link lifecycle, 2FA events (`backend/src/modules/audit/auditService.ts`).
- CSP/embed: `web/next.config.mjs` sets CSP + `X-Frame-Options`; frame ancestors default to self + marketing hosts and require `NEXT_PUBLIC_EMBEDDED=true` + `FRAME_ANCESTORS` for embeds.
- Refresh/session revocation: refresh tokens stored hashed; rotation revokes prior token (`issueTokens`/`verifyRefreshToken`), logout revokes session (`revokeAuthSession`).
- Return-to/open redirect guard: tests `web/tests/returnToSanitizer.test.ts` ensure return targets sanitized.

# Operational Readiness
- Env matrix: templates in `backend/.env.example` and `docs/envs.md` cover local/staging/prod (JWT secret, DB URLs, vendor flags, push, FILE_SIGNING_SECRET, FRAME_ANCESTORS, APP_VERSION=0.8.0).
- `/health-plus` expectations (backend): reports db/storage, vendor flags, mqtt/control/heatPumpHistory configured/disabled/healthy, alerts worker heartbeat, push sample, antivirus, perf hints, and demo metadata (`backend/src/services/healthService.ts`).
- Vendor flags behavior: `getVendorFlagSummary` feeds both `/health-plus` and `/demo/status` (`backend/src/config/vendorGuards.ts`, `backend/src/controllers/demoController.ts`); mobile/web consume `/demo/status` for banner logic.
- Performance/index guards: migration `backend/migrations/000012_hot_path_indexes.js` adds hot-path indexes for work orders, alerts, telemetry.
- Local run path: `npm run dev:all` checks ports 4000/8081/8082, bootstraps Postgres (service or docker compose), installs backend/mobile deps, runs migrations + `seed:e2e`, starts backend + Metro, adb reverse, and launches `Pixel_7_API_34`.

# Next 7 / 14 / 30 Days Plan
- Next 7 days: Fix web lint/type errors and failing vitest cases (`web/app/app/...`, `tests/diagnosticsPage.test.tsx`, `tests/deviceDetailPage.test.tsx`); fix mobile history test empty-state and re-run Jest without `--forceExit`; rerun `npm run release:check`.
- Next 14 days: Run Playwright smoke with seeded envs and Detox workflow once unit suites are green; capture artifacts for emulator readiness; validate `/health-plus` with vendor flags true/false and signed URL flow end-to-end.
- Next 30 days: Prove live vendor history E2E with real keys (script + UI verification), tighten web CSP/frame ancestor envs in staging/prod, and pursue removing Jest `--forceExit` by cleaning open handles (use `--detectOpenHandles` baseline).  
