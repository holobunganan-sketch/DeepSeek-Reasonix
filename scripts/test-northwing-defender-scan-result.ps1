$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "northwing-defender-scan-result.ps1")

function Assert-ScanResult([string]$Name, [int]$ExitCode, [string]$Output, [string]$Expected) {
  $actual = Get-NorthwingDefenderScanResult -ExitCode $ExitCode -Output $Output
  if ($actual -ne $Expected) {
    throw "$Name classified as '$actual'; expected '$Expected'"
  }
  Write-Host "PASS: $Name -> $actual"
}

Assert-ScanResult -Name "completed scan" -ExitCode 0 -Output "Scan starting...`nScan finished." -Expected "clean"
Assert-ScanResult -Name "exit-zero skipped scan" -ExitCode 0 -Output "Scanning C:\artifact.exe was skipped." -Expected "not_scanned"
Assert-ScanResult -Name "threat or scanner error" -ExitCode 2 -Output "Threat detected." -Expected "threat_or_scan_error"

Write-Host "Northwing Defender scan-result classification tests passed."
