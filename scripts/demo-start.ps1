Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "=== GREENBRO demo:start ==="
Write-Host "This will stop existing dev processes, run dev:all, then start the web dev server on port 3000 in a new window."

$repoRoot = Resolve-Path -Path (Join-Path $PSScriptRoot "..")
$stopAllPath = Join-Path $repoRoot "scripts/stop-all.ps1"
$devAllCmd = "npm.cmd run dev:all"

try {
  if (Test-Path $stopAllPath) {
    Write-Host "Running stop:all..."
    & $stopAllPath
  } else {
    Write-Warning "stop-all.ps1 not found at $stopAllPath; skipping stop step."
  }
} catch {
  Write-Warning "stop:all reported an error: $($_.Exception.Message)"
}

try {
  Push-Location $repoRoot
  Write-Host "Running dev:all..."
  Invoke-Expression $devAllCmd
  if ($LASTEXITCODE -ne 0) {
    throw "dev:all exited with code $LASTEXITCODE"
  }
} catch {
  Write-Error "dev:all failed: $($_.Exception.Message)"
  Pop-Location | Out-Null
  exit 1
} finally {
  Pop-Location | Out-Null
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

exit 0
