# Build Progress Report – 0.3.0 (Alerts, Control, Reliability)

## Backend
- Added `alert_rules` model (threshold/ROC/offline) with periodic refresh in `alertsWorker`; load-shedding/TOU windows via `site_schedules`; device setpoint schedules via `device_schedules`.
- New endpoints: `/devices/:id/commands` (control audit), `/devices/:id/schedule` (GET/PUT), `/devices/:id/alert-rules` and `/sites/:id/alert-rules` (read-only rules feed).
- Devices surface firmware version + connectivity; `/health-plus` now returns `alertsEngine` stats (last run, duration, rules loaded, active counts).

## Mobile
- Alert detail: rule summary panel and snooze chips (15m/1h/4h/“until resolved”) that pick up rule defaults; offline guards kept.
- Device detail: schedule card + edit modal hitting `/devices/:id/schedule`, control history list (last 5 commands), firmware/connectivity copy in hero, and a ΔT (supply-return) tile in telemetry.
- Diagnostics: shows alerts engine last run, rules loaded, and active warning/critical counts.

## How to exercise (dev stack)
1. Run backend migrations (`npm run migrate`) then start API (`cd backend && npm run dev`) and mobile (`cd mobile && npm start`). Use TEST_DATABASE_URL with ALLOW_TEST_DB_RESET for local DB.
2. Login as the demo user (demo@example.com / password123).
3. Alerts: open an alert, pick a snooze duration, and view the Rule block for metric/threshold details.
4. Device detail: open a device → check firmware/connectivity line, ΔT tile in telemetry, “Schedule” card (edit to change hours/setpoint/mode), and “Control history” entries with status colours.
5. Diagnostics: Profile → Diagnostics shows new alerts engine rows (rules loaded, last run, active counts).
