Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "=== GREENBRO dev:all orchestrator ==="
Write-Host "This will: kill old processes, start backend, start mobile, wire adb, and launch the emulator."

$apiPort = 4000
$metroPort = 8081
$legacyMetroPort = 8082
$avdName = "Pixel_7_API_34"
$androidPackage = "com.greenbro.mobile/.MainActivity"
$pgServiceName = if ($Env:GREENBRO_PG_SERVICE) { $Env:GREENBRO_PG_SERVICE } else { "postgresql-x64-16" }

$repoRoot = Resolve-Path -Path (Join-Path $PSScriptRoot "..")
$backendPath = Join-Path $repoRoot "backend"
$mobilePath = Join-Path $repoRoot "mobile"
$composeFile = Join-Path $repoRoot "docker-compose.dev.yml"

if (-not (Test-Path $backendPath)) {
  Write-Host "ERROR: backend directory not found at $backendPath" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $mobilePath)) {
  Write-Host "ERROR: mobile directory not found at $mobilePath" -ForegroundColor Red
  exit 1
}

Write-Host "Killing old Node/Expo/Metro processes on ports $apiPort, $metroPort, $legacyMetroPort..."
try {
  npx kill-port $apiPort $metroPort $legacyMetroPort | Out-Null
} catch {
  Write-Host "kill-port not available or failed; continuing..."
}

$processes = @()
foreach ($name in @("node", "expo", "metro")) {
  $found = Get-Process -Name $name -ErrorAction SilentlyContinue
  if ($found) {
    $processes += $found
  }
}

if ($processes.Count -gt 0) {
  Write-Host "Stopping existing node/expo/metro processes..."
  $processes | Stop-Process -Force -ErrorAction SilentlyContinue
} else {
  Write-Host "No node/expo/metro processes to kill."
}

Write-Host "Ensuring Postgres service is running (service: $pgServiceName)..."
$pgStarted = $false
$pgService = Get-Service -Name $pgServiceName -ErrorAction SilentlyContinue
if ($pgService) {
  if ($pgService.Status -ne 'Running') {
    try {
      Write-Host "Starting Postgres service $pgServiceName..."
      Start-Service -Name $pgServiceName
      Write-Host "Postgres service $pgServiceName started."
      $pgStarted = $true
    } catch {
      Write-Warning "Failed to start Postgres service $pgServiceName: $_"
    }
  } else {
    Write-Host "Postgres service $pgServiceName already running."
    $pgStarted = $true
  }
} else {
  Write-Host "Postgres service $pgServiceName not found."
}

if (-not $pgStarted -and (Test-Path $composeFile)) {
  $dockerCmd = Get-Command "docker" -ErrorAction SilentlyContinue
  if ($dockerCmd) {
    try {
      Write-Host "Attempting docker compose fallback (postgres service)..."
      docker compose -f $composeFile up -d postgres | Out-Null
      Write-Host "docker compose up -d postgres invoked."
      $pgStarted = $true
    } catch {
      Write-Warning "docker compose start for Postgres failed: $_"
    }
  } else {
    Write-Warning "docker not available; skipping docker compose Postgres start."
  }
} elseif (-not $pgStarted) {
  Write-Host "docker-compose.dev.yml not found at $composeFile; skipping docker compose fallback."
}

if (-not $pgStarted) {
  Write-Warning "Postgres was not started by this script; ensure your database is running before proceeding."
}

Write-Host "Starting backend (install + migrate + seed + dev)..."
$backendScript = @"
Set-Location "$backendPath"
npm install
npm run migrate:dev
if (Test-Path "package.json") {
  try {
    $pkg = Get-Content package.json -Raw | ConvertFrom-Json
    if ($pkg.scripts.'seed:e2e') {
      Write-Host "Running seed:e2e..."
      try {
        npm run seed:e2e
      } catch {
        Write-Host "seed:e2e failed: $_" -ForegroundColor Yellow
      }
    } else {
      Write-Host "No seed:e2e script found; skipping seeding." -ForegroundColor Yellow
    }
  } catch {
    Write-Host "Could not read package.json to check for seed:e2e; skipping seeding. $_" -ForegroundColor Yellow
  }
} else {
  Write-Host "No package.json found; skipping seeding." -ForegroundColor Yellow
}
npm run dev
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript

Write-Host "Starting mobile Metro / Expo dev client on port $metroPort..."
$mobileScript = @"
Set-Location "$mobilePath"
npm install
npx expo start --dev-client --localhost --port $metroPort --clear
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $mobileScript

Start-Sleep -Seconds 15

Write-Host "Setting up ADB reverse (ports $apiPort, $metroPort) and launching emulator/app..."
$adbCmd = Get-Command "adb" -ErrorAction SilentlyContinue
if (-not $adbCmd) {
  Write-Host "WARNING: adb not found on PATH. Skipping emulator wiring." -ForegroundColor Yellow
  return
}

$adbPath = if ($adbCmd.Source) { $adbCmd.Source } else { $adbCmd.Path }
& $adbPath devices

$emulators = & $adbPath devices | Select-String "emulator-"
if (-not $emulators) {
  Write-Host "No emulator detected; trying to start $avdName..."
  if (-not $Env:ANDROID_HOME -and -not $Env:ANDROID_SDK_ROOT) {
    Write-Warning "ANDROID_HOME or ANDROID_SDK_ROOT not set; skipping emulator start."
  } else {
    $emulatorExe = $null
    if ($Env:ANDROID_HOME) {
      $candidate = Join-Path $Env:ANDROID_HOME "emulator\emulator.exe"
      if (Test-Path $candidate) {
        $emulatorExe = $candidate
      }
    }
    if (-not $emulatorExe -and $Env:ANDROID_SDK_ROOT) {
      $candidate = Join-Path $Env:ANDROID_SDK_ROOT "emulator\emulator.exe"
      if (Test-Path $candidate) {
        $emulatorExe = $candidate
      }
    }

    if ($emulatorExe) {
      Start-Process -FilePath $emulatorExe -ArgumentList "-avd", $avdName, "-netdelay", "none", "-netspeed", "full" | Out-Null
      Start-Sleep -Seconds 20
    } else {
      Write-Warning "Emulator binary not found under ANDROID_HOME/ANDROID_SDK_ROOT; skipping emulator start."
    }
  }
} else {
  Write-Host "Emulator already running."
}

try {
  & $adbPath "reverse" "tcp:$apiPort" "tcp:$apiPort" | Out-Null
  Write-Host "adb reverse set for API on $apiPort."
} catch {
  Write-Warning "adb reverse for API failed: $_"
}

try {
  & $adbPath "reverse" "tcp:$metroPort" "tcp:$metroPort" | Out-Null
  Write-Host "adb reverse set for Metro on $metroPort."
} catch {
  Write-Warning "adb reverse for Metro failed: $_"
}

try {
  & $adbPath "shell" "am" "start" "-n" $androidPackage | Out-Null
  Write-Host "Launched dev client ($androidPackage)."
} catch {
  Write-Warning "Could not launch dev client: $_"
}
