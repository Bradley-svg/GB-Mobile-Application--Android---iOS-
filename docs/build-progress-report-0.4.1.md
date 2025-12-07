# Build Progress Report 0.4.1 - SLA timers & maintenance calendar

## What shipped
- **Backend**: Added SLA/maintenance columns to `work_orders` (`sla_due_at`, `resolved_at`, `sla_breached`, `reminder_at`, `category`) with validation, breach recompute on reads/updates, and alert-based default SLAs (4h critical / 24h warning). New `/maintenance/summary` endpoint returns org-scoped open/overdue/due-soon counts grouped by SLA date; `/health-plus` now surfaces a maintenance snapshot block.
- **Mobile**: Work Orders list shows SLA pills and due labels with sorting (overdue first, then soonest due); detail screen adds SLA summary + inline edit (due/reminder presets, manual entry, online-only). New Maintenance Calendar screen (App stack + Profile row + list header shortcut) renders `/maintenance/summary` with offline cached read-only mode and last-sync banners.
- **Tests/fixtures**: Seed data now includes future/overdue/done-in/done-outside SLA orders; new Vitest suites for SLA logic and maintenance summary API; Jest coverage for SLA pills/sorting and maintenance calendar offline/online states. Docs updated (repo overview, mobile feature map, this report).

## How to exercise
1. **Migrate**: `cd backend && npm run migrate:dev` (and `npm run migrate:test` with `TEST_DATABASE_URL` + `ALLOW_TEST_DB_RESET=true` for test DBs).
2. **SLA & reminders**: Create/update work orders with optional `slaDueAt`/`reminderAt`/`category`; mark done to see `resolved_at` captured and `sla_breached` recalculated. Alert-created orders default to a 4h/24h SLA by severity.
3. **Maintenance summary**: Call `GET /maintenance/summary` (auth/org scoped) to see open/overdue/dueSoon counts plus by-date buckets; `/health-plus` now includes maintenance counts.
4. **Mobile flows**: From Profile > Work Orders or Alerts > linked work order, check SLA pills and due labels; tap detail > Edit SLA to set due/reminder (online). From Profile > Maintenance or the list header shortcut, open the maintenance calendar; verify offline cached banner when disconnected.

## Verification snapshot
- Backend: `npm run typecheck`, `npm run lint`, `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/greenbro_test ALLOW_TEST_DB_RESET=true npm test`, `npm run build` (rerun migrations before tests).
- Mobile: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`.
