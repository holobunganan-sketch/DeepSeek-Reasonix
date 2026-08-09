param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$')]
  [string]$Version,
  [string]$OutputDir = "dist",
  [string]$Repository,
  [switch]$AllowUnsignedTestArtifact
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root $OutputDir
$installer = Join-Path $out "Northwing-$Version-windows-x64-setup.exe"
$portableZip = Join-Path $out "Northwing-$Version-windows-x64-portable.zip"
$checksumPath = Join-Path $out "Northwing-$Version-SHA256SUMS.txt"
$manifestPath = Join-Path $out "northwing-update.json"
$manifestSignaturePath = Join-Path $out "northwing-update.json.sig"
$expectedArtifacts = @(
  [IO.Path]::GetFileName($installer),
  [IO.Path]::GetFileName($portableZip)
)

foreach ($path in @($installer, $portableZip, $checksumPath)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Required Northwing artifact is missing: $path"
  }
}

$checksumEntries = @{}
foreach ($line in Get-Content -LiteralPath $checksumPath) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  if ($line -notmatch '^(?<hash>[0-9a-fA-F]{64})  (?<name>[^\\/]+)$') {
    throw "Invalid checksum line: $line"
  }
  if ($checksumEntries.ContainsKey($Matches.name)) {
    throw "Duplicate checksum entry: $($Matches.name)"
  }
  $checksumEntries[$Matches.name] = $Matches.hash.ToLowerInvariant()
}
if ($checksumEntries.Count -ne $expectedArtifacts.Count) {
  throw "Checksum file contains $($checksumEntries.Count) entries; expected $($expectedArtifacts.Count)"
}
foreach ($name in $expectedArtifacts) {
  if (-not $checksumEntries.ContainsKey($name)) {
    throw "Checksum file is missing $name"
  }
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $out $name)).Hash.ToLowerInvariant()
  if ($actual -ne $checksumEntries[$name]) {
    throw "SHA-256 mismatch for $name"
  }
}

function Assert-NorthwingVersion([string]$ExePath) {
  $stdout = Join-Path $scratch "cli-$([guid]::NewGuid().ToString('N')).out"
  $stderr = Join-Path $scratch "cli-$([guid]::NewGuid().ToString('N')).err"
  $process = Start-Process -FilePath $ExePath -ArgumentList "version" -PassThru `
    -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  try {
    if (-not $process.WaitForExit(15000)) {
      Stop-Process -Id $process.Id -Force
      throw "$ExePath version did not exit; the CLI path may have started the GUI"
    }
    $process.WaitForExit()
    $output = @((Get-Content -LiteralPath $stdout -ErrorAction SilentlyContinue), (Get-Content -LiteralPath $stderr -ErrorAction SilentlyContinue))
    if ($process.ExitCode -ne 0) {
      throw "$ExePath version exited $($process.ExitCode)`n$($output -join "`n")"
    }
  } finally {
    Remove-Item -LiteralPath $stdout, $stderr -Force -ErrorAction SilentlyContinue
  }
  $text = $output -join "`n"
  $expected = [regex]::Escape("northwing $Version")
  if ($text -notmatch $expected) {
    throw "Unexpected Northwing CLI output from $ExePath`: $text"
  }
}

function Assert-GuiStarts([string]$ExePath) {
  $process = Start-Process -FilePath $ExePath -PassThru
  try {
    Start-Sleep -Seconds 5
    if ($process.HasExited) {
      throw "Northwing GUI exited during startup with code $($process.ExitCode): $ExePath"
    }
  } finally {
    if (-not $process.HasExited) {
      Stop-Process -Id $process.Id -Force
      $process.WaitForExit()
    }
  }
}

function Assert-NorthwingAuthenticodeFile([string]$Path, [string]$SignTool) {
  $signature = Get-AuthenticodeSignature -LiteralPath $Path
  if ($signature.Status -ne "Valid") { throw "Formal Northwing verification requires a valid Authenticode signature: $Path" }
  if ($null -eq $signature.SignerCertificate) { throw "Formal Northwing verification requires a signer certificate: $Path" }
  $codeSigning = @($signature.SignerCertificate.EnhancedKeyUsageList | Where-Object { $_.ObjectId.Value -eq '1.3.6.1.5.5.7.3.3' })
  if ($codeSigning.Count -eq 0) { throw "Formal Northwing verification requires a Code Signing signer certificate: $Path" }
  if ($null -eq $signature.TimeStamperCertificate) { throw "Formal Northwing verification requires an RFC3161 timestamp: $Path" }
  & $SignTool verify /pa /all $Path
  if ($LASTEXITCODE -ne 0) { throw "signtool verify failed: $Path" }
}

