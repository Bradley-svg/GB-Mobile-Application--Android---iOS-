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

function Get-PortProcesses {
  param(
    [int]$Port
  )

  $processes = @()

  if (Get-Command -Name "Get-NetTCPConnection" -ErrorAction SilentlyContinue) {
    try {
      $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
      $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
      foreach ($pid in $pids) {
        try {
          $processes += Get-Process -Id $pid -ErrorAction Stop
        } catch {
          Write-Host "Could not resolve process $pid for port $Port: $_" -ForegroundColor Yellow
        }
      }
    } catch {
      Write-Host "Could not query port $Port via Get-NetTCPConnection: $_" -ForegroundColor Yellow
    }
  }

  if (-not $processes) {
    try {
      $netstat = netstat -ano -p tcp | Select-String -Pattern "LISTENING" | Where-Object { $_.Line -match ":$Port\s" }
      $pids = $netstat | ForEach-Object {
        if ($_.Line -match "LISTENING\s+(\d+)$") { [int]$Matches[1] }
      }
      $uniquePids = $pids | Sort-Object -Unique
      foreach ($pid in $uniquePids) {
        try {
          $processes += Get-Process -Id $pid -ErrorAction Stop
        } catch {
          Write-Host "Could not resolve process $pid for port $Port from netstat: $_" -ForegroundColor Yellow
        }
      }
    } catch {
      Write-Host "Fallback netstat lookup for port $Port failed: $_" -ForegroundColor Yellow
    }
  }

  return $processes | Sort-Object -Property Id -Unique
}

function Assert-PortAvailable {
  param(
    [int]$Port,
    [string[]]$AllowedProcessNames
  )

  $listeners = Get-PortProcesses -Port $Port
  if (-not $listeners -or $listeners.Count -eq 0) {
    Write-Host "Port $Port is free."
    return
  }

  $processSummary = $listeners | ForEach-Object { "$($_.ProcessName) (PID $($_.Id))" } | Sort-Object
  Write-Host "Port $Port is already in use by: $($processSummary -join ', ')"

  $allowedSet = $AllowedProcessNames | ForEach-Object { $_.ToLowerInvariant() }
  $blocking = $listeners | Where-Object { $allowedSet -notcontains $_.ProcessName.ToLowerInvariant() }

  if ($blocking.Count -gt 0) {
    Write-Host "ERROR: Port $Port appears to be owned by a non-Node/Expo process. Stop it or free the port before rerunning dev-all." -ForegroundColor Red
    exit 1
  }

  Write-Host "Continuing; will recycle Node/Expo processes on port $Port."
}

function Get-AdbDeviceSets {
  param(
    [string[]]$DeviceLines
  )

  $attachedDevices = @()
  foreach ($line in $DeviceLines) {
    if ($line -match "^(?<id>\S+)\s+(?<state>\S+)$") {
      $attachedDevices += [PSCustomObject]@{
        Id    = $Matches['id']
        State = $Matches['state']
      }
    }
  }

  $readyDevices = $attachedDevices | Where-Object { $_.State -eq "device" }
  [PSCustomObject]@{
    Ready    = $readyDevices
    Emulator = $readyDevices | Where-Object { $_.Id -like "emulator-*" }
    Physical = $readyDevices | Where-Object { $_.Id -notlike "emulator-*" }
  }
}

if (-not (Test-Path $backendPath)) {
  Write-Host "ERROR: backend directory not found at $backendPath" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $mobilePath)) {
  Write-Host "ERROR: mobile directory not found at $mobilePath" -ForegroundColor Red
  exit 1
}

$allowedDevProcesses = @("node", "node.exe", "expo", "metro")
Assert-PortAvailable -Port $apiPort -AllowedProcessNames $allowedDevProcesses
Assert-PortAvailable -Port $metroPort -AllowedProcessNames $allowedDevProcesses

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

$pgServiceSource = if ($Env:GREENBRO_PG_SERVICE) { "GREENBRO_PG_SERVICE" } else { "default" }
Write-Host "Ensuring Postgres service is running (service: $pgServiceName from $pgServiceSource)..."
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
  if ($Env:GREENBRO_PG_SERVICE) {
    Write-Warning "Postgres service $pgServiceName (GREENBRO_PG_SERVICE) not found. Update GREENBRO_PG_SERVICE or start Postgres manually."
  } else {
    Write-Warning "Postgres service $pgServiceName not found. Set GREENBRO_PG_SERVICE to your service name if it differs from the default."
  }
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
$adbDevicesOutput = & $adbPath devices
$deviceLines = $adbDevicesOutput | Select-Object -Skip 1 | Where-Object { $_ -match "\S" }
$deviceSets = Get-AdbDeviceSets -DeviceLines $deviceLines
$emulatorDevices = @($deviceSets.Emulator | Where-Object { $_ })
$physicalDevices = @($deviceSets.Physical | Where-Object { $_ })
$targetDeviceId = $null

if ($physicalDevices.Count -gt 0) {
  $physicalList = $physicalDevices | ForEach-Object { $_.Id } | Sort-Object
  Write-Host "Detected attached Android device(s): $($physicalList -join ', '). Using connected device; emulator start skipped."
  $targetDeviceId = $physicalDevices[0].Id
} elseif ($emulatorDevices.Count -gt 0) {
  $emulatorList = $emulatorDevices | ForEach-Object { $_.Id } | Sort-Object
  Write-Host "Reusing running emulator(s): $($emulatorList -join ', ')."
  $targetDeviceId = $emulatorDevices[0].Id
} else {
  Write-Host "No ready device/emulator detected; trying to start $avdName..."
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
      Write-Host "Waiting for emulator to report ready..."
      & $adbPath "wait-for-device"
      Start-Sleep -Seconds 5

      $adbDevicesOutput = & $adbPath devices
      $deviceLines = $adbDevicesOutput | Select-Object -Skip 1 | Where-Object { $_ -match "\S" }
      $deviceSets = Get-AdbDeviceSets -DeviceLines $deviceLines
      $emulatorDevices = @($deviceSets.Emulator | Where-Object { $_ })
      if ($emulatorDevices.Count -gt 0) {
        $targetDeviceId = $emulatorDevices[0].Id
        Write-Host "Emulator reported ready as $targetDeviceId."
      } else {
        Write-Warning "Emulator start requested but adb did not report a ready device."
      }
    } else {
      Write-Warning "Emulator binary not found under ANDROID_HOME/ANDROID_SDK_ROOT; skipping emulator start."
    }
  }
}

$adbArgs = @()
if ($targetDeviceId) {
  $adbArgs = @("-s", $targetDeviceId)
} else {
  Write-Warning "No Android device/emulator available for adb reverse; connect one and run adb reverse manually."
  return
}

try {
  & $adbPath @adbArgs "reverse" "tcp:$apiPort" "tcp:$apiPort" | Out-Null
  Write-Host "adb reverse set for API on $apiPort."
} catch {
  Write-Warning "adb reverse for API failed: $_"
}

try {
  & $adbPath @adbArgs "reverse" "tcp:$metroPort" "tcp:$metroPort" | Out-Null
  Write-Host "adb reverse set for Metro on $metroPort."
} catch {
  Write-Warning "adb reverse for Metro failed: $_"
}

try {
  & $adbPath @adbArgs "shell" "am" "start" "-n" $androidPackage | Out-Null
  Write-Host "Launched dev client ($androidPackage)."
} catch {
  Write-Warning "Could not launch dev client: $_"
}
