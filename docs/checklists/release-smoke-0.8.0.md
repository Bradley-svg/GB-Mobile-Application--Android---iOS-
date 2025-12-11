# Release smoke checklist (0.8.0)

## Web
- [ ] Web build - staging: `npm run web:build:prod` (staging API + embed), `web-deploy` workflow on `main` green through tests/coverage/build, then manual smoke on staging (`/app`, `/app/diagnostics`, or `WEB_E2E_BASE_URL=https://staging.greenbro.co.za npm run web:e2e` with staging creds).
- [ ] Web build - production: after staging smoke, create tag `vX.Y.Z` to trigger the prod `web-deploy` run; verify it finishes green and `https://app.greenbro.co.za` (and iframe embed) serve the new build over TLS.

## Backend (staging)
- [ ] `curl https://staging-api.greenbro.co.za/health-plus` returns ok with db/storage/AV results, push block configured (or intentionally disabled), and `version` showing `0.8.0`.
- [ ] `POST /auth/login` works for owner/admin test users.
- [ ] `POST /auth/request-password-reset` + `POST /auth/reset-password` succeed for a test account.
- [ ] 2FA flows: `/auth/2fa/setup`, `/auth/2fa/confirm`, and `/auth/login/2fa` succeed end-to-end.
- [ ] QR lookup: `POST /devices/lookup-by-code` with a known code returns the device with correct org scoping.
- [ ] Push: `POST /me/push/test` from a staging client returns success and lands a notification.

## Mobile (staging build)
- [ ] Login as owner/admin and contractor succeeds.
- [ ] Theme toggles across light/dark/system.
- [ ] Navigate dashboard -> site -> device -> alerts -> work orders -> maintenance -> documents -> sharing -> diagnostics without crashes.
- [ ] QR: use "Scan device" to navigate to a device via a known code (real device or emulator camera).
- [ ] Push: registration error-free; Diagnostics "Send test notification" produces an OS notification; tapping from background lands in Alert/Device (or at least inside the app).
- [ ] Gauges/history: gauges render; compressor history loads or shows a clear "unavailable" state when the vendor API is disabled.

## Security / RBAC
- [ ] Contractor role cannot send control commands.
- [ ] Contractor cannot modify work orders.
- [ ] Contractor cannot manage share links.
- [ ] Contractor cannot access restricted QR routes (server enforcement holds).