$signtool = $null
if ($AllowUnsignedTestArtifact) {
  Write-Warning "UNSIGNED-TEST-ONLY: Authenticode, timestamp, and manifest signature validation are intentionally skipped."
} else {
  if ([string]::IsNullOrWhiteSpace($Repository)) { throw 'Repository is required for formal Northwing verification' }
  foreach ($path in @($manifestPath, $manifestSignaturePath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required signed update artifact is missing: $path" }
  }
  $signtool = & (Join-Path $PSScriptRoot 'sign-northwing-release.ps1') -ResolveSignTool
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($signtool)) { throw 'signtool.exe is required for formal Northwing verification' }
  Assert-NorthwingAuthenticodeFile $installer $signtool
  & (Join-Path $PSScriptRoot 'verify-northwing-release-signatures.ps1') -Version $Version -ArtifactDir $out -Repository $Repository
  if ($LASTEXITCODE -ne 0) { throw 'independent Northwing manifest verification failed' }
}

function Wait-NorthwingRestart([string]$ExePath) {
  $deadline = [DateTime]::UtcNow.AddSeconds(15)
  do {
    $process = @(Get-Process -Name "northwing" -ErrorAction SilentlyContinue | Where-Object {
      $_.Path -eq $ExePath
    } | Select-Object -First 1)
    if ($process.Count -eq 1) {
      return $process[0]
    }
    Start-Sleep -Milliseconds 250
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "Northwing helper did not restart $ExePath"
}

$scratch = Join-Path ([IO.Path]::GetTempPath()) "northwing-acceptance-$([guid]::NewGuid().ToString('N'))"
$portableDir = Join-Path $scratch "portable"
$installDir = Join-Path $scratch "installed"
$runtimeHome = Join-Path $scratch "runtime-home"
$runtimeState = Join-Path $scratch "runtime-state"
$runtimeCache = Join-Path $scratch "runtime-cache"
$uninstallKey = "Registry::HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Uninstall\io.github.holobunganansketch.northwing"
$protocolKey = "Registry::HKEY_CURRENT_USER\Software\Classes\northwing"
$runtimeEnvironment = @{
  REASONIX_HOME = $runtimeHome
  REASONIX_STATE_HOME = $runtimeState
  REASONIX_CACHE_HOME = $runtimeCache
}
$previousRuntimeEnvironment = @{}

New-Item -ItemType Directory -Force -Path $portableDir, $runtimeHome, $runtimeState, $runtimeCache | Out-Null
@"
[desktop]
# This isolated verifier profile makes CloseMainWindow simulate a user who
# explicitly chose Quit. Production update handoff starts the helper and then
# calls the app's own Quit path; it does not depend on this profile.
close_behavior = "quit"
telemetry = false
metrics = false
check_updates = false
"@ | Set-Content -LiteralPath (Join-Path $runtimeHome "config.toml") -Encoding utf8
foreach ($name in $runtimeEnvironment.Keys) {
  $previousRuntimeEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
  [Environment]::SetEnvironmentVariable($name, $runtimeEnvironment[$name], "Process")
}
try {
  Expand-Archive -LiteralPath $portableZip -DestinationPath $portableDir
  $portableFiles = @(Get-ChildItem -LiteralPath $portableDir -File -Recurse | ForEach-Object {
    [IO.Path]::GetRelativePath($portableDir, $_.FullName).Replace('\', '/')
  } | Sort-Object)
  $allowedPortableFiles = @("LICENSE", "THIRD_PARTY_NOTICES.md", "northwing-update-helper.exe", "northwing.exe") | Sort-Object
  if (($portableFiles -join "`n") -ne ($allowedPortableFiles -join "`n")) {
    throw "Portable archive has unexpected contents:`n$($portableFiles -join "`n")"
  }
  $portableExe = Join-Path $portableDir "northwing.exe"
  $portableHelper = Join-Path $portableDir "northwing-update-helper.exe"
  if (-not (Test-Path -LiteralPath $portableHelper -PathType Leaf)) {
    throw "Portable Northwing update helper is missing: $portableHelper"
  }
  if (-not $AllowUnsignedTestArtifact) {
    Assert-NorthwingAuthenticodeFile $portableExe $signtool
    Assert-NorthwingAuthenticodeFile $portableHelper $signtool
  }
  Assert-NorthwingVersion $portableExe
  Assert-GuiStarts $portableExe

  $installProcess = Start-Process -FilePath $installer -ArgumentList @("/S", "/D=$installDir") -PassThru -Wait
  if ($installProcess.ExitCode -ne 0) {
    throw "Northwing installer exited $($installProcess.ExitCode)"
  }
  $installedExe = Join-Path $installDir "northwing.exe"
  if (-not (Test-Path -LiteralPath $installedExe -PathType Leaf)) {
    throw "Installed Northwing executable is missing: $installedExe"
  }
  $installedHelper = Join-Path $installDir "northwing-update-helper.exe"
  if (-not (Test-Path -LiteralPath $installedHelper -PathType Leaf)) {
    throw "Installed Northwing update helper is missing: $installedHelper"
  }
  Assert-NorthwingVersion $installedExe
  Assert-GuiStarts $installedExe

  # A silent installer cannot own application shutdown. With Northwing still
  # running it must fail promptly without touching either installed payload.
  $runningNorthwing = Start-Process -FilePath $installedExe -PassThru
  $helperUpdate = $null
  try {
    Start-Sleep -Seconds 5
    if ($runningNorthwing.HasExited) {
      throw "Installed Northwing exited before live-app preservation testing with code $($runningNorthwing.ExitCode)"
    }
    $beforeExe = (Get-FileHash -Algorithm SHA256 -LiteralPath $installedExe).Hash
    $beforeHelper = (Get-FileHash -Algorithm SHA256 -LiteralPath $installedHelper).Hash
    $overwrite = Start-Process -FilePath $installer -ArgumentList @("/S", "/NORTHWING_UPDATE=1", "/D=$installDir") -PassThru
    if (-not $overwrite.WaitForExit(15000)) {
      Stop-Process -Id $overwrite.Id -Force
      throw "Northwing live-app installer did not reject the silent overwrite within 15 seconds"
    }
    $overwrite.WaitForExit()
    if ($overwrite.ExitCode -eq 0) {
      throw "Northwing live-app installer unexpectedly accepted the silent overwrite"
    }
    if ($runningNorthwing.HasExited) {
      throw "Northwing live-app installer terminated the running application with code $($runningNorthwing.ExitCode)"
    }
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $installedExe).Hash -ne $beforeExe) {
      throw "Northwing live-app installer modified northwing.exe"
    }
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $installedHelper).Hash -ne $beforeHelper) {
      throw "Northwing live-app installer modified northwing-update-helper.exe"
    }

    # Start the shipped helper while the actual Northwing process is alive.
    # This mirrors production: the helper waits for this PID while Northwing
    # exits through its normal window-close path.
    # Keep a space in the staged directory so the verifier exercises the same
    # argument-boundary requirement as a typical Program Files installation.
    $helperStaging = Join-Path $scratch "helper staging"
    New-Item -ItemType Directory -Force -Path $helperStaging | Out-Null
    $stagedHelper = Join-Path $helperStaging "northwing-update-helper.exe"
    Copy-Item -LiteralPath $installedHelper -Destination $stagedHelper
    $helperStart = [System.Diagnostics.ProcessStartInfo]::new()
    $helperStart.FileName = $stagedHelper
    $helperStart.UseShellExecute = $false
    foreach ($argument in @(
      "--installer", $installer,
      "--pid", "$($runningNorthwing.Id)",
      "--restart", $installedExe,
      "--expected-version", $Version,
      "--cleanup", $helperStaging
    )) {
      [void]$helperStart.ArgumentList.Add($argument)
    }
    $helperUpdate = [System.Diagnostics.Process]::Start($helperStart)
    if ($null -eq $helperUpdate) {
      throw "Could not start the staged Northwing update helper"
    }
    Start-Sleep -Milliseconds 250
    if ($helperUpdate.HasExited) {
      throw "Northwing update helper exited before the live application closed with code $($helperUpdate.ExitCode)"
    }

    if (-not $runningNorthwing.CloseMainWindow()) {
      throw "Could not request a normal Northwing exit before helper update"
    }
    if (-not $runningNorthwing.WaitForExit(15000)) {
      throw "Northwing did not exit normally before helper update"
    }
    if (-not $helperUpdate.WaitForExit(90000)) {
      Stop-Process -Id $helperUpdate.Id -Force
      throw "Northwing update helper did not complete within 90 seconds"
    }
    $helperUpdate.WaitForExit()
    if ($helperUpdate.ExitCode -ne 0) {
      throw "Northwing update helper exited $($helperUpdate.ExitCode)"
    }
  } finally {
    if ($helperUpdate -and -not $helperUpdate.HasExited) {
      # Isolated verifier cleanup after a failed assertion only.
      Stop-Process -Id $helperUpdate.Id -Force
      $helperUpdate.WaitForExit()
    }
    if (-not $runningNorthwing.HasExited) {
      # Isolated verifier cleanup after a failed assertion only; the update
      # path above never force-terminates Northwing.
      Stop-Process -Id $runningNorthwing.Id -Force
      $runningNorthwing.WaitForExit()
    }
  }

  # The helper completed after waiting for the live PID, installing, validating
  # the version, and requesting a restart.
  $restartedNorthwing = Wait-NorthwingRestart $installedExe
  try {
    Assert-NorthwingVersion $installedExe
  } finally {
    if (-not $restartedNorthwing.CloseMainWindow()) {
      Stop-Process -Id $restartedNorthwing.Id -Force
    } elseif (-not $restartedNorthwing.WaitForExit(15000)) {
      Stop-Process -Id $restartedNorthwing.Id -Force
      $restartedNorthwing.WaitForExit()
    }
  }
  Assert-NorthwingVersion $installedExe
  if (-not (Test-Path -LiteralPath $installedHelper -PathType Leaf)) {
    throw "Northwing update helper was lost during overwrite installation"
  }
  if (Test-Path -LiteralPath "$installedExe.previous") {
    throw "Northwing installer left its executable rollback file after a successful overwrite"
  }

  $uninstall = Get-ItemProperty -LiteralPath $uninstallKey
  if ($uninstall.DisplayName -ne "Northwing" -or $uninstall.DisplayVersion -ne $Version) {
    throw "Northwing uninstall registration is incorrect"
  }
  $protocolCommand = (Get-Item -LiteralPath "$protocolKey\shell\open\command").GetValue("")
  if ($protocolCommand -notlike "*$installedExe*" -or $protocolCommand -notlike '*%1*') {
    throw "northwing:// protocol registration is incorrect: $protocolCommand"
  }

  $uninstaller = Join-Path $installDir "Uninstall.exe"
  if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
    throw "Northwing uninstaller is missing: $uninstaller"
  }
  $uninstallProcess = Start-Process -FilePath $uninstaller -ArgumentList "/S" -PassThru -Wait
  if ($uninstallProcess.ExitCode -ne 0) {
    throw "Northwing uninstaller exited $($uninstallProcess.ExitCode)"
  }
  Start-Sleep -Seconds 2
  if (Test-Path -LiteralPath $installedExe) {
    throw "Northwing executable remains after uninstall: $installedExe"
  }
  if (Test-Path -LiteralPath $uninstallKey) {
    throw "Northwing uninstall registration remains after uninstall"
  }
  if (Test-Path -LiteralPath $protocolKey) {
    throw "northwing:// registration remains after uninstall"
  }
} finally {
  $uninstaller = Join-Path $installDir "Uninstall.exe"
  if (Test-Path -LiteralPath $uninstaller -PathType Leaf) {
    $cleanup = Start-Process -FilePath $uninstaller -ArgumentList "/S" -PassThru -Wait
    if ($cleanup.ExitCode -ne 0) {
      Write-Warning "Cleanup uninstaller exited $($cleanup.ExitCode)"
    }
  }
  foreach ($name in $previousRuntimeEnvironment.Keys) {
    [Environment]::SetEnvironmentVariable($name, $previousRuntimeEnvironment[$name], "Process")
  }
  Remove-Item -LiteralPath $scratch -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Verified Northwing $Version installer, running overwrite replacement, update helper, portable archive, protocol registration, uninstall, GUI startup, and SHA-256 checksums."
