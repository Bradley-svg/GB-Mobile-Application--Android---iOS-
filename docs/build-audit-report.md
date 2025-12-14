# Greenbro Build Audit (Windows/PowerShell)

## Executive summary
- P0 demo-readiness fixes applied: backend migrations now auto-load `.env`, backend/.env stays untracked with template guidance, `npm run web:dev` installs deps when missing, and `npm run demo:start` chains stop->dev->web for a clean local bring-up.
- Root remains per-package (no top-level lockfile) with explicit helpers (`npm run ci:{backend|mobile|web}`, `npm run audit:{...}`, `npm run ci`/`npm run audit`) to avoid root `npm ci`/`npm audit` confusion.
- Outstanding risks: heatPumpHistory health still stale locally, staging smoke env missing, audits continue to flag advisories, and adb/psql tooling gaps mean emulator/web bring-up was not re-run here.

## P0 Fix Pack applied
- What changed:
  - `backend/.env` kept untracked via `.gitignore`; README/dev-run-notes call out copying `.env.example` -> `.env`.
  - `backend/scripts/run-migrations.js` loads `.env` when DB envs are absent and fails loudly if still missing.
  - `npm run web:dev` now runs `scripts/web-dev.js`, which installs `web` deps on-demand before starting Next.js.
  - New `scripts/demo-start.ps1` + `npm run demo:start` orchestrate `stop:all` -> `dev:all` -> `web:dev`, launching web on port 3000 in a separate window.
  - Root install/audit policy is explicit: per-package `ci`/`audit` scripts plus combined `npm run ci` / `npm run audit`; no root lockfile.
- Verification commands (latest run):
  - `npm run lint` PASS; `npm run typecheck` PASS; `npm test` PASS.
  - `npm run release:check` PASS (web e2e + staging smoke skipped by env guard).
  - Backend: `npm run migrate:dev` PASS (auto-loaded backend/.env); `npm run seed:e2e` PASS.
  - Web: `npm run test:coverage` PASS (via release:check).
  - `curl http://localhost:4000/health-plus` FAIL (backend not running; start `npm run dev:backend` first).
- Remaining P1/P2 items:
  - heatPumpHistory health stale locally; staging smoke env not populated.
  - Audit advisories still present (backend/node-pg-migrate+vite/esbuild/vitest; mobile Expo CLI/send; web Next 16.0.8).
  - Tooling gaps (adb not on PATH, no `psql` CLI); emulator/dev-all/web bring-up still best-effort only.

## Environment and prerequisites
- OS: Windows 11 Pro 25H2 (10.0.26200); PowerShell 5.1.26100.7462.
- Node v22.20.0, npm 11.6.2, git 2.51.1.windows.1, Java OpenJDK 17.0.17.
- Android SDK at `C:\Users\bradl.CRABNEBULA\AppData\Local\Android\Sdk`; `adb` not on PATH. No `psql` CLI available.

## Build matrix (root commands)
| Area    | Install                                       | Lint                      | Typecheck                 | Tests                                   | Coverage             | Release check                         |
|---------|-----------------------------------------------|---------------------------|---------------------------|-----------------------------------------|----------------------|---------------------------------------|
| Root    | Per-package only (`npm run ci` aggregates)    | Aggregates `lint:*`       | Aggregates `typecheck:*`  | Aggregates `test:*`                     | Per-package coverage | `npm run release:check` (e2e skipped) |
| Backend | `npm ci`                                      | `npm run lint`            | `npm run typecheck`       | `npm run test` / `npm run test:coverage`| 82%                  | -                                     |
| Mobile  | `npm ci`                                      | `npm run lint`            | `npm run typecheck`       | `npm test -- --runInBand`               | n/a                  | -                                     |
| Web     | `npm ci`                                      | `npm run lint`            | `npm run typecheck`       | `npm run test` / `npm run test:coverage`| 45% overall          | -                                     |

## Findings

### P1
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
  Fix steps: once AVD `Pixel_7_API_34` exists and PATH is fixed, run `npm run dev:all` and `npm run web:dev` (auto-installs) with env (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_EMBEDDED`, `FRAME_ANCESTORS`) to validate dashboards and Metro/emulator wiring; capture any failures.  
  Verification: backends + Metro + emulator start cleanly; http://localhost:3000/embed responds.

- Symptom: Web coverage is low (~45%, app directory mostly untested).  
  Root cause: integration tests focus on fixtures, not app route handlers.  
  Files: `web/app/*`.  
  Fix steps: add minimal tests around page-level server components (login/alerts/work-orders) or mark uncovered files as intentionally excluded.  
  Verification: `cd web; npm run test:coverage` shows improved coverage or documented exclusions.

## Demo-readiness checklist
- Backend: `npm ci`, lint/typecheck, coverage tests remain green; migrations now load `backend/.env` automatically, `/health-plus` still reports heatPumpHistory unhealthy.
- Mobile: `npm ci` (long), lint/typecheck/tests pass. Dev client/emulator flow and `npm run android:qa` not exercised; ensure adb/AVD ready before demo.
- Web: `npm ci` and lint/typecheck/tests/coverage green. `npm run web:dev` auto-installs if `web/node_modules` is missing; set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_EMBEDDED`, `FRAME_ANCESTORS` before running. CSP/frame-ancestors enforced in `web/next.config.mjs`.
- Scripts: `npm run demo:start` chains `stop:all` -> `dev:all` -> `web:dev` (web launches in a new window). Staging smoke scripts still require `.env.staging-smoke`.

## Recommended follow-ups
- 1) Improve heatPumpHistory health handling for dev (refresh or relax health window) and rerun `/health-plus`.
- 2) Populate `.env.staging-smoke` and rerun `npm run staging:smoke:local` / `node scripts/staging-smoke.js`.
- 3) Address audit advisories (node-pg-migrate/esbuild/vite, Expo/`send`, Next 16.0.10).
- 4) Validate `dev:all` / `demo:start` once adb/AVD and DB CLI are set up; confirm `http://localhost:3000/embed` renders.
- 5) Improve/annotate web coverage for app routes.

## Appendix (key command outputs)
- `npm run release:check` -> passed; web e2e + staging smoke skipped (env guard), Detox skipped.
- Backend migrate: `cd backend && npm run migrate:dev` -> loaded backend/.env automatically; migrations applied.
- Backend seed: `cd backend && npm run seed:e2e` -> demo seed reset.
- Health probe: `curl http://localhost:4000/health-plus` -> connection failed (backend not running; start `npm run dev:backend`).
- Web coverage: `cd web && npm run test:coverage` -> passed (coverage ~45% overall, server components largely uncovered).
- Audit highlights (unchanged; rerun when ready):
  - Backend `npm audit` -> 8 vulns (glob CVE via node-pg-migrate; esbuild/vite/vitest).
  - Mobile `npm audit` -> 3 low (send <0.19.0 via @expo/cli/expo).
  - Web `npm audit` -> 1 high (Next 16.0.8 server actions exposure).
