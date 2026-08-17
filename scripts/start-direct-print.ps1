param(
  [int]$Port = 3010
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$url = "http://127.0.0.1:$Port/"

$browserCandidates = @(
  (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
  (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe"),
  (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
  (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

if ($browserCandidates.Count -eq 0) {
  throw "Microsoft Edge or Google Chrome was not found. Install one of them first."
}

$npm = Get-Command npm.cmd -ErrorAction Stop
$server = Start-Process -FilePath $npm.Source `
  -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "$Port") `
  -WorkingDirectory $projectRoot `
  -PassThru

try {
  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
      Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
      $ready = $true
      break
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  if (-not $ready) {
    throw "The local receipt app did not start in time. Check the dev server window."
  }

  $profileRoot = Join-Path ([IO.Path]::GetTempPath()) "receipt-studio-direct-print-profile"
  $browserArguments = @(
    "--kiosk-printing",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-session-crashed-bubble",
    "--user-data-dir=$profileRoot",
    "--app=$url"
  )

  Start-Process -FilePath $browserCandidates[0] -ArgumentList $browserArguments | Out-Null
  Write-Host "Direct print mode started: $url"
  Write-Host "The Print Receipt button will use the Windows default printer. Set XP-58 as the default printer."
} catch {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  }
  throw
}
