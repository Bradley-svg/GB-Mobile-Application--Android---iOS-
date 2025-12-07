# Build Progress Report 0.4.0 — Work orders & maintenance v1

## What shipped
- **Backend**: Added `work_orders`, `work_order_tasks`, and `work_order_attachments` tables with org scoping and indexes; services enforce open → in_progress → done/cancelled transitions, alert/site/device validation, and default checklist seeding for alert-created orders. New routes: `/work-orders`, `/work-orders/:id`, `/alerts/:id/work-orders`, `/devices/:id/work-orders`, `/sites/:id/work-orders`, `/work-orders/:id/tasks`.
- **Mobile**: New Work Orders list/detail screens in the App stack (Profile shortcut + Alert Detail entry). List supports status chips and offline cached read-only view; detail shows status/priority/site/device/linked alert, notes, and checklist with offline-safe disable states. Alert Detail now has a “Create work order” action that jumps to the new detail.
- **Tests/docs**: Added Vitest coverage for work-order repository/service/routes and Jest coverage for list/detail/alert entry flows; repo overview and feature map updated; new progress note (this file).

## How to exercise
1. **Migrate**: `cd backend && npm run migrate:dev` (and `npm run migrate:test` for test DBs).
2. **Create from alert**: Via API `POST /alerts/:id/work-orders` (auth required) or in the mobile app from Alert Detail’s “Create work order” button (online only).
3. **Browse**: Open Work Orders from the Profile screen to see the list; tap a card for detail. Offline shows cached list in read-only mode.
4. **Update**: In detail, use status actions (Start/Done/Cancel) and toggle checklist items. Notes save through the same PATCH endpoint. Offline disables mutations until reconnected.
