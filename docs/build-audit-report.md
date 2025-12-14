# Greenbro Build Audit (Windows/PowerShell)

## Executive summary
- Builds/tests now pass for backend, web, and mobile after per-package installs; `npm run release:check` is green (e2e stages skipped by design).
- Root developer ergonomics need polish: `npm ci`/`npm audit` at repo root fail (no lockfile) and backend migrations do not read `.env` automatically.
- Backend health is mostly green but heat-pump history reports unhealthy and secrets are committed in `backend/.env`.
- Mobile/web dev runtimes not exercised (no emulator/dev server spins); staging smoke scripts abort for missing env.
- Security posture is reasonable (rate limits/2FA flags present, CSP enforced) but audited vulnerabilities remain until dependency bumps.

## Environment and prerequisites
- OS: Windows 11 Pro 25H2 (10.0.26200); PowerShell 5.1.26100.7462.
- Node v22.20.0, npm 11.6.2, git 2.51.1.windows.1, Java OpenJDK 17.0.17.
- Android SDK at `C:\Users\bradl.CRABNEBULA\AppData\Local\Android\Sdk`; `adb` not on PATH. No `psql` CLI available.

## Build matrix (root commands)
| Area    | Install          | Lint | Typecheck | Tests | Coverage | Release check |
|---------|------------------|------|-----------|-------|----------|----------------|
| Root    | 🔴 `npm ci` (no lockfile) | ✅ | ✅ | ✅ | ✅ (per pkg) | ✅ (e2e skipped) |
| Backend | ✅ `npm ci` | ✅ | ✅ | ✅ `npm run test:coverage` | 82% | – |
| Mobile  | ✅ `npm ci` | ✅ | ✅ | ✅ `npm test --runInBand` | n/a | – |
| Web     | ✅ `npm ci` | ✅ | ✅ | ✅ `npm run test:coverage` | 45% overall | – |

## Findings

### P1
- Symptom: `npm ci` fails at repo root with EUSAGE/ENOLOCK (`package-lock.json` missing).  
  Root cause: monorepo relies on per-package lockfiles only.  
  Files: `package.json` (root).  
  Fix steps: add a generated root lock (`npm install --package-lock-only`) or document that installs must be run per package before calling root scripts.  
  Verification: `npm ci` (root) should succeed.

- Symptom: `npm run migrate:dev` prints `Database URL not provided...` even with `backend/.env` present.  
  Root cause: `backend/scripts/run-migrations.js` never loads `.env`, so DATABASE_URL is unset unless exported manually.  
  Files: `backend/scripts/run-migrations.js`, `backend/.env`.  
  Fix steps: load dotenv in the script or wrap `npm run migrate:dev` with `cross-env DATABASE_URL=...`; update docs to call out the requirement.  
  Verification: `cd backend; npm run migrate:dev` should apply migrations without extra env exports.

- Symptom: `/health-plus` shows `heatPumpHistory.healthy:false` with stale `lastSuccessAt` (2025-12-13) despite HEATPUMP_HISTORY configured.  
  Root cause: vendor history fetches are not running regularly in local/dev; health check treats the stale heartbeat as unhealthy.  
  Files: `backend/.env`, `backend/src/services/heatPumpHistoryService.ts` (health wiring).  
  Fix steps: run a background fetch (e.g., call `/heat-pump-history` or mark HEATPUMP_HISTORY_DISABLED=true for local) and document the expectation; consider resetting the health window for dev.  
  Verification: `curl http://localhost:4000/health-plus` should report `heatPumpHistory.healthy:true`.

- Symptom: Staging smoke scripts abort immediately: `Missing required env vars: STAGING_HEALTH_URL...` and `Missing .env.staging-smoke`.  
  Root cause: no `.env.staging-smoke` populated from the example.  
  Files: `scripts/staging-smoke.js`, `scripts/staging-smoke-local.js`, `docs/staging-smoke.env.example`.  
  Fix steps: copy `docs/staging-smoke.env.example` to `.env.staging-smoke` (and local variant) with staging URLs/creds; add a preflight note in docs.  
  Verification: `node scripts/staging-smoke.js` should run through checks or cleanly skip when vars are set.

### P2
- Symptom: Secrets (JWT secret, heat-pump API key) live in tracked `backend/.env`.  
  Root cause: `.env` (not just `.env.example`) is committed.  
  Files: `backend/.env`.  
  Fix steps: rotate the values, remove `.env` from git, keep only sanitized `.env.example`, and rely on local-only untracked `.env`.  
  Verification: `git status` shows `.env` untracked; secret rotations confirmed in the secret store.

