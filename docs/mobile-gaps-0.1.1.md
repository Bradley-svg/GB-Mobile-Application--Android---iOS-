# Mobile Gaps – 0.1.1 sweep

## Dashboard
- Implemented: uses `/sites` + `/alerts?status=active`, caches sites to AsyncStorage, status chips (incl. critical), offline read-only card, Empty/Error components, offline cache test.
- Stub/weak: navigation still allowed offline without per-card guidance; error/empty state coverage remains light.
- Missing: clearer copy on what is disabled offline and broader loading/error/offline tests.

## Site
- Implemented: loads `/sites/:id` + `/sites/:id/devices`, caches site/device payloads offline, shows last-seen/city, status pill handles warning/offline/critical.
- Stub/weak: devices list lacks offline/empty/error coverage in tests; back/deep-link handling not exercised.
- Missing: richer offline read-only guidance and tests for error/offline/cached rendering.

## Device telemetry/history
- Implemented: telemetry charts with 1h/24h/7d (backend 1h enabled), stale banner, offline telemetry empty state, compressor history posts `/heat-pump-history` with correct payload, offline/disabled copy plus 502/503 messaging, expanded tests.
- Stub/weak: history still uncached; telemetry error copy remains generic.
- Missing: consider caching history window or surfacing stale timestamps across ranges.

## Device control
- Implemented: setpoint/mode mutations with pending states and 30–60°C guard, commands disabled for offline/device-offline/unconfigured with inline messaging, friendly throttle/validation mapping and tests, mode rollback on failure.
- Stub/weak: still using static bounds (not device capabilities) and no last-command surfacing.
- Missing: surface last command/result and device-specific bounds when available.

## Alerts
- Implemented: list with severity chips + virtualization, client-side filtering for cached alerts offline, detail buttons gated + inline errors, cached alerts stored.
- Stub/weak: error copy still generic; detail relies on query cache (no persisted alert detail).
- Missing: stronger empty/error copy per filter and tests for ack/mute backend failure paths.

## Profile
- Implemented: user name/email, notification toggle backed by `/user/preferences` + AsyncStorage cache, OS-permission warning with “Open Settings”, logout button, Diagnostics screen (version/API URL/health sample/user & device ids).
- Stub/weak: logout still leaves React Query cache; no explicit logout success feedback.
- Missing: clear cache reset on logout and optional push/registration state surface.

## Offline
- Implemented: app-level offline banner, offline cards/banners on dashboard/device history/telemetry/alerts, commands/ack/mute disabled offline.
- Stub/weak: Site/Alert detail offline guidance still minimal; cache invalidation remains manual.
- Missing: unified offline empty/error copy across Site/Alert detail and deeper retry guidance.

## Push
- Implemented: push registration gated by OS permission + `alertsEnabled`; caches prefs; clears push markers on logout; diagnostics includes push enabled state.
- Stub/weak: prefs toggle error path lightly tested.
- Missing: stronger tests for toggle rollback/error.

## Navigation / E2E
- Implemented: Auth vs App stacks with Dashboard/Alerts/Profile tabs; Site/Device/Alert detail stack; Diagnostics route added; Detox smoke for Login→Dashboard→Site→Device→Alerts→Profile→Logout.
- Stub/weak: no navigation path from Alert detail to Device/Site; offline navigation flows untested.
- Missing: optional deep link from alerts to device/site and offline cached navigation coverage.
