Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path -Path (Join-Path $PSScriptRoot "..")
$logsDir = Join-Path $repoRoot "logs"

if (-not (Test-Path $logsDir)) {
  try {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
  } catch {
    Write-Warning "Could not create logs directory at $logsDir: $($_.Exception.Message)"
  }
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logFiles = @(
  "backend-dev.out.log",
  "backend-dev.err.log",
  "mobile-expo.out.log",
  "mobile-expo.err.log",
  "web-dev.out.log",
  "web-dev.err.log"
)

foreach ($file in $logFiles) {
  $source = Join-Path $repoRoot $file
  if (-not (Test-Path $source)) {
    Write-Host "No $file found; skipping."
    continue
  }

  $dest = Join-Path $logsDir ("{0}-{1}" -f $file, $timestamp)
  try {
    Copy-Item -Path $source -Destination $dest -Force
    Write-Host "Captured $file -> $dest"
  } catch {
    Write-Warning "Failed to capture $file: $($_.Exception.Message)"
  }
}

try {
  $adbCmd = Get-Command "adb" -ErrorAction SilentlyContinue
  if (-not $adbCmd) {
    Write-Host "adb not found on PATH; skipping logcat capture."
  } else {
    $adbPath = if ($adbCmd.Source) { $adbCmd.Source } else { $adbCmd.Path }
    $logcatDest = Join-Path $logsDir ("adb-logcat-{0}.log" -f $timestamp)
    $filterPattern = "com\.greenbro\.mobile|ReactNative|OkHttp"

    try {
      $logcatOutput = & $adbPath "logcat" "-d" "-t" "300"
      if ($logcatOutput) {
        $filtered = $logcatOutput | Select-String -Pattern $filterPattern
        $contentToWrite = if ($filtered) { $filtered } else { $logcatOutput }
        $contentToWrite | Out-File -FilePath $logcatDest -Encoding utf8
        Write-Host "Captured adb logcat -> $logcatDest"
      } else {
        Write-Host "adb logcat returned no data; skipping write."
      }
    } catch {
      Write-Warning "adb logcat capture failed: $($_.Exception.Message)"
    }
  }
} catch {
  Write-Warning "Unexpected adb handling error: $($_.Exception.Message)"
}
