# Release smoke checklist (0.7.0)

## Web
- [ ] Demo tenant path: `npm run demo:seed` (or backend `npm run seed:demo -- --reset`), login as `demo@greenbro.com` / `GreenbroDemo#2025!`, confirm hero tile "Heat Pump #1" on `/app`, device History 6h shows data, Alerts warning+critical open/ack, Work orders open/in-progress/done with clean attachments, Documents include blocked incident report, Sharing shows active/expired/revoked links, Diagnostics healthy.

## Backend (staging)
- [ ] `curl https://staging.api.greenbro.co.za/health-plus` returns ok with db/storage/AV results and push block configured (or intentionally disabled).
- [ ] `POST /auth/login` works for owner/admin test users.
- [ ] `POST /auth/request-password-reset` + `POST /auth/reset-password` succeed for a test account.
- [ ] 2FA flows: `/auth/2fa/setup`, `/auth/2fa/confirm`, and `/auth/login/2fa` succeed end-to-end.
- [ ] QR lookup: `POST /devices/lookup-by-code` with a known code returns the device with correct org scoping.
- [ ] Push: `POST /me/push/test` from a staging client returns success and lands a notification.

## Mobile (staging build)
- [ ] Login as owner/admin and contractor succeeds.
- [ ] Demo path with seeded creds (`demo@greenbro.com` / `GreenbroDemo#2025!`): Fleet → hero device history (6h) → Alerts detail + ack/mute → Work orders + attachments → Documents/sharing → Diagnostics.
- [ ] Theme toggles across light/dark/system.
- [ ] Navigate dashboard â†’ site â†’ device â†’ alerts â†’ work orders â†’ maintenance â†’ documents â†’ sharing â†’ diagnostics without crashes.
- [ ] QR: use â€œScan deviceâ€ to navigate to a device via a known code (real device or emulator camera).
- [ ] Push: registration error-free; Diagnostics â€œSend test notificationâ€ produces an OS notification; tapping from background lands in Alert/Device (or inside the app).
- [ ] Gauges/history: gauges render; compressor history loads or shows a clear â€œunavailableâ€ state when the vendor API is disabled.

## Security / RBAC
- [ ] Contractor role cannot send control commands.
- [ ] Contractor cannot modify work orders.
- [ ] Contractor cannot manage share links.
- [ ] Contractor cannot access restricted QR routes (server enforcement holds).


