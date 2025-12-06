# Mobile UX Notes (2025-12-05)

- Device Detail: supports 1h/24h/7d ranges with stale-data banner when telemetry is cached or lagging; history and navigation regression tests cover the flows.
- Offline caching: Dashboard, Site, Device, and Alerts cache recent data and surface read-only banners with commands/ack/mute disabled when offline.
- Push notifications: Profile toggle persists `alertsEnabled` locally; disabled if OS permission is denied; `useRegisterPushToken` skips backend registration unless OS permission is granted and alertsEnabled is true.
- Branding: screens use the Greenbro palette (brandGreen #39B54A, brandGrey #414042, text #111111/#555555, background #FFFFFF/#F5F7F9, border #E1E5EA, error #DC2626, warning #D97706, success #16A34A) with button/hero gradients (brandGreenDark -> brandGreen). Horizontal logo sits on auth/login and Dashboard header; tabs, pills, and chips use brandGreen for active states and muted greys when inactive.
- Visual spot-checks: Login logo + button, Dashboard hero + pills/cards, Alerts severity chips + filters, Site/Device status chips and cards, Profile toggles and dividers.

## Optional manual smoke
- Online: login as demo, walk Dashboard → Site → Device, flip 1h/24h/7d ranges, and force stale data to see the banner; check Alerts filter/ack/mute; confirm Profile toggle updates while OS permission granted.
- Offline: cut network, open Device to see offline banner + cached data (controls disabled) and Alerts with cached read-only alerts/ack disabled; toggle OS notification permission off to see Profile warning and disabled switch, then reopen Settings link to restore.
