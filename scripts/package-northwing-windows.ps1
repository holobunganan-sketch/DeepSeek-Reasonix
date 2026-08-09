param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$')]
  [string]$Version,
  [string]$OutputDir = "dist",
  [string]$PayloadDir,
  [switch]$UnsignedTestArtifact,
  [switch]$FinalizeChecksums,
  [switch]$ValidatePayloadOnly
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$desktop = Join-Path $root "desktop"
$payloadRoot = if ([string]::IsNullOrWhiteSpace($PayloadDir)) { Join-Path $desktop "build\bin" } elseif ([IO.Path]::IsPathRooted($PayloadDir)) { [IO.Path]::GetFullPath($PayloadDir) } else { Join-Path $root $PayloadDir }
$exe = Join-Path $payloadRoot "northwing.exe"
$helper = Join-Path $payloadRoot "northwing-update-helper.exe"
$out = if ([IO.Path]::IsPathRooted($OutputDir)) { [IO.Path]::GetFullPath($OutputDir) } else { Join-Path $root $OutputDir }
$portableZipFinal = Join-Path $out "Northwing-$Version-windows-x64-portable.zip"
$installerFinal = Join-Path $out "Northwing-$Version-windows-x64-setup.exe"
$checksumPath = Join-Path $out "Northwing-$Version-SHA256SUMS.txt"

if ($FinalizeChecksums) {
  foreach ($file in @($portableZipFinal, $installerFinal)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Final checksum input is missing: $file" }
  }
  $lines = foreach ($file in @($portableZipFinal, $installerFinal)) {
    "$((Get-FileHash -Algorithm SHA256 $file).Hash.ToLowerInvariant())  $([IO.Path]::GetFileName($file))"
  }
  $lines | Set-Content -Encoding ascii $checksumPath
  Write-Host "Created final checksums: $checksumPath"
  exit 0
}

if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) {
  throw "Northwing executable not found: $exe. Run the Wails Windows build first."
}
if (-not (Test-Path -LiteralPath $helper -PathType Leaf)) {
  throw "Northwing update helper not found: $helper. Build it before packaging."
}

if ($UnsignedTestArtifact) {
  Write-Warning "UNSIGNED-TEST-ONLY: Authenticode and timestamp validation are intentionally skipped."
} else {
  function Assert-NorthwingAuthenticodePayload([string]$Path) {
    $signature = Get-AuthenticodeSignature -LiteralPath $Path
    if ($signature.Status -ne "Valid") { throw "Formal packaging requires a valid Authenticode signature: $Path" }
    if ($null -eq $signature.SignerCertificate) { throw "Formal packaging requires a signer certificate: $Path" }
    $codeSigning = @($signature.SignerCertificate.EnhancedKeyUsageList | Where-Object { $_.ObjectId.Value -eq '1.3.6.1.5.5.7.3.3' })
    if ($codeSigning.Count -eq 0) { throw "Formal packaging requires a Code Signing signer certificate: $Path" }
    if ($null -eq $signature.TimeStamperCertificate) { throw "Formal packaging requires an RFC3161 timestamp: $Path" }
  }
  foreach ($payload in @($exe, $helper)) {
    Assert-NorthwingAuthenticodePayload $payload
  }
  $signtool = & (Join-Path $PSScriptRoot 'sign-northwing-release.ps1') -ResolveSignTool
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($signtool)) { throw 'signtool.exe is required for formal packaging verification' }
  foreach ($payload in @($exe, $helper)) {
    & $signtool verify /pa /all $payload
    if ($LASTEXITCODE -ne 0) { throw "signtool verify failed for formal payload: $payload" }
  }
}
if ($ValidatePayloadOnly) {
  Write-Host "Northwing payload validation completed."
  exit 0
}

New-Item -ItemType Directory -Force -Path $out | Out-Null
$portableDir = Join-Path $out "Northwing-$Version-windows-x64-portable"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $portableDir
New-Item -ItemType Directory -Force -Path $portableDir | Out-Null
Copy-Item $exe (Join-Path $portableDir "northwing.exe")
Copy-Item $helper (Join-Path $portableDir "northwing-update-helper.exe")
Copy-Item (Join-Path $root "LICENSE") (Join-Path $portableDir "LICENSE")
if (Test-Path (Join-Path $root "THIRD_PARTY_NOTICES.md")) {
  Copy-Item (Join-Path $root "THIRD_PARTY_NOTICES.md") $portableDir
}

$portableZip = Join-Path $out "Northwing-$Version-windows-x64-portable.zip"
Remove-Item -Force -ErrorAction SilentlyContinue $portableZip
Compress-Archive -Path (Join-Path $portableDir "*") -DestinationPath $portableZip -CompressionLevel Optimal
Remove-Item -Recurse -Force $portableDir

$makensisCommand = Get-Command makensis.exe -ErrorAction SilentlyContinue
$makensisPath = if ($makensisCommand) { $makensisCommand.Source } else { $null }
if (-not $makensisPath) {
  $programFilesRoots = @(
    $env:ProgramFiles,
    ${env:ProgramFiles(x86)}
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique
  foreach ($programFilesRoot in $programFilesRoots) {
    $candidate = Join-Path $programFilesRoot "NSIS\makensis.exe"
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      $makensisPath = $candidate
      break
    }
  }
}
if (-not $makensisPath) {
  throw "makensis was not found. Install NSIS before creating the installer."
}
$installer = Join-Path $root "Northwing-$Version-windows-x64-setup.exe"
Remove-Item -Force -ErrorAction SilentlyContinue $installer
$nsisScript = Join-Path $root "scripts\windows\northwing-installer.nsi"
& $makensisPath "/DAPP_VERSION=$Version" "/DAPP_SOURCE_EXE=$exe" "/DAPP_UPDATE_HELPER=$helper" $nsisScript
if ($LASTEXITCODE -ne 0) {
  throw "makensis exited with code $LASTEXITCODE"
}
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
  throw "NSIS did not produce the expected installer: $installer"
}
$installerTarget = Join-Path $out "Northwing-$Version-windows-x64-setup.exe"
Move-Item -Force $installer $installerTarget

$files = @($portableZip, $installerTarget)
if ($UnsignedTestArtifact -or $FinalizeChecksums) {
  $lines = foreach ($file in $files) {
    $hash = (Get-FileHash -Algorithm SHA256 $file).Hash.ToLowerInvariant()
    "$hash  $([IO.Path]::GetFileName($file))"
  }
  $lines | Set-Content -Encoding ascii $checksumPath
}
Write-Host "Created:"
$files + $(if (Test-Path -LiteralPath $checksumPath) { $checksumPath }) | ForEach-Object { Write-Host "  $_" }
