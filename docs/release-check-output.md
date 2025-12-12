# Release Check Output

Reference for the repo-level release commands and what to expect when they run locally or in CI.

## Commands
- `npm run release:check`: lint + typecheck + backend coverage + mobile unit tests + web coverage, then optional staging smoke if envs are present. Also prints skip/reminder lines for web e2e and Detox.
- `npm run release:check:fast`: lint + typecheck only, with notes about skipped suites.
- `npm run release:check:ci`: same as `release:check` but labelled `ci` mode for logs.
- `npm run staging:smoke`: runs backend health-plus (staging) and web Playwright smoke + embed when all staging envs are set; otherwise exits 0 with a skip message.
- `npm run release:e2e:android`: preflight checks for adb/emulator/Metro, then runs `npm run e2e:test:android`.

## Staging smoke envs
All four are required; missing values cause an auto-skip with `staging:smoke skipped (missing env: ...)`:
- `STAGING_HEALTH_URL` (or `HEALTH_BASE_URL`)
- `WEB_E2E_BASE_URL` (staging app host)
- `WEB_E2E_EMAIL` or `DEMO_EMAIL`
- `WEB_E2E_PASSWORD` or `DEMO_PASSWORD`

## Example happy path
```
Starting release:check (local mode)

== Lint (backend, web, mobile)
...eslint output...

== Typecheck (backend, web, mobile)
...tsc output...

== Backend tests + coverage
...vitest summary...

== Mobile unit tests
...jest summary...

== Web tests + coverage
...vitest summary...

-- Backend health-plus (staging)
...summary JSON...
-- Web Playwright smoke + embed
...playwright list reporter...

- Web e2e skipped (set RELEASE_WEB_E2E=true to include)
- Android Detox e2e skipped (run npm run release:e2e:android when ready)

release:check completed successfully.
```

## Failure signals
- Each step stops on the first non-zero exit and echoes `Step failed: <name>` (or a specific preflight message for Detox).
- Playwright/health failures propagate their exit codes through `staging:smoke`.
- Missing staging envs keep the run green by printing the skip line and exiting 0.
