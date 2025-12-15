param(
  [Parameter(Mandatory = $true)][string]$Name,
  [Parameter(Mandatory = $true)][string]$Url,
  [ValidateSet('mobile','desktop')][string]$FormFactor = 'mobile',
  [string]$OutDir = 'tmp/lighthouse',
  [string]$ExtraHeaders = 'tmp/lighthouse/extra-headers.test-user.json'
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

$outBase = Join-Path $OutDir $Name
$jsonPath = "$outBase.report.json"
$htmlPath = "$outBase.report.html"

if (Test-Path $jsonPath) { Remove-Item -LiteralPath $jsonPath -Force }
if (Test-Path $htmlPath) { Remove-Item -LiteralPath $htmlPath -Force }

$profileRoot = Join-Path $repoRoot 'tmp/lh-chrome-profiles'
$profileDir = Join-Path $profileRoot $Name
$cacheDir = Join-Path $profileDir 'Cache'

New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

$chromeFlags = "--headless=new --user-data-dir=$profileDir --disk-cache-dir=$cacheDir"

Write-Host "[lh] name=$Name"
Write-Host "[lh] url=$Url"
Write-Host "[lh] formFactor=$FormFactor"
Write-Host "[lh] out=$outBase.report.{json,html}"
Write-Host "[lh] chromeFlags=$chromeFlags"

$cmd = @(
  'lighthouse',
  $Url,
  "--form-factor=$FormFactor",
  '--output=json',
  '--output=html',
  "--output-path=$outBase",
  "--chrome-flags=$chromeFlags"
)

if ($ExtraHeaders -and (Test-Path $ExtraHeaders)) {
  $cmd += "--extra-headers=$ExtraHeaders"
}

# Run and capture output. Lighthouse sometimes exits nonzero on Windows due to EBUSY temp cleanup,
# even after successfully writing the report files.
$out = & npx @cmd 2>&1
$exitCode = $LASTEXITCODE

# Best-effort cleanup of lighthouse temp dirs mentioned in output.
$matches = [regex]::Matches(($out -join "`n"), '([A-Za-z]:\\[^\r\n]*\\Temp\\lighthouse\.[0-9]+)')
foreach ($m in $matches) {
  $tmpDir = $m.Groups[1].Value
  for ($i = 0; $i -lt 8; $i++) {
    try {
      if (Test-Path $tmpDir) {
        Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction Stop
      }
      break
    } catch {
      Start-Sleep -Milliseconds 200
    }
  }
}

# Treat EBUSY cleanup errors as warnings if reports exist.
$combined = ($out -join "`n")
$hasReports = (Test-Path $jsonPath) -and (Test-Path $htmlPath)
$looksLikeEBUSY = $combined -match 'EBUSY: resource busy or locked'

if ($exitCode -ne 0 -and $hasReports -and $looksLikeEBUSY) {
  Write-Warning "Lighthouse exited with EBUSY during cleanup, but reports were written. Treating as success."
  exit 0
}

if ($exitCode -ne 0) {
  Write-Host ($out -join "`n")
  exit $exitCode
}

Write-Host "[lh] OK: $jsonPath"
Write-Host "[lh] OK: $htmlPath"
exit 0
