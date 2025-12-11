#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${STAGING_DATABASE_URL:-}" ]]; then
  echo "[staging:bootstrap] STAGING_DATABASE_URL is required (postgres://<user>:<pass>@<host>:<port>/greenbro_staging)." >&2
  exit 1
fi

lower_url="$(printf '%s' "${STAGING_DATABASE_URL}" | tr '[:upper:]' '[:lower:]')"
if [[ "${lower_url}" != *"staging"* ]]; then
  echo "[staging:bootstrap] Refusing to run because STAGING_DATABASE_URL does not look like a staging database." >&2
  exit 1
fi

echo "[staging:bootstrap] Applying migrations..."
DATABASE_URL="$STAGING_DATABASE_URL" npm run migrate:dev

echo "[staging:bootstrap] Seeding demo data for staging..."
DATABASE_URL="$STAGING_DATABASE_URL" node scripts/init-local-db.js

echo "[staging:bootstrap] Done."
