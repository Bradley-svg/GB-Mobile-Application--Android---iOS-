Param(
  [switch]$SkipExpo,
  [switch]$SkipAlerts
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$MetroPort = 8082
$ApiPort = 4000

function Start-Proc {
  param (
    [string]$Path,
    [string[]]$Args,
    [string]$WorkingDir
  )

  Start-Process -NoNewWindow -PassThru -FilePath $Path -ArgumentList $Args -WorkingDirectory $WorkingDir
}

Write-Host "Starting backend API..."
$backend = Start-Proc -Path "npm" -Args @("run", "dev") -WorkingDir "$PSScriptRoot/backend"

$alerts = $null
if (-not $SkipAlerts) {
  Write-Host "Starting alerts worker..."
  $alerts = Start-Proc -Path "npm" -Args @("run", "dev:alerts") -WorkingDir "$PSScriptRoot/backend"
}

$expo = $null
if (-not $SkipExpo) {
  $adb = Get-Command "adb" -ErrorAction SilentlyContinue
  if ($adb) {
    $adbPath = if ($adb.Source) { $adb.Source } else { $adb.Path }
    Write-Host "Setting up adb reverse for Metro ($MetroPort) and API ($ApiPort)..."
    try {
      & $adbPath "reverse" "tcp:$MetroPort" "tcp:$MetroPort" | Out-Null
      & $adbPath "reverse" "tcp:$ApiPort" "tcp:$ApiPort" | Out-Null
    } catch {
      Write-Warning "adb reverse failed (is the emulator running?): $_"
    }
  } else {
    Write-Warning "adb not found; skipping port reverse for Metro/API"
  }

  Write-Host "Starting Expo dev client on localhost:$MetroPort ..."
  $expo =
    Start-Proc -Path "npx" `
      -Args @("expo", "start", "--dev-client", "--localhost", "--clear", "--port", "$MetroPort") `
      -WorkingDir "$PSScriptRoot/mobile"
}

$procIds = @($backend.Id, $alerts?.Id, $expo?.Id) | Where-Object { $_ }
Write-Host "Processes running: $procIds"
Write-Host "Press Ctrl+C to stop; processes will be terminated."

if ($procIds.Count -gt 0) {
  Register-EngineEvent PowerShell.Exiting {
    foreach ($pid in $procIds) {
      try {
        Stop-Process -Id $pid -ErrorAction SilentlyContinue
      } catch {
        # already stopped
      }
    }
  } | Out-Null

  Wait-Process -Id $procIds
}
