# Observability and health checks

## Logging
- API logs are structured JSON via `pino`; every request includes `requestId` from `X-Request-ID` (see `src/middleware/logger.ts` and `src/config/requestContext.ts`).
- Slow queries are flagged when they exceed `DB_SLOW_QUERY_MS` (set in env) and include SQL text plus timing; monitor these in staging/prod.
- Auth, file, and control flows emit contextual metadata (user, session, ip, userAgent) to ease correlation with auth lockouts and file/audit events.
- Log levels: `info` for routine events, `warn` for degraded vendor states, `error` for failed calls or unexpected states. Keep parsers pointed at `requestId` and `module` fields for grouping.

## /health-plus usage
- Endpoint: `GET /health-plus` (see `src/services/healthService.ts`). Safe for load balancers and uptime monitors; returns HTTP 200 on success, 5xx on failures.
- Payload highlights:
  - `db` + `dbLatencyMs`
  - `storage.writable` + `storage.latencyMs`
  - `antivirus` state + `latencyMs`
  - `control`, `mqtt`, `heatPumpHistory` (`healthy`, `disabled`, `configured`, last success/error timestamps)
  - `alertsWorker.healthy` and alerts engine run metadata (`alertsEngine`)
  - `push.enabled/lastError`
  - `vendorFlags`: prod-like marker plus vendor disable flags (MQTT/control/history/push)
  - Overall `ok` flag reflects the above; `version` mirrors `APP_VERSION`
- Monitoring guidance:
  - Treat any `ok=false`, `db !== 'ok'`, or `storage.writable=false` as hard failures.
  - Alert on rising `latencyMs` for DB/storage/AV, or repeated `heatPumpHistory.lastErrorAt` without recent `lastSuccessAt`.
  - Watch `alertsWorker.healthy`, `alertsEngine.lastRunAt`, and `alertsEngine.activeAlertsTotal` for drift.
  - Auth lockouts/rate limits surface via API responses; correlate with auth rate-limit logs + requestId for investigation.

## Vendor disable flags
- Vendor toggles are exposed as env vars and surfaced under `vendorFlags.disabled`:
  - `MQTT_DISABLED`
  - `CONTROL_API_DISABLED`
  - `HEATPUMP_HISTORY_DISABLED`
  - `PUSH_NOTIFICATIONS_DISABLED`
- `vendorFlags.prodLike` helps distinguish staging vs prod-like environments when wiring monitors.
- When a vendor flag is true, the relevant subsystem may report `disabled` or `healthy=false`; monitors should degrade gracefully (warn, not page) when a vendor flag explicitly disables a subsystem.

## What to watch
- Error rates by subsystem: control errors, MQTT ingest errors, AV failures (`antivirus.lastResult`), push `lastError`.
  - Pair with slow-query logs and X-Request-ID to trace user impact.
- History/diagnostics: `heatPumpHistory` failures, alerts engine runs, and storage writability.
- Auth: bursts of rate-limited logins (HTTP 429) or frequent refresh-token revocations can indicate attack or client issues.
