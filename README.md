# Greenbro

Cross-platform mobile app + backend for Greenbro heat pump telemetry, alerts, and safe remote control.

## Repository structure

- `backend/` - Greenbro API (Node + Express + Postgres; BFF between mobile and telemetry system)
- `mobile/` - Greenbro mobile app (Expo React Native for Android & iOS; canonical mobile codebase)
- `docs/` - Docs, screenshots, diagrams
- `archive/` - Legacy code and backups (for example `archive/mobile_workdir/`, archived logs)
- `logs/` - Local logs (ignored by git)

`archive/mobile_workdir/` is a legacy copy retained for reference; `mobile/` is the authoritative app. Historical logs and `.codex-logs` artefacts were moved into `archive/logs/` and are ignored going forward.

## Installs & audits
- Root has no lockfile by design; install/audit per package via `npm run ci:{backend|mobile|web}` (or `npm run ci` for all) and `npm run audit:{backend|mobile|web}` (or `npm run audit`).

## Dev commands

```bash
# Repo-level helpers (runs backend + mobile tasks sequentially)
npm run lint
npm run typecheck
npm test

# Mobile
cd mobile
npm install
npm run start:devclient   # dev client on localhost:8082 (use npm run start for Expo Go)

# Backend
cd backend
npm install
npm run dev
```

## Run full stack locally

```powershell
npm run stop:all    # optional cleanup
npm run dev:all     # starts backend + Metro + emulator (adb/emulator wiring is best-effort; logs in spawned terminals)
npm run demo:start  # stop-all -> dev-all -> web:dev (Next dev server on :3000; backend on :4000)
```

Environment variables for backend and mobile (dev/staging/prod) are summarised in `docs/envs.md`. Deployment notes for staging/production live in `docs/deploy.md`. Operational readiness checks live in `docs/checklists/operational-readiness.md`. Observability conventions and health-plus monitoring notes are in `docs/observability.md` (see `backend/scripts/check-health-plus.ts` for a CLI probe).
