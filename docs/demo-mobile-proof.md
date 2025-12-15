# Greenbro mobile demo bring-up (Android emulator)

## Summary
- Demo stack launched via `npm run demo:start` (backend + Metro + emulator wiring). Initial readiness failed because web dev server was not up; after starting web (`npm run dev` in `web`) `npm run demo:check` passed (ports 4000/3000/8081 up, embed reachable, emulator app running).
- Backend healthy and demo seed applied (`seed:e2e`), `curl -I http://localhost:4000/health-plus` returned 200.
- Emulator `Pixel_7_API_34` online with `adb reverse` for 4000/8081; dev client launched (`com.greenbro.mobile/.MainActivity`).
- Mobile lint/typecheck: pass. Mobile tests: 3 failures (dashboard demo pill, scan entrypoint, dashboard theme toggle). `release:check:fast` failed at web typecheck (existing TS errors in `web` app layout/org switcher).
- No repo code changes were made.

## What was run (chronological)
- Versions: `node -v` (v22.20.0), `npm -v` (11.6.2), `npx --version` (11.6.2), `java -version` (OpenJDK 17.0.17), `adb version` (36.0.0 from `C:\Users\bradl.CRABNEBULA\AppData\Local\Android\Sdk\platform-tools\adb.exe`).
- Device/emulator: `adb devices` (none initially), started `Pixel_7_API_34`, then `adb devices` → `emulator-5554 device`.
- Ports: `netstat -ano | findstr ":4000|:8081|:8082|:3000"` (all free pre-start).
- Demo stack: `npm run demo:start` → backend migrate/seed, backend/Metro started, emulator launched + `adb reverse`; readiness failed because web 3000 not listening.
- Web dev server: `npm run dev` in `web` (background) → port 3000 listening.
- Readiness: `npm run demo:check` → all checks PASS.
- Health: `curl.exe -I http://localhost:4000/health-plus` (200 OK), `curl.exe -i http://localhost:4000/demo/status` (401 Unauthorized, expected without auth).
- ADB reverse: `adb reverse --list` → `tcp:4000` and `tcp:8081` mapped.
- Mobile QA: `cd mobile && npm run lint`, `npm run typecheck` (pass); `npm test -- --runInBand --detectOpenHandles` (3 failing suites).
- Repo fast checks: `npm run release:check:fast` (failed at web typecheck errors).
- Logs: `npm run demo:check` output saved to `logs/demo-ready-check.json` (latest PASS), `adb logcat ...` excerpt saved to `logs/demo-logcat.txt`. Emulator screenshot: `logs/demo-emulator.png`.

## Evidence snapshots
- Readiness JSON: `logs/demo-ready-check.json` (PASS for port:4000, port:3000, port:8081, health-plus, demo-status, web-embed 307 redirect, emulator-app running).
- Backend health: `curl.exe -I http://localhost:4000/health-plus` → 200 OK; `curl.exe -i http://localhost:4000/demo/status` → 401 Unauthorized (requires auth).
- Emulator wiring: `adb reverse --list` → `tcp:4000`, `tcp:8081`; `adb devices` → `emulator-5554 device`.
- Logcat excerpt: `logs/demo-logcat.txt` (captures recent http/auth strings; mostly system noise, no API errors observed in filtered slice).
- Screenshot: `logs/demo-emulator.png` (captured via `adb exec-out screencap -p`).

## Current blockers / next actions
1) Web typecheck blockers (from `npm run release:check:fast`): TS errors in `web/app/(app)/layout.tsx` (several “orgs is of type unknown” and implicit any) and `lib/useOrgSwitcher.ts` (“Expected 0-1 arguments, got 2”). Fix type annotations to get release:check:fast green.
2) Mobile Jest failures (demo flow polish):
   - `app/__tests__/DashboardLargeList.test.tsx`: missing `demo-mode-pill` testID.
   - `app/__tests__/ScanDeviceScreen.test.tsx`: missing `scan-device-entry` testID.
   - `app/__tests__/DashboardThemeToggle.test.tsx`: missing `pill-dark` element in rendered dashboard.
   Investigate dashboard/test fixtures to expose these elements when expected.
3) Web dev server resilience: initial `demo:start` failed readiness because port 3000 was not up; ensure `web` dev server starts reliably (check `scripts/web-dev.js` spawn issue; earlier `spawn EINVAL` logged in `logs/web-dev-run3.err.log`).
4) Optional: Confirm in-emulator API base. `.env` uses `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000`; `adb reverse` in place for 4000/8081. If connectivity issues arise, verify runtime logcat for “Greenbro API base URL” and adjust env or reverse accordingly.

## Demo readiness verdict
- Backend + Metro + emulator: **READY** (ports 4000/8081, adb reverse, emulator app running, seed applied).
- Web embed: **READY after manual start** (port 3000 listening, `/embed` responded 307).
- Tests: **NOT CLEAN** — mobile has 3 failing Jest cases; web typecheck failing. These are demo-time risks if not addressed.
- App/API wiring: Expected to work via adb reverse; backend health OK; no in-app API errors captured in filtered logcat slice.
