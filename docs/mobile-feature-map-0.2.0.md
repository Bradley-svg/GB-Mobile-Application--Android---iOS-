# Mobile Feature Map 0.2.0

| Feature | Status | Current files | Notes |
| --- | --- | --- | --- |
| Multi-site fleet dashboard | Done | `mobile/app/screens/Dashboard/DashboardScreen.tsx`, `mobile/app/api/sites/hooks.ts`, `backend/src/controllers/siteController.ts` | Portfolio grid with hero metrics (sites/online devices/active alerts) and offline cache; navigates to Site/Device. |
| Global search, filters, and tags | Missing | - | No search endpoints or tag models; UI only filters alerts by severity. |
| Health scores and last-seen indicators | Partial | `mobile/app/screens/Dashboard/DashboardScreen.tsx`, `mobile/app/screens/Site/SiteOverviewScreen.tsx`, `mobile/app/screens/Device/DeviceDetailScreen.tsx` | Last-seen + status pills and telemetry staleness banners exist; no aggregated health scoring. |
| Site summary tiles (PV/grid/battery, energy, water) | Missing | - | Site view shows name/location/status only; no PV/grid/energy/water summaries. |
| Interactive plantroom schematic | Missing | - | No schematic UI or data model. |
| Live gauges (kW, COP, ΔT, flow, pressure) | Partial | `mobile/app/screens/Device/DeviceDetailScreen.tsx`, `backend/src/services/telemetryService.ts` | Charts for supply/return temps, power, flow, COP; supply dial only; no ΔT calculation or pressure metrics. |
| Device table with quick actions | Missing | `mobile/app/screens/Site/SiteOverviewScreen.tsx` | Device list is card-only; no inline quick actions or bulk ops. |
| Device detail with live charts (1h/24h/7d) | Done | `mobile/app/screens/Device/DeviceDetailScreen.tsx`, `backend/src/controllers/deviceController.ts`, `backend/src/services/telemetryService.ts` | Telemetry charts with 1h/24h/7d tabs, offline cache, and Azure history hook. |
| Safe setpoint controls and schedules | Partial | `mobile/app/screens/Device/DeviceDetailScreen.tsx`, `backend/src/services/deviceControlService.ts`, `backend/src/controllers/deviceController.ts` | Setpoint/mode commands with validation + throttling; no schedules or device-specific bounds surfaced. |
| Audit log and instant rollback | Missing | - | Control commands persisted (`backend/src/repositories/controlCommandsRepository.ts`) but not exposed to mobile; no rollback/undo. |
| Alert rules (threshold, rate-of-change, correlation) | Partial | `backend/src/workers/alertsWorker.ts`, `backend/src/services/alertService.ts`, `mobile/app/screens/Alerts/AlertsScreen.tsx` | Worker evaluates offline/high-temp thresholds only; no ROC/correlation or rule editor. |
| Push/in-app/email notifications with routing & snooze | Partial | `backend/src/services/pushService.ts`, `mobile/app/hooks/useRegisterPushToken.ts`, `mobile/app/screens/Alerts/AlertDetailScreen.tsx` | Expo push for critical alerts; mute 60m; profile toggle/prefs. No email/in-app inbox or routing/snooze options. |
| One-tap work-order creation from alerts | Missing | - | No work-order domain. |
| Work-order checklists and templates | Missing | - | Not present. |
| Photo capture, annotations, and attachments | Missing | - | No media capture/attach flows. |
| Parts/spares tracking and costs | Missing | - | Not present. |
| SLA timers and status badges | Missing | - | Not present. |
| Client signature and handover PDF | Missing | - | Not present. |
| Monthly site reports (branded) | Missing | - | Not present. |
| Data export (CSV) per site/device | Missing | - | Not present. |
| Role-based access (Owner/Facilities/Contractor/Admin) | Missing | `backend/src/services/authService.ts`, `mobile/app/screens/Auth/LoginScreen.tsx` | Email/password auth only; no roles/permissions. |
| Share links with expiry and scopes | Missing | - | Not present. |
| Offline cache (last 24h) and queued actions | Partial | `mobile/app/screens/Dashboard/DashboardScreen.tsx`, `mobile/app/screens/Site/SiteOverviewScreen.tsx`, `mobile/app/screens/Device/DeviceDetailScreen.tsx`, `mobile/app/screens/Alerts/AlertsScreen.tsx`, `mobile/app/utils/storage.ts` | AsyncStorage cache for portfolio/site/device/alerts/telemetry read-only; no action queue/sync; cache age not enforced to 24h. |
| PV integrations (Victron, Sunsynk) read-only | Missing | - | Not present. |
| TOU and load-shedding awareness in alerts | Missing | - | Alert worker unaware of TOU/load-shedding context. |
| Device commissioning wizard | Missing | - | Not present. |
| Firmware/version and connectivity status | Partial | `mobile/app/screens/Dashboard/DashboardScreen.tsx`, `mobile/app/screens/Site/SiteOverviewScreen.tsx`, `mobile/app/screens/Device/DeviceDetailScreen.tsx`, `backend/src/repositories/devicesRepository.ts` | Status/last-seen shown; no firmware/version surfacing. |
| Maintenance calendar and reminders | Missing | - | Not present. |
| Document vault (manuals, schematics) | Missing | - | Not present. |
| User authentication with SSO/2FA | Missing | `backend/src/controllers/authController.ts`, `mobile/app/screens/Auth/LoginScreen.tsx` | Only local email/password; no SSO or 2FA. |
| Device onboarding/registration | Missing | - | No device creation/provisioning flow. |
| Basic accessibility (WCAG-aligned states & contrasts) | Missing | `mobile/app/components/*` | Limited accessibility props; contrast/dark-mode not validated. |
| Error/state telemetry and diagnostics | Partial | `mobile/app/screens/Profile/DiagnosticsScreen.tsx`, `mobile/app/api/health/hooks.ts`, `backend/src/services/healthService.ts` | Diagnostics shows `/health-plus` snapshot; no client crash/state telemetry pipeline. |
| Theming (dark mode) | Missing | `mobile/app/theme/colors.ts`, `mobile/app/screens/Profile/ProfileScreen.tsx` | Single light theme; dark-mode row is static. |

