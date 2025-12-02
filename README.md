# Greenbro

Cross-platform mobile app + backend for Greenbro heat pump telemetry, alerts, and safe remote control.

## Repository structure

- `backend/` - Greenbro API (Node + Express + Postgres; BFF between mobile and telemetry system)
- `mobile/` - Greenbro mobile app (Expo React Native for Android & iOS; canonical mobile codebase)
- `docs/` - Docs, screenshots, diagrams
- `archive/` - Legacy code and backups (for example `archive/mobile_workdir/`, archived logs)
- `logs/` - Local logs (ignored by git)

`archive/mobile_workdir/` is a legacy copy retained for reference; `mobile/` is the authoritative app. Historical logs and `.codex-logs` artefacts were moved into `archive/logs/` and are ignored going forward.

## Dev commands

```bash
# Mobile
cd mobile
npm install
npm run start

# Backend
cd backend
npm install
npm run dev
```