- Symptom: Toolchain gaps for mobile/backend ops.  
  Root cause: `adb` not on PATH and no `psql` CLI installed.  
  Files: environment.  
  Fix steps: add `%ANDROID_HOME%\\platform-tools` and `%ANDROID_HOME%\\emulator` to PATH; install PostgreSQL client or dockerized psql for manual DB checks.  
  Verification: `where adb` and `psql --version` succeed.

- Symptom: Open vulnerabilities from audits.  
  Root cause: dependencies pinned before advisories.  
  Files: `backend/package-lock.json`, `mobile/package-lock.json`, `web/package-lock.json`.  
  Fix steps:  
  - Backend: upgrade `node-pg-migrate` (fixes glob CLI CVE) and move vitest/vite/esbuild to patched versions; rerun `npm audit`.  
  - Mobile: upgrade to Expo CLI >=1.0.0 stable (pulls send >=0.19.0).  
  - Web: bump `next` to 16.0.10 or later.  
  Verification: rerun `npm audit` in each package with zero high/moderate findings.

- Symptom: Dev orchestration unverified (web `npm run dev`, root `npm run dev:all`, mobile `npm run android:qa`).  
  Root cause: not executed to avoid spawning long-lived servers/emulators without AVD setup.  
  Files: `scripts/dev-all.ps1`, `web/package.json`, `mobile/package.json`.  
  Fix steps: once AVD `Pixel_7_API_34` exists and PATH is fixed, run `npm run dev:all` and `npm run web:dev` with env (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_EMBEDDED`, `FRAME_ANCESTORS`) to validate dashboards and Metro/emulator wiring; capture any failures.  
  Verification: backends + Metro + emulator start cleanly; http://localhost:3000/embed responds.

- Symptom: Web coverage is low (≈45%, app directory mostly untested).  
  Root cause: integration tests focus on fixtures, not app route handlers.  
  Files: `web/app/*`.  
  Fix steps: add minimal tests around page-level server components (login/alerts/work-orders) or mark uncovered files as intentionally excluded.  
  Verification: `cd web; npm run test:coverage` shows improved coverage or documented exclusions.

## Demo-readiness checklist
- Backend: `npm ci`, lint/typecheck, coverage tests all green; `/health-plus` responds 200 but heatPumpHistory flagged unhealthy; migrations require exported DATABASE_URL. DB reachable locally (seeds/tests succeeded).
- Mobile: `npm ci` (long), lint/typecheck/tests pass. Dev client/emulator flow and `npm run android:qa` not exercised; ensure adb/AVD ready before demo.
- Web: `npm ci` and lint/typecheck/tests/coverage green. Dev server not started; set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_EMBEDDED`, `FRAME_ANCESTORS` before running `npm run dev`. CSP/frame-ancestors enforced in `web/next.config.mjs`.
- Scripts: `scripts/dev-all.ps1`/`stop-all.ps1` inspected but not run; staging smoke scripts require `.env.staging-smoke`.

## Recommended follow-ups
- 1) Decide whether to add a root lockfile or adjust docs/scripts to skip root `npm ci`.  
- 2) Patch `backend/scripts/run-migrations.js` to read `.env` automatically and clean committed secrets.  
- 3) Address audit advisories (node-pg-migrate/esbuild/vite, Expo/`send`, Next 16.0.10).  
- 4) Validate `dev:all` + web dev server once adb/AVD and DB CLI are set up.  
- 5) Improve/annotate web coverage for app routes.

## Appendix (key command outputs)
- Root install: `npm ci` → `The npm ci command can only install with an existing package-lock.json...` (root).  
- Backend migrate: `cd backend; npm run migrate:dev` → `Database URL not provided. Set DATABASE_URL or TEST_DATABASE_URL...` (`backend/scripts/run-migrations.js`).  
- Backend health: `curl http://localhost:4000/health-plus` → `"heatPumpHistory":{"configured":true,"disabled":false,"lastSuccessAt":"2025-12-13T19:14:19.074Z","healthy":false,...}` (`backend` runtime).  
- Staging smoke: `node scripts/staging-smoke.js` → `Missing required env vars: STAGING_HEALTH_URL, WEB_E2E_BASE_URL, WEB_E2E_EMAIL, WEB_E2E_PASSWORD` (`scripts/staging-smoke.js`).  
- Audit highlights:  
  - Backend `npm audit` → 8 vulns (glob CVE via node-pg-migrate; esbuild/vite/vitest).  
  - Mobile `npm audit` → 3 low (send <0.19.0 via @expo/cli/expo).  
  - Web `npm audit` → 1 high (Next 16.0.8 server actions exposure).
