param(
  [string]$Version = "0.1.0",
  [string]$OutputDir = "dist"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$desktop = Join-Path $root "desktop"
$exe = Join-Path $desktop "build\bin\northwing.exe"
$out = Join-Path $root $OutputDir

if (-not (Test-Path $exe)) {
  throw "Northwing executable not found: $exe. Run the Wails Windows build first."
}

New-Item -ItemType Directory -Force -Path $out | Out-Null
$portableDir = Join-Path $out "Northwing-$Version-windows-x64-portable"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $portableDir
New-Item -ItemType Directory -Force -Path $portableDir | Out-Null
Copy-Item $exe (Join-Path $portableDir "northwing.exe")
Copy-Item (Join-Path $root "LICENSE") (Join-Path $portableDir "LICENSE")
if (Test-Path (Join-Path $root "THIRD_PARTY_NOTICES.md")) {
  Copy-Item (Join-Path $root "THIRD_PARTY_NOTICES.md") $portableDir
}

$portableZip = Join-Path $out "Northwing-$Version-windows-x64-portable.zip"
Remove-Item -Force -ErrorAction SilentlyContinue $portableZip
Compress-Archive -Path (Join-Path $portableDir "*") -DestinationPath $portableZip -CompressionLevel Optimal

$makensis = Get-Command makensis -ErrorAction SilentlyContinue
if (-not $makensis) {
  throw "makensis was not found. Install NSIS before creating the installer."
}
Push-Location $root
try {
  & $makensis.Source "/DAPP_VERSION=$Version" "scripts\windows\northwing-installer.nsi"
} finally {
  Pop-Location
}
$installer = Join-Path $root "Northwing-0.1.0-windows-x64-setup.exe"
if (-not (Test-Path $installer)) {
  throw "NSIS did not produce the expected installer: $installer"
}
$installerTarget = Join-Path $out "Northwing-$Version-windows-x64-setup.exe"
Move-Item -Force $installer $installerTarget

$files = @($portableZip, $installerTarget)
$checksumPath = Join-Path $out "Northwing-$Version-SHA256SUMS.txt"
$lines = foreach ($file in $files) {
  $hash = (Get-FileHash -Algorithm SHA256 $file).Hash.ToLowerInvariant()
  "$hash  $([IO.Path]::GetFileName($file))"
}
$lines | Set-Content -Encoding ascii $checksumPath
Write-Host "Created:"
$files + $checksumPath | ForEach-Object { Write-Host "  $_" }
