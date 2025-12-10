Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Add-AndroidSdkToPath {
  $sdkRoot = $null
  if ($Env:ANDROID_HOME) {
    $sdkRoot = $Env:ANDROID_HOME
  } elseif ($Env:ANDROID_SDK_ROOT) {
    $sdkRoot = $Env:ANDROID_SDK_ROOT
  }

  if (-not $sdkRoot) {
    return $false
  }

  $pathsToPrepend = @()
  $platformTools = Join-Path $sdkRoot "platform-tools"
  $emulatorDir = Join-Path $sdkRoot "emulator"

  foreach ($candidate in @($platformTools, $emulatorDir)) {
    if ($candidate -and (Test-Path $candidate)) {
      if (-not ($Env:PATH.Split(';') -contains $candidate)) {
        $pathsToPrepend += $candidate
      }
    }
  }

  if ($pathsToPrepend.Count -gt 0) {
    $Env:PATH = ($pathsToPrepend -join ';') + ';' + $Env:PATH
  }

  return $true
}

Write-Host "=== GREENBRO stop:all ==="
Write-Host "Stopping Node/Expo/Metro, emulator (if running), and dockerized Postgres fallback."

$repoRoot = Resolve-Path -Path (Join-Path $PSScriptRoot "..")
$composeFile = Join-Path $repoRoot "docker-compose.dev.yml"

Write-Host "Stopping Node / Expo / Metro processes..."
try {
  $procs = Get-Process node, expo, metro -ErrorAction SilentlyContinue
  if ($procs) {
    $safeProcs = @()
    foreach ($proc in $procs) {
      $cmdLine = $null
      try {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($proc.Id)" -ErrorAction SilentlyContinue).CommandLine
      } catch {
        $cmdLine = $null
      }
      if ($cmdLine -and $cmdLine -match "npm-cli.js") {
        continue
      }
      $safeProcs += $proc
    }

    if ($safeProcs.Count -gt 0) {
      $safeProcs | Stop-Process -Force -ErrorAction SilentlyContinue
      Write-Host "Stopped Node/Expo/Metro processes."
    } else {
      Write-Host "No Node/Expo/Metro processes found."
    }
  } else {
    Write-Host "No Node/Expo/Metro processes found."
  }
} catch {
  Write-Warning "Failed to stop Node/Expo/Metro processes cleanly: $($_.Exception.Message)"
}

Write-Host "Checking for running Android emulators..."
$androidPathAdded = Add-AndroidSdkToPath
if (-not $androidPathAdded) {
  Write-Warning "ANDROID_HOME or ANDROID_SDK_ROOT not set; emulator shutdown may be skipped if adb is unavailable."
}

try {
  $adbCmd = Get-Command "adb" -ErrorAction SilentlyContinue
  if (-not $adbCmd) {
    Write-Warning "adb not found on PATH; skipping emulator shutdown."
  } else {
    $adbPath = if ($adbCmd.Source) { $adbCmd.Source } else { $adbCmd.Path }
    $emuDevices = & $adbPath devices | Select-String "emulator-"
    if ($emuDevices) {
      Write-Host "Emulator(s) detected, trying to stop..."
      & $adbPath "-s" "emulator-5554" "emu" "kill" 2>$null
      & $adbPath "-s" "emulator-5556" "emu" "kill" 2>$null
      # Don't crash if no device; just attempt a few common IDs and move on
    } else {
      Write-Host "No emulator detected."
    }
  }
} catch {
  Write-Warning "Failed while attempting emulator shutdown: $($_.Exception.Message)"
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

Write-Host "stop-all completed (best effort)."
exit 0
