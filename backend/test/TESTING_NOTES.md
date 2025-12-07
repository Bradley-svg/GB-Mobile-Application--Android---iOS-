<!--
API suites load the Express instance directly from src/index (NODE_ENV=test keeps app.listen() from running) and hit it with Supertest in-memory. Tests currently stub ../src/config/db (and other integrations) with vi.mock so no real Pool is created; without the mock, src/config/db would throw on a missing DATABASE_URL and Vitest beforeAll hooks would sit until the 10s timeout while the Pool tried to connect. There was no shared test bootstrap; each file set env + dynamic-imported the app, so missing DB/app wiring showed up as "Hook timed out after 10s" in the API suites.
-->

# Backend testing notes

- Test harness: `test/vitest.setup.ts` calls `setupTestDb`/`resetTestDb` from `test/testDbSetup.ts` before suites start and tears down at the end. It requires `TEST_DATABASE_URL`; it fails fast with a clear message if the env var is missing or unreachable.
- DB selection: when `NODE_ENV=test`, `src/config/db` now uses `TEST_DATABASE_URL` and errors if it is absent (prod/dev keep using `DATABASE_URL` unchanged).
- Reset policy: the harness truncates and seeds a small demo dataset when the database name contains `test` (or when `ALLOW_TEST_DB_RESET=true`). If you point `TEST_DATABASE_URL` at a dev DB, seeding still runs but truncation is skipped to avoid destructive resets.
- Local runs: set `TEST_DATABASE_URL` (you can reuse your dev Postgres or a dedicated test DB). The seed inserts a demo org/site/device/user and expects migrations to have run (schema comes from `migrations/`, not `sql/*.sql` snapshots).
- Typical commands from `backend/`: `npm run typecheck`, `npm run lint`, `npm test` (needs TEST_DATABASE_URL), `npm run build`.
