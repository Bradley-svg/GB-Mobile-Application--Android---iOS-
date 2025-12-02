Param(
  [switch]$SkipExpo,
  [switch]$SkipAlerts
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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
  Write-Host "Starting Expo (localhost)..."
  $expo = Start-Proc -Path "npx" -Args @("expo", "start", "--localhost", "--clear") -WorkingDir "$PSScriptRoot/mobile"
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
