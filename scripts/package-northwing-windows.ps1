param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$')]
  [string]$Version,
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
& $makensisPath "/DAPP_VERSION=$Version" $nsisScript
if ($LASTEXITCODE -ne 0) {
  throw "makensis exited with code $LASTEXITCODE"
}
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
