# Mobile Feature Map 0.2.0

| Feature | Status | Current files | Notes |
| --- | --- | --- | --- |
| Multi-site fleet dashboard | Done | `mobile/app/screens/Dashboard/DashboardScreen.tsx`, `mobile/app/api/sites/hooks.ts`, `backend/src/controllers/siteController.ts` | Portfolio grid with hero metrics (sites/online devices/active alerts) and offline cache; navigates to Site/Device. |
| Global search, filters, and tags | Partial | `mobile/app/screens/Search/SearchScreen.tsx`, `/fleet` | Search hits `/fleet` with health chips and offline cache; tag model and server-side filters beyond health are still missing. |
| Health scores and last-seen indicators | Partial | `mobile/app/screens/Dashboard/DashboardScreen.tsx`, `mobile/app/screens/Site/SiteOverviewScreen.tsx`, `mobile/app/screens/Device/DeviceDetailScreen.tsx` | Last-seen + status pills and telemetry staleness banners exist; no aggregated health scoring. |
| Site summary tiles (PV/grid/battery, energy, water) | Missing | - | Site view shows name/location/status only; no PV/grid/energy/water summaries. |
| Interactive plantroom schematic | Missing | - | No schematic UI or data model. |
| Live gauges (kW, COP, ΔT, flow, pressure) | Partial | `mobile/app/screens/Device/DeviceDetailScreen.tsx`, `backend/src/services/telemetryService.ts` | Charts for supply/return temps, power, flow, COP; supply dial only; no ΔT calculation or pressure metrics. |
| Device table with quick actions | Partial | `mobile/app/screens/Site/SiteOverviewScreen.tsx` | Card list with quick actions (device detail, alerts); still no table/bulk ops. |
| Device detail with live charts (1h/24h/7d) | Done | `mobile/app/screens/Device/DeviceDetailScreen.tsx`, `backend/src/controllers/deviceController.ts`, `backend/src/services/telemetryService.ts` | Telemetry charts with 1h/24h/7d tabs, offline cache, and Azure history hook. |
| Safe setpoint controls and schedules | Partial | `mobile/app/screens/Device/DeviceDetailScreen.tsx`, `backend/src/services/deviceControlService.ts`, `backend/src/controllers/deviceController.ts`, `backend/src/services/deviceScheduleService.ts` | Setpoint/mode commands with validation + throttling; single daily schedule per device exposed via `/devices/:id/schedule` with validation, advisory-only enforcement, and offline read-only state; device-specific bounds still not surfaced. |
| Audit log and instant rollback | Partial | `backend/src/repositories/controlCommandsRepository.ts`, `backend/src/controllers/deviceController.ts`, `mobile/app/screens/Device/DeviceDetailScreen.tsx` | Control commands are persisted and exposed via `/devices/:id/commands` and rendered in mobile history; no rollback/undo. |
| Alert rules (threshold, rate-of-change, correlation) | Partial | `backend/src/workers/alertsWorker.ts`, `backend/src/services/alertService.ts`, `backend/src/repositories/alertRulesRepository.ts`, `mobile/app/screens/Alerts/AlertDetailScreen.tsx` | Rules table + worker eval for threshold/ROC/offline with load-shedding downgrades and health-plus metrics; rule summaries and snooze options on mobile; no editor/correlation UI yet. |
| Push/in-app/email notifications with routing & snooze | Partial | `backend/src/services/pushService.ts`, `mobile/app/hooks/useRegisterPushToken.ts`, `mobile/app/screens/Alerts/AlertDetailScreen.tsx` | Expo push for critical alerts; snooze chips (15m/1h/4h/until resolved with cap) respect rule defaults; profile toggle/prefs. No email/in-app inbox or routing/snooze options. |
| One-tap work-order creation from alerts | Partial | `backend/src/routes/workOrdersRoutes.ts`, `mobile/app/screens/Alerts/AlertDetailScreen.tsx`, `mobile/app/screens/WorkOrders/*` | Org-scoped work-orders domain with alert entrypoint and list/detail screens; no SLAs/calendar yet. |
| Work-order checklists and templates | Partial | `backend/src/services/workOrdersService.ts`, `mobile/app/screens/WorkOrders/WorkOrderDetailScreen.tsx` | Basic checklist replace/toggle; no templates or reusable playbooks yet. |
| Photo capture, annotations, and attachments | Partial | `backend/src/routes/workOrdersRoutes.ts`, `backend/src/controllers/workOrdersController.ts`, `mobile/app/screens/WorkOrders/WorkOrderDetailScreen.tsx` | Work-order attachments upload/list via `/work-orders/:id/attachments` with local storage and mobile upload button (online-only); no annotations yet. |
| Parts/spares tracking and costs | Missing | - | Not present. |
| SLA timers and status badges | Partial | `mobile/app/screens/WorkOrders/*`, `backend/src/services/workOrdersService.ts` | SLA metadata stored with breach logic and list/detail pills; inline SLA/reminder edit (online-only) and maintenance calendar entry point. |
| Client signature and handover PDF | Missing | - | Not present. |
| Monthly site reports (branded) | Missing | - | Not present. |
| Data export (CSV) per site/device | Partial | `backend/src/services/exportService.ts`, `backend/src/controllers/siteController.ts`, `backend/src/controllers/deviceController.ts`, `mobile/app/screens/Site/SiteOverviewScreen.tsx`, `mobile/app/screens/Device/DeviceDetailScreen.tsx` | CSV export endpoints for site devices and device telemetry, surfaced as online-only export buttons (data URLs; future streaming for large sets). |
| Role-based access (Owner/Facilities/Contractor/Admin) | Partial | `backend/src/services/authService.ts`, `backend/src/services/rbacService.ts`, `backend/src/controllers/deviceController.ts`, `backend/src/controllers/workOrdersController.ts`, `mobile/app/store/authStore.ts`, `mobile/app/screens/Profile/ProfileScreen.tsx` | Roles stored on users and emitted in auth/JWT; control/schedules/work-order/doc uploads gated (contractors read-only). UI shows role and hides sharing for contractors; no SSO/2FA yet. |
| Share links with expiry and scopes | Partial | `backend/src/migrations/000009_share_links.js`, `backend/src/services/shareLinksService.ts`, `backend/src/controllers/shareLinksController.ts`, `mobile/app/screens/Profile/SharingScreen.tsx`, `mobile/app/screens/Sharing/ShareLinksScreen.tsx` | Read-only share links for sites/devices with expiry + revoke, public `/public/share/:token` payloads, and mobile management UI; no custom permissions beyond read-only. |
| Offline cache (last 24h) and queued actions | Partial | `mobile/app/screens/Dashboard/DashboardScreen.tsx`, `mobile/app/screens/Site/SiteOverviewScreen.tsx`, `mobile/app/screens/Device/DeviceDetailScreen.tsx`, `mobile/app/screens/Alerts/AlertsScreen.tsx`, `mobile/app/utils/storage.ts` | AsyncStorage cache for portfolio/site/device/alerts/telemetry read-only; no action queue/sync; cache age not enforced to 24h. |
| PV integrations (Victron, Sunsynk) read-only | Missing | - | Not present. |
| TOU and load-shedding awareness in alerts | Partial | `backend/src/services/siteScheduleService.ts`, `backend/src/workers/alertsWorker.ts` | Load-shedding windows stored in `site_schedules`; alerts worker downgrades offline severity during load-shedding; no UI or TOU peak surfacing yet. |
| Device commissioning wizard | Missing | - | Not present. |
| Firmware/version and connectivity status | Partial | `mobile/app/screens/Dashboard/DashboardScreen.tsx`, `mobile/app/screens/Site/SiteOverviewScreen.tsx`, `mobile/app/screens/Device/DeviceDetailScreen.tsx`, `backend/src/repositories/devicesRepository.ts` | Devices carry `firmware_version` + `connectivity_status`; dashboard/site/device screens now show branded connectivity pills and firmware text; no firmware OTA flow. |
| Maintenance calendar and reminders | Partial | `mobile/app/screens/Maintenance/MaintenanceCalendarScreen.tsx`, `/maintenance/summary` | Calendar view with open/overdue/due-soon buckets and cached offline view; reminders stored on work orders but no push/notification yet. |
| Document vault (manuals, schematics) | Partial | `backend/src/routes/documentRoutes.ts`, `mobile/app/screens/Documents/DocumentsScreen.tsx` | Site/device document uploads via `/sites/:id/documents` + `/devices/:id/documents` with Documents screen entry from Site/Device; cached read-only when offline. |
| User authentication with SSO/2FA | Missing | `backend/src/controllers/authController.ts`, `mobile/app/screens/Auth/LoginScreen.tsx` | Only local email/password; no SSO or 2FA. |
| Device onboarding/registration | Missing | - | No device creation/provisioning flow. |
| Basic accessibility (WCAG-aligned states & contrasts) | Missing | `mobile/app/components/*` | Limited accessibility props; contrast/dark-mode not validated. |
| Error/state telemetry and diagnostics | Partial | `mobile/app/screens/Profile/DiagnosticsScreen.tsx`, `mobile/app/api/health/hooks.ts`, `backend/src/services/healthService.ts` | Diagnostics shows `/health-plus` snapshot with alerts engine stats; no client crash/state telemetry pipeline. |
| Theming (dark mode) | Missing | `mobile/app/theme/colors.ts`, `mobile/app/screens/Profile/ProfileScreen.tsx` | Single light theme; dark-mode row is static. |

