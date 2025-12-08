#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS=()
METRO_PORT="${METRO_PORT:-8082}"
API_PORT="${API_PORT:-4000}"

adb_reverse() {
  local port="$1"
  local label="$2"
  if ! adb reverse "tcp:${port}" "tcp:${port}" >/dev/null 2>&1; then
    echo "Warning: failed to adb reverse tcp:${port} (${label}); is the emulator running?"
  else
    echo "adb reverse tcp:${port} (${label}) configured"
  fi
}

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

if command -v adb >/dev/null 2>&1; then
  echo "Setting up adb reverse for Metro (${METRO_PORT}) and API (${API_PORT})..."
  adb_reverse "${METRO_PORT}" "Metro dev server"
  adb_reverse "${API_PORT}" "backend API"
else
  echo "adb not found; skipping adb reverse for Metro/API"
fi

echo "Starting Expo dev client on localhost:${METRO_PORT}..."
(cd "$ROOT/mobile" && npx expo start --dev-client --localhost -c --port "${METRO_PORT}") &
PIDS+=($!)

echo "Dev processes running. Press Ctrl+C to stop."

if [[ ${#PIDS[@]} -gt 0 ]]; then
  wait "${PIDS[@]}"
fi
