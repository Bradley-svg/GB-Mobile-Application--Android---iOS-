# Greenbro

Cross-platform mobile app + backend for Greenbro heat pump telemetry, alerts, and safe remote control.

## Structure

- `mobile/` – Expo React Native app (Android & iOS)
- `backend/` – Node + Express + Postgres API (BFF between mobile and telemetry system)

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