## Architectural constraints to respect
- Keep branding and tokens from `mobile/app/theme/*` and assets under `mobile/assets/greenbro/` per `docs/branding/README.md`; UX in tabs/screens matches live screenshots.
- Navigation shape is fixed in `mobile/app/navigation/RootNavigator.tsx`: Auth stack vs App stack with Dashboard/Alerts/Profile tabs and Site/Device/Alert/Diagnostics stack routes; Detox/Jest suites depend on these IDs.
- Data layer uses axios client with JWT refresh + React Query caches; offline reads rely on `loadJson/saveJson` with `useNetworkBanner` gating commands/ack/mute/control (do not bypass these guards).
- Backend layering is controller → service → repository with migrations as source of truth; mobile depends on telemetry metric names (`supply_temp/return_temp/power_kw/flow_rate/cop`), control command validation, and `/health-plus` diagnostics payloads.
- Tests: mobile uses jest-expo + React Query tests and Detox smoke; backend uses Vitest with Postgres seeding (`TEST_DATABASE_URL`). New features should slot into these harnesses.

## Proposed roadmap

**Phase 0.2.x - Fleet visibility & search**  
Features: global search/filters/tags across sites/devices/alerts, health score + last-seen badges on dashboard/site list, site summary tiles (PV/grid/battery/energy/water if data available), device list quick actions, sturdier offline cache with 24h freshness hints and queued fetch retries.  
Impact: backend search endpoints + indexes, optional summary aggregates; extend status/last_seen fields; mobile search bar + filters, badges, tile components, offline cache expiry indicator.

