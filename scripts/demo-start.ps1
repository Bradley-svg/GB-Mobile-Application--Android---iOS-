Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "=== GREENBRO demo:start ==="
Write-Host "Stopping old processes -> dev:all -> web:dev -> readiness checks"

$repoRoot = Resolve-Path -Path (Join-Path $PSScriptRoot "..")
$logsDir = Join-Path $repoRoot "logs"
$readyJsonPath = Join-Path $logsDir "demo-ready-check.json"
$readyCheckScript = Join-Path $repoRoot "scripts/demo-ready-check.js"
$captureLogsScript = Join-Path $repoRoot "scripts/capture-logs.ps1"

if (-not (Test-Path $logsDir)) {
  try {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
  } catch {
    Write-Warning "Could not create logs directory at ${logsDir}: $($_.Exception.Message)"
  }
}

function Invoke-NpmScript {
  param(
    [Parameter(Mandatory = $true)][string]$ScriptName,
    [switch]$AllowFailure
  )

  Push-Location $repoRoot
  try {
    Write-Host "Running npm run $ScriptName ..."
    & npm.cmd "run" $ScriptName
    if (-not $AllowFailure -and $LASTEXITCODE -ne 0) {
      throw "npm run $ScriptName exited with code $LASTEXITCODE"
    }
  } finally {
    Pop-Location | Out-Null
  }
}

function Run-ReadyCheck {
  Push-Location $repoRoot
  try {
    $nodeArgs = @("scripts/demo-ready-check.js", "--json", $readyJsonPath)
    Write-Host "Running readiness checks (node scripts/demo-ready-check.js)..."
    & node @nodeArgs
    return $LASTEXITCODE
  } finally {
    Pop-Location | Out-Null
  }
}

function Collect-Logs {
  if (-not (Test-Path $captureLogsScript)) {
    Write-Host "capture-logs.ps1 not found at $captureLogsScript; skipping log capture."
    return
  }

  try {
    Write-Host "`nCollecting logs to $logsDir ..."
    & $captureLogsScript
  } catch {
    Write-Warning "Log capture failed: $($_.Exception.Message)"
  }
}

function Show-FailureDetails {
  param([int]$ReadyExitCode)

  if (Test-Path $readyJsonPath) {
    try {
      $readyPayload = Get-Content $readyJsonPath -Raw | ConvertFrom-Json
      $failedChecks = @($readyPayload.checks | Where-Object { $_.status -eq "FAIL" })
      if ($failedChecks.Count -gt 0) {
        Write-Host "`nFailing checks:"
        foreach ($check in $failedChecks) {
          Write-Host "- $($check.name): $($check.detail)"
          Write-Host "  Rerun: node scripts/demo-ready-check.js --check $($check.name)"
        }
      }
    } catch {
      Write-Warning "Could not read readiness output at ${readyJsonPath}: $($_.Exception.Message)"
    }
  } else {
    Write-Host "Readiness output not found at $readyJsonPath"
  }

  Collect-Logs
  if ($ReadyExitCode -ne 0) {
    exit 1
  }
}

Invoke-NpmScript -ScriptName "stop:all" -AllowFailure

try {
Write-Host "Starting dev:all (backend + migrate/seed + mobile/Metro + emulator wiring)..."
  Invoke-NpmScript -ScriptName "dev:all"
} catch {
  Write-Error "dev:all failed: $($_.Exception.Message)"
  Collect-Logs
  exit 1
}

$webScript = @"
Set-Location "$repoRoot"
npm.cmd run web:dev
"@

try {
  Write-Host "Starting web:dev (Next.js) in a new PowerShell window..."
  Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $webScript | Out-Null
  Write-Host "Web dev server launch requested (http://localhost:3000)."
} catch {
  Write-Warning "Could not launch web:dev in a new window: $($_.Exception.Message)"
}

$readyExit = Run-ReadyCheck
if ($readyExit -eq 0) {
  Write-Host "`n=== DEMO READY ==="
  Write-Host "Web: http://localhost:3000/embed"
  Write-Host "Backend: http://localhost:4000/health-plus"
  Write-Host "Demo creds: demo@greenbro.com / password"
  Write-Host "Mobile: emulator Pixel_7_API_34 (login same creds)"
  Write-Host "Click path: Open /embed -> login as demo -> Fleet -> Hero device"

  try {
    Start-Process "http://localhost:3000/embed" | Out-Null
  } catch {
    Write-Warning "Could not open browser automatically: $($_.Exception.Message)"
  }

  exit 0
} else {
  Write-Error "Readiness checks failed. See above for details."
  Show-FailureDetails -ReadyExitCode $readyExit
  exit 1
}
