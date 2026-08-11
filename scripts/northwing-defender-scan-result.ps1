function Get-NorthwingDefenderScanResult {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [int]$ExitCode,
    [AllowEmptyString()]
    [string]$Output = ""
  )

  if ($ExitCode -ne 0) {
    return "threat_or_scan_error"
  }
  # MpCmdRun can return 0 even when it did not scan the requested file. Such
  # output is unavailable evidence, never a clean result.
  if ($Output -match '(?im)\bwas\s+skipped\b|\bscan(?:ning)?\b.*\bskipped\b') {
    return "not_scanned"
  }
  return "clean"
}