**Phase 0.3.x - Alerts, control, and reliability**  
Features: alert rule engine (threshold + rate-of-change + correlation) with TOU/load-shedding inputs, richer push routing/snooze options, expose control audit/last-command and add safe setpoint schedules, surface firmware/connectivity signals, optional plantroom schematic placeholder.  
Impact: new alert_rules tables + worker logic, TOU/load-shedding inputs, control audit/read endpoints and scheduling jobs; mobile rule views (read-only/editor), alert detail actions, control schedule UI, firmware/connectivity badges.

**Phase 0.4.x - Work orders & maintenance**  
Features: one-tap work-order creation from alerts, checklists/templates, photo capture with annotations/attachments, parts/spares and cost tracking, SLA timers/status badges, maintenance calendar/reminders, client signature + handover PDF, document vault.  
Impact: backend domains for work_orders/tasks/attachments/parts/SLAs + storage; mobile work-order screens, media capture/upload, checklist UI, signature/PDF export flows.

**Phase 0.5.x - Sharing, reporting, and onboarding**  
Features: role-based access and sharing links with scopes/expiry, SSO/2FA, device onboarding/commissioning wizard, monthly site reports and CSV exports, PV integrations (Victron/Sunsynk) read-only, dark mode + accessibility pass, queued actions/offline sync polish.  
Impact: RBAC/SSO schemas and middleware, invite/share link endpoints, onboarding/commissioning APIs, reporting/export jobs, PV integration clients, theming/accessibility updates, offline action queue with conflict resolution on mobile.
