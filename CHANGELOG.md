# Changelog

## 0.7.0
- Security/auth: login rate limits with IP/username lockout, password reset tables/routes, TOTP 2FA setup/confirm/disable flows, and refresh-token rotation surfaced via `/health-plus`.
- Telemetry/UX: device dashboard with gauges, compressor history card with range caps, and combined alert/work order timeline on device detail.
- Operations: `/health-plus` with slow-query logging, vendor disable flags, and downsampled telemetry; dev-all orchestration for backend + Metro + emulator.
- Safety/file: antivirus scanning pipeline, signed URL issuance with TTL/HMAC, and audit events around files/shares/push/QR/2FA.
- Push & QR: Expo push for alerts/test payloads with navigation metadata, role-gated push registration/test routes, and QR device lookup with org/RBAC enforcement.
