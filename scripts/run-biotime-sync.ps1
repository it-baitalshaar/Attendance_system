# Runs the Bait Al Shaar BioTime -> Supabase sync. Loads .env.local, logs to scripts\biotime-sync.log
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$log  = Join-Path $PSScriptRoot 'biotime-sync.log'
Set-Location $root
$envFile = Join-Path $root '.env.local'
if (-not (Test-Path $envFile)) { "$(Get-Date -Format s) ERROR .env.local missing" | Add-Content $log; exit 2 }
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    $v = $matches[2].Trim().Trim('"').Trim("'")
    if ($v) { [Environment]::SetEnvironmentVariable($matches[1], $v, 'Process') }
  }
}
if (-not $env:BIOTIME_BASE_URL) { "$(Get-Date -Format s) ERROR BIOTIME_BASE_URL is empty in .env.local" | Add-Content $log; exit 3 }
"$(Get-Date -Format s) --- sync start" | Add-Content $log
$ErrorActionPreference = 'Continue'
$out = & node scripts/office-biotime-sync.js 2>&1 | ForEach-Object { "$_" }
$code = $LASTEXITCODE
$out | Add-Content $log
"$(Get-Date -Format s) --- sync end exit=$code" | Add-Content $log
$out | Write-Output
exit $code
