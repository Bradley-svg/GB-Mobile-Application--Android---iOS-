## Dev run on 2025-12-06
- Starting full stack spin-up in VS Code.
- Verified local Postgres greenbro_dev/greenbro_test/greenbro_staging databases exist.
- Configured backend .env for local dev (APP_ENV=development, version 0.1.0-dev, dev/test DB URLs, JWT secret, alerts worker disabled, heat pump history envs unset).
### health-plus (dev)

{"ok":true,"env":"development","db":"ok","version":"0.1.0-dev","mqtt":{"configured":false,"lastIngestAt":null,"lastErrorAt":"2025-12-05T12:49:30.201Z","lastError":"","healthy":true},"control":{"configured":false,"lastCommandAt":null,"lastErrorAt":null,"lastError":"CONTROL_CHANNEL_UNCONFIGURED","healthy":true},"heatPumpHistory":{"configured":false,"lastSuccessAt":null,"lastErrorAt":null,"lastError":null,"healthy":true},"alertsWorker":{"lastHeartbeatAt":null,"healthy":true},"push":{"enabled":false,"lastSampleAt":"2025-12-06T15:13:56.588Z","lastError":null}}
- Backend npm install, migrate:dev, init-local-db, typecheck, lint, test (TEST_DATABASE_URL + ALLOW_TEST_DB_RESET), and build all succeeded (`npm test` uses Vitest serialization from `vitest.config.ts` so no Jest `--runInBand` flag is required).
- Backend dev server running via npm run dev (logs at logs/backend-dev-run.log).
- Mobile npm install completed.
- Mobile typecheck, lint, and npm test -- --runInBand passed (jest logs include expected act() warnings).
- Metro running via npx expo start --dev-client --localhost -c --port 8082 (logs at logs/metro-dev-run.log).
- Emulator Pixel_7_API_34 booted; adb reverse set for ports 8082 and 4000.
- Ran npx expo run:android (command timed out after ~10m but build progressed; package com.greenbro.mobile present; launched via adb to prompt bundle load, Metro still waiting to serve bundle).
- Manual app navigation and Detox E2E still pending.
- NetInfo native crash is guarded in JS via app/lib/safeNetInfo.ts; still need to rebuild the dev client with @react-native-community/netinfo bundled to get real connectivity events.
