[CmdletBinding(DefaultParameterSetName = 'Prepare')]
param(
  [switch]$PrepareCredential,
  [switch]$CleanupCredential,
  [switch]$SignPayload,
  [switch]$SignSetup,
  [string]$RunnerTemp,
  [string]$Version,
  [string]$ArtifactDir
)

$ErrorActionPreference = 'Stop'

function Get-NorthwingCredential {
  if ([string]::IsNullOrWhiteSpace($env:NORTHWING_WINDOWS_RELEASE_CREDENTIAL)) { throw 'NORTHWING_WINDOWS_RELEASE_CREDENTIAL is required' }
  try { $credential = $env:NORTHWING_WINDOWS_RELEASE_CREDENTIAL | ConvertFrom-Json -ErrorAction Stop } catch { throw 'NORTHWING_WINDOWS_RELEASE_CREDENTIAL must be compact JSON' }
  if ([string]::IsNullOrWhiteSpace($credential.pfxBase64) -or $null -eq $credential.password) { throw 'credential requires pfxBase64 and password' }
  try { $bytes = [Convert]::FromBase64String([string]$credential.pfxBase64) } catch { throw 'credential PFX is not base64' }
  $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($bytes, [string]$credential.password, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)
  if (-not $cert.HasPrivateKey -or $cert.NotBefore -gt [DateTime]::UtcNow -or $cert.NotAfter -lt [DateTime]::UtcNow) { throw 'credential certificate is not currently valid with a private key' }
  $rsa = $cert.GetRSAPrivateKey()
  if ($null -eq $rsa -or $rsa.KeySize -lt 2048) { throw 'credential certificate requires an RSA private key of at least 2048 bits' }
  return @{ Bytes = $bytes; Password = [string]$credential.password; Certificate = $cert; RSA = $rsa }
}

function Find-SignTool {
  $tool = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($tool) { return $tool.Source }
  throw 'signtool.exe is required for formal Northwing signing'
}

if ($PrepareCredential) {
  if ([string]::IsNullOrWhiteSpace($RunnerTemp)) { throw 'RunnerTemp is required' }
  $credential = Get-NorthwingCredential
  $pfx = Join-Path $RunnerTemp 'northwing-release.pfx'
  [IO.File]::WriteAllBytes($pfx, $credential.Bytes)
  [Console]::WriteLine("::add-mask::$($credential.Password)")
  [Console]::WriteLine("::add-mask::$($env:NORTHWING_WINDOWS_RELEASE_CREDENTIAL)")
  $spki = [Convert]::ToBase64String($credential.Certificate.GetRSAPublicKey().ExportSubjectPublicKeyInfo())
  "NORTHWING_RELEASE_PFX=$pfx" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
  "NORTHWING_RELEASE_PFX_PASSWORD=$($credential.Password)" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
  "NORTHWING_MANIFEST_SPKI_BASE64=$spki" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
  exit 0
}
if ($CleanupCredential) {
  if ($RunnerTemp) { Remove-Item -LiteralPath (Join-Path $RunnerTemp 'northwing-release.pfx') -Force -ErrorAction SilentlyContinue }
  exit 0
}
if (-not $SignPayload -and -not $SignSetup) { throw 'select PrepareCredential, CleanupCredential, SignPayload, or SignSetup' }
if ([string]::IsNullOrWhiteSpace($ArtifactDir) -or [string]::IsNullOrWhiteSpace($Version)) { throw 'Version and ArtifactDir are required for signing' }
if (-not (Test-Path -LiteralPath $env:NORTHWING_RELEASE_PFX -PathType Leaf)) { throw 'prepared release PFX is unavailable' }
$signtool = Find-SignTool
$files = if ($SignPayload) { @((Join-Path $ArtifactDir 'northwing.exe'), (Join-Path $ArtifactDir 'northwing-update-helper.exe')) } else { @((Join-Path $ArtifactDir "Northwing-$Version-windows-x64-setup.exe")) }
foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "missing signing input: $file" }
  & $signtool sign /fd SHA256 /td SHA256 /tr https://timestamp.digicert.com /f $env:NORTHWING_RELEASE_PFX /p $env:NORTHWING_RELEASE_PFX_PASSWORD $file
  if ($LASTEXITCODE -ne 0) { throw "signtool sign failed: $file" }
  & $signtool verify /pa /all $file
  if ($LASTEXITCODE -ne 0) { throw "signtool verify failed: $file" }
}
