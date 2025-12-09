Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "=== GREENBRO stop:all ==="
Write-Host "Stopping Node/Expo/Metro, emulator (if running), and dockerized Postgres fallback."

$repoRoot = Resolve-Path -Path (Join-Path $PSScriptRoot "..")
$composeFile = Join-Path $repoRoot "docker-compose.dev.yml"

Write-Host "Stopping Node / Expo / Metro processes..."
$procs = Get-Process node, expo, metro -ErrorAction SilentlyContinue
if ($procs) {
  $procs | Stop-Process -Force
  Write-Host "Stopped Node/Expo/Metro processes."
} else {
  Write-Host "No Node/Expo/Metro processes found."
}

Write-Host "Checking for running Android emulators..."
$adbCmd = Get-Command "adb" -ErrorAction SilentlyContinue
if (-not $adbCmd) {
  Write-Host "adb not found on PATH; skipping emulator shutdown."
} else {
  $adbPath = if ($adbCmd.Source) { $adbCmd.Source } else { $adbCmd.Path }
  $emuDevices = & $adbPath devices | Select-String "emulator-"
  if ($emuDevices) {
    Write-Host "Emulator(s) detected, trying to stop..."
    & $adbPath "-s" "emulator-5554" "emu" "kill" 2>$null
    & $adbPath "-s" "emulator-5556" "emu" "kill" 2>$null
    # Don’t crash if no device; just attempt a few common IDs and move on
  } else {
    Write-Host "No emulator detected."
  }
}

Write-Host "Checking docker compose Postgres fallback..."
if (-not (Test-Path $composeFile)) {
  Write-Host "Compose file not found at $composeFile; skipping docker Postgres stop."
} else {
  $dockerCmd = Get-Command "docker" -ErrorAction SilentlyContinue
  if (-not $dockerCmd) {
    Write-Host "Docker not available; skipping docker Postgres stop."
  } else {
    try {
      $runningServices = docker compose -f $composeFile ps --status running --services 2>$null
      if (-not $runningServices) {
        $runningServices = docker compose -f $composeFile ps --services 2>$null
      }

      if ($runningServices -and ($runningServices -contains "postgres")) {
        Write-Host "Stopping docker compose Postgres service..."
        docker compose -f $composeFile stop postgres | Out-Null
        Write-Host "docker compose stop postgres invoked."
      } else {
        Write-Host "No Postgres service reported by docker compose; nothing to stop."
      }
    } catch {
      Write-Warning "Could not stop docker compose Postgres service: $_"
    }
  }
}
