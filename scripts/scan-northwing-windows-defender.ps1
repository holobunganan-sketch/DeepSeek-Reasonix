[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+$')]
  [string]$Version,
  [string]$ArtifactDir = "dist",
  [string]$PayloadDir = "desktop/build/bin",
  [string]$ReportPath,
  [switch]$RequireScanner
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "northwing-defender-scan-result.ps1")
$root = Split-Path -Parent $PSScriptRoot
$artifacts = if ([IO.Path]::IsPathRooted($ArtifactDir)) { [IO.Path]::GetFullPath($ArtifactDir) } else { Join-Path $root $ArtifactDir }
$payloads = if ([IO.Path]::IsPathRooted($PayloadDir)) { [IO.Path]::GetFullPath($PayloadDir) } else { Join-Path $root $PayloadDir }
$report = if ([string]::IsNullOrWhiteSpace($ReportPath)) {
  Join-Path $artifacts "Northwing-$Version-defender-scan.json"
} elseif ([IO.Path]::IsPathRooted($ReportPath)) {
  [IO.Path]::GetFullPath($ReportPath)
} else {
  Join-Path $root $ReportPath
}

$targets = @(
  [ordered]@{ name = "Northwing-$Version-windows-x64-setup.exe"; path = (Join-Path $artifacts "Northwing-$Version-windows-x64-setup.exe") },
  [ordered]@{ name = "northwing.exe"; path = (Join-Path $payloads "northwing.exe") },
  [ordered]@{ name = "northwing-update-helper.exe"; path = (Join-Path $payloads "northwing-update-helper.exe") }
)
foreach ($target in $targets) {
  if (-not (Test-Path -LiteralPath $target.path -PathType Leaf)) {
    throw "Defender scan target is missing: $($target.path)"
  }
  $target.sha256 = (Get-FileHash -LiteralPath $target.path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Find-DefenderScanner {
  $command = Get-Command MpCmdRun.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $candidates = [Collections.Generic.List[string]]::new()
  if (-not [string]::IsNullOrWhiteSpace($env:ProgramFiles)) {
    $candidates.Add((Join-Path $env:ProgramFiles "Windows Defender\MpCmdRun.exe"))
  }
  if (-not [string]::IsNullOrWhiteSpace($env:ProgramData)) {
    $platform = Join-Path $env:ProgramData "Microsoft\Windows Defender\Platform"
    if (Test-Path -LiteralPath $platform -PathType Container) {
      Get-ChildItem -LiteralPath $platform -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        ForEach-Object { $candidates.Add((Join-Path $_.FullName "MpCmdRun.exe")) }
    }
  }
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }
  return $null
}

function Write-DefenderReport($Value) {
  $parent = Split-Path -Parent $report
  if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  [IO.File]::WriteAllText($report, ($Value | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))
  Write-Host "Defender report: $report"
}

$scanner = Find-DefenderScanner
$status = $null
$statusError = $null
try {
  $status = Get-MpComputerStatus -ErrorAction Stop
} catch {
  $statusError = $_.Exception.Message
}

$scanRecords = [Collections.Generic.List[object]]::new()
$reportValue = [ordered]@{
  schemaVersion = 1
  product = "Northwing"
  version = $Version
  scannedAt = [DateTime]::UtcNow.ToString("o")
  scannerAvailable = -not [string]::IsNullOrWhiteSpace($scanner)
  scannerPath = $scanner
  scannerFileVersion = if ($scanner) { (Get-Item -LiteralPath $scanner).VersionInfo.FileVersion } else { $null }
  productVersion = if ($status) { $status.AMProductVersion } else { $null }
  engineVersion = if ($status) { $status.AMEngineVersion } else { $null }
  signatureVersion = if ($status) { $status.AntivirusSignatureVersion } else { $null }
  signatureUpdatedAt = if ($status -and $status.AntivirusSignatureLastUpdated) { $status.AntivirusSignatureLastUpdated.ToUniversalTime().ToString("o") } else { $null }
  statusError = $statusError
  scans = $scanRecords
}

if (-not $scanner) {
  foreach ($target in $targets) {
    $scanRecords.Add([ordered]@{ name = $target.name; path = $target.path; sha256 = $target.sha256; result = "not_scanned"; exitCode = $null; output = "Defender CLI unavailable" })
  }
  Write-DefenderReport $reportValue
  if ($RequireScanner) { throw "Microsoft Defender CLI is required for a stable Northwing release" }
  Write-Warning "Microsoft Defender CLI is unavailable; file scans were not executed."
  return
}

$scanFailed = $false
$scanUnavailable = $false
foreach ($target in $targets) {
  $output = & $scanner -Scan -ScanType 3 -File $target.path 2>&1
  $exitCode = $LASTEXITCODE
  $outputText = ($output -join "`n").Trim()
  $result = Get-NorthwingDefenderScanResult -ExitCode $exitCode -Output $outputText
  if ($result -eq "threat_or_scan_error") { $scanFailed = $true }
  if ($result -eq "not_scanned") { $scanUnavailable = $true }
  $scanRecords.Add([ordered]@{
    name = $target.name
    path = $target.path
    sha256 = $target.sha256
    result = $result
    exitCode = $exitCode
    output = $outputText
  })
}
Write-DefenderReport $reportValue

if ($RequireScanner -and ($null -eq $status -or [string]::IsNullOrWhiteSpace([string]$status.AMEngineVersion) -or [string]::IsNullOrWhiteSpace([string]$status.AntivirusSignatureVersion))) {
  throw "Microsoft Defender engine and signature metadata are required for a stable Northwing release"
}
if ($scanFailed) {
  throw "Microsoft Defender reported a threat or scan error for one or more Northwing files; see $report"
}
if ($scanUnavailable) {
  if ($RequireScanner) {
    throw "Microsoft Defender skipped one or more Northwing files; a completed file scan is required for stable release"
  }
  Write-Warning "Microsoft Defender skipped one or more Northwing files; scans are recorded as not_scanned, not clean."
  return
}
Write-Host "Microsoft Defender scans completed cleanly for all three Northwing files."
