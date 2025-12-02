#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS=()

cleanup() {
  echo
  echo "Stopping dev processes..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

trap cleanup EXIT

echo "Starting backend API..."
(cd "$ROOT/backend" && npm run dev) &
PIDS+=($!)

echo "Starting alerts worker..."
(cd "$ROOT/backend" && npm run dev:alerts) &
PIDS+=($!)

echo "Starting Expo (localhost)..."
(cd "$ROOT/mobile" && npx expo start --localhost --clear) &
PIDS+=($!)

echo "Dev processes running. Press Ctrl+C to stop."

if [[ ${#PIDS[@]} -gt 0 ]]; then
  wait "${PIDS[@]}"
fi
