# Mobile UX Notes (2025-12-05)

- Device Detail: supports 1h/24h/7d ranges with stale-data banner when telemetry is cached or lagging; history and navigation regression tests cover the flows.
- Offline caching: Dashboard, Site, Device, and Alerts cache recent data and surface read-only banners with commands/ack/mute disabled when offline.
- Push notifications: Profile toggle persists `alertsEnabled` locally; disabled if OS permission is denied; `useRegisterPushToken` skips backend registration unless OS permission is granted and alertsEnabled is true.
- Branding: screens use the palette from `docs/branding/README.md` via `mobile/app/theme/colors.ts`. Horizontal logo sits on auth/login and Dashboard header; tabs, pills, and chips use brandGreen for active states and muted greys when inactive.
- Visual spot-checks: Login logo + button, Dashboard hero + pills/cards, Alerts severity chips + filters, Site/Device status chips and cards, Profile toggles and dividers.

## Branding QA (2025-12-06)
- Source: `docs/branding/README.md` (palette + assets). App assets live in `mobile/assets/greenbro/` with originals in `docs/branding/official/`.
- Reference screens for review: Login (centered horizontal logo), Dashboard (hero gradient + cards/pills), Device Detail (charts + controls + status pills), Alerts list/detail (severity pills + filters), Profile (notification toggle and dividers).

## Optional manual smoke
- Online: login as demo, walk Dashboard → Site → Device, flip 1h/24h/7d ranges, and force stale data to see the banner; check Alerts filter/ack/mute; confirm Profile toggle updates while OS permission granted.
- Offline: cut network, open Device to see offline banner + cached data (controls disabled) and Alerts with cached read-only alerts/ack disabled; toggle OS notification permission off to see Profile warning and disabled switch, then reopen Settings link to restore.

## Device Detail manual smoke (heat-pump history)
- Prereqs: backend + Metro running with HEATPUMP_HISTORY envs set and demo login working.
- Login as demo user → Dashboard → Demo Site → Demo Device.
- Compressor current (A) card: shows spinner while loading then a chart with points; if the window is empty show “No history for this period.”
- mac present: no “history disabled” placeholder; if backend returns 503 show “History temporarily unavailable, please try again later.”; if backend returns 502 show “Error loading history from the data source.”
