**Greenbro Build Status (local sweep — 2025-12-05)**

- **Backend**
  - npm install, npm run typecheck, npm run lint, TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test, npm run build — all green locally on Node 20 / Postgres 16.
  - Auth: login/refresh/me plus logout and logout-all are live; password reset endpoint remains intentionally absent.
  - Control: throttling enforced from the last command in DB; `/devices/:id/last-command` surfaces the latest control attempt; supports MQTT or HTTP control channel via env. Health-plus currently shows `configured:false` with lastError `CONTROL_CHANNEL_UNCONFIGURED` (dev run without control config).
  - Telemetry: HTTP ingest route stays a 501 stub; telemetry read path enforces maxPoints with downsampling and metric bounds.
  - Heat-pump history: Azure client with retry/circuit breaker; health-plus includes `heatPumpHistory` block (current dev curl: `configured:true`, `healthy:false`, `lastSuccessAt:null` while upstream is idle).
  - Health-plus sample (`curl http://localhost:4000/health-plus`): `{ ok:true, env:"development", db:"ok", mqtt:{configured:false, healthy:true}, control:{configured:false, lastError:"CONTROL_CHANNEL_UNCONFIGURED", healthy:true}, heatPumpHistory:{configured:true, healthy:false}, alertsWorker:{healthy:true}, push:{enabled:false, lastSampleAt:"2025-12-05T11:26:24.318Z"} }`.

- **Mobile**
  - npm install, npm run typecheck, npm run lint, npm test -- --runInBand — all green locally.
  - Session-expired UX verified in tests; login/logout/refresh flows exercised via authSessionExpired suite.
  - Offline: banner plus cached Dashboard sites; commands disabled while offline.
  - Control UX: pending/throttling messaging present; device detail renders last-command + telemetry and heat-pump history error states.
  - Push: registration rotates on token/user changes (useRegisterPushToken); alerts/history error mapping covered by new tests.

- **CI**
  - Backend job: Node 20, Postgres 16 service, TEST_DATABASE_URL provided, ALLOW_TEST_DB_RESET=true set for API tests.
  - Mobile job: Node 20 with EXPO_PUBLIC_API_URL supplied for tests.

- **Outstanding risks**
  - No 2FA or full password-reset flow yet.
  - Single-instance workers (MQTT/alerts) without distributed locks.
  - No structured observability/metrics stack beyond health-plus.