## Architectural constraints to respect
- Keep branding and tokens from `mobile/app/theme/*` and assets under `mobile/assets/greenbro/` per `docs/branding/README.md`; UX in tabs/screens matches live screenshots.
- Navigation shape is fixed in `mobile/app/navigation/RootNavigator.tsx`: Auth stack vs App stack with Dashboard/Alerts/Profile tabs and Site/Device/Alert/Diagnostics stack routes; Detox/Jest suites depend on these IDs.
- Data layer uses axios client with JWT refresh + React Query caches; offline reads rely on `loadJson/saveJson` with `useNetworkBanner` gating commands/ack/mute/control (do not bypass these guards).
- Backend layering is controller → service → repository with migrations as source of truth; mobile depends on telemetry metric names (`supply_temp/return_temp/power_kw/flow_rate/cop`), control command validation, and `/health-plus` diagnostics payloads.
- Tests: mobile uses jest-expo + React Query tests and Detox smoke; backend uses Vitest with Postgres seeding (`TEST_DATABASE_URL`). New features should slot into these harnesses.

## Proposed roadmap

**Phase 0.2.x – Fleet visibility & search**  
Features: global search/filters/tags across sites/devices/alerts, health score + last-seen badges on dashboard/site list, site summary tiles (PV/grid/battery/energy/water if data available), device list quick actions, sturdier offline cache with 24h freshness hints and queued fetch retries.  
Impact: backend search endpoints + indexes, optional summary aggregates; extend status/last_seen fields; mobile search bar + filters, badges, tile components, offline cache expiry indicator.

**Phase 0.3.x – Alerts, control, and reliability**  
Features: alert rule engine (threshold + rate-of-change + correlation) with TOU/load-shedding inputs, richer push routing/snooze options, expose control audit/last-command and add safe setpoint schedules, surface firmware/connectivity signals, optional plantroom schematic placeholder.  
Impact: new alert_rules tables + worker logic, TOU/load-shedding inputs, control audit/read endpoints and scheduling jobs; mobile rule views (read-only/editor), alert detail actions, control schedule UI, firmware/connectivity badges.

**Phase 0.4.x – Work orders & maintenance**  
Features: one-tap work-order creation from alerts, checklists/templates, photo capture with annotations/attachments, parts/spares and cost tracking, SLA timers/status badges, maintenance calendar/reminders, client signature + handover PDF, document vault.  
Impact: backend domains for work_orders/tasks/attachments/parts/SLAs + storage; mobile work-order screens, media capture/upload, checklist UI, signature/PDF export flows.

**Phase 0.5.x – Sharing, reporting, and onboarding**  
Features: role-based access and sharing links with scopes/expiry, SSO/2FA, device onboarding/commissioning wizard, monthly site reports and CSV exports, PV integrations (Victron/Sunsynk) read-only, dark mode + accessibility pass, queued actions/offline sync polish.  
Impact: RBAC/SSO schemas and middleware, invite/share link endpoints, onboarding/commissioning APIs, reporting/export jobs, PV integration clients, theming/accessibility updates, offline action queue with conflict resolution on mobile.
