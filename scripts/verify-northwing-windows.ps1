param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$')]
  [string]$Version,
  [string]$OutputDir = "dist"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root $OutputDir
$installer = Join-Path $out "Northwing-$Version-windows-x64-setup.exe"
$portableZip = Join-Path $out "Northwing-$Version-windows-x64-portable.zip"
$checksumPath = Join-Path $out "Northwing-$Version-SHA256SUMS.txt"
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
  $allowedPortableFiles = @("LICENSE", "THIRD_PARTY_NOTICES.md", "northwing.exe") | Sort-Object
  if (($portableFiles -join "`n") -ne ($allowedPortableFiles -join "`n")) {
    throw "Portable archive has unexpected contents:`n$($portableFiles -join "`n")"
  }
  $portableExe = Join-Path $portableDir "northwing.exe"
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
  Assert-NorthwingVersion $installedExe
  Assert-GuiStarts $installedExe

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

Write-Host "Verified Northwing $Version installer, portable archive, protocol registration, uninstall, GUI startup, and SHA-256 checksums."
