[CmdletBinding(DefaultParameterSetName = 'Prepare')]
param(
  [switch]$PrepareCredential,
  [switch]$CleanupCredential,
  [switch]$SignPayload,
  [switch]$SignSetup,
  [switch]$ResolveSignTool,
  [string]$RunnerTemp,
  [string]$Version,
  [string]$ArtifactDir,
  [string]$SignToolPath,
  [string]$WindowsKitsRoot
)

$ErrorActionPreference = 'Stop'

function Get-NorthwingCredential {
  if ([string]::IsNullOrWhiteSpace($env:NORTHWING_WINDOWS_RELEASE_CREDENTIAL)) { throw 'NORTHWING_WINDOWS_RELEASE_CREDENTIAL is required' }
  try { $credential = $env:NORTHWING_WINDOWS_RELEASE_CREDENTIAL | ConvertFrom-Json -AsHashtable -ErrorAction Stop } catch { throw 'NORTHWING_WINDOWS_RELEASE_CREDENTIAL must be compact JSON' }
  if ($credential.Count -ne 2 -or @($credential.Keys | Where-Object { $_ -notin @('pfxBase64', 'password') }).Count -ne 0) { throw 'credential may contain only pfxBase64 and password' }
  if ([string]::IsNullOrWhiteSpace([string]$credential.pfxBase64) -or $null -eq $credential.password) { throw 'credential requires pfxBase64 and password' }
  try { $bytes = [Convert]::FromBase64String([string]$credential.pfxBase64) } catch { throw 'credential PFX is not base64' }
  try {
    $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
      $bytes,
      [string]$credential.password,
      [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable
    )
  } catch {
    throw 'credential PFX could not be opened with the supplied password'
  }
  if (-not $cert.HasPrivateKey) { throw 'credential certificate requires a private key' }
  if ($cert.NotBefore.ToUniversalTime() -gt [DateTime]::UtcNow -or $cert.NotAfter.ToUniversalTime() -lt [DateTime]::UtcNow) { throw 'credential certificate is not currently valid' }
  $rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
  if ($null -eq $rsa) { throw 'credential certificate requires an RSA private key' }
  if ($rsa.KeySize -lt 2048) { throw 'credential certificate requires an RSA private key of at least 2048 bits' }

  $codeSigningOid = '1.3.6.1.5.5.7.3.3'
  $eku = $cert.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.37' } | Select-Object -First 1
  if ($null -eq $eku -or -not @($eku.EnhancedKeyUsages | Where-Object { $_.Value -eq $codeSigningOid }).Count) {
    throw 'credential certificate requires the Code Signing EKU'
  }
  $keyUsage = $cert.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.15' } | Select-Object -First 1
  if ($null -ne $keyUsage -and -not ($keyUsage.KeyUsages -band [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature)) {
    throw 'credential certificate requires DigitalSignature key usage'
  }
  return @{ Bytes = $bytes; Password = [string]$credential.password; Certificate = $cert; RSA = $rsa }
}

function Find-SignTool {
  param([string]$ExplicitPath, [string]$KitsRoot)

  if (-not [string]::IsNullOrWhiteSpace($ExplicitPath)) {
    if (Test-Path -LiteralPath $ExplicitPath -PathType Leaf) { return (Resolve-Path -LiteralPath $ExplicitPath).Path }
    throw "explicit signtool.exe was not found: $ExplicitPath"
  }
  $tool = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($tool) { return $tool.Source }

  $programFilesX86 = if ([string]::IsNullOrWhiteSpace($KitsRoot)) { ${env:ProgramFiles(x86)} } else { $KitsRoot }
  if (-not [string]::IsNullOrWhiteSpace($programFilesX86)) {
    $binRoot = Join-Path $programFilesX86 'Windows Kits\10\bin'
    if (Test-Path -LiteralPath $binRoot -PathType Container) {
      $versionedTools = Get-ChildItem -LiteralPath $binRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $candidate = Join-Path $_.FullName 'x64\signtool.exe'
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
          $parsedVersion = [Version]'0.0'
          $null = [Version]::TryParse($_.Name, [ref]$parsedVersion)
          [pscustomobject]@{ Path = (Resolve-Path -LiteralPath $candidate).Path; Version = $parsedVersion }
        }
      } | Sort-Object Version -Descending
      if ($versionedTools) { return $versionedTools[0].Path }
    }

    $appCertificationTool = Join-Path $programFilesX86 'Windows Kits\10\App Certification Kit\signtool.exe'
    if (Test-Path -LiteralPath $appCertificationTool -PathType Leaf) { return (Resolve-Path -LiteralPath $appCertificationTool).Path }
  }
  throw 'signtool.exe is required for formal Northwing signing'
}

if ($ResolveSignTool) {
  Write-Output (Find-SignTool -ExplicitPath $SignToolPath -KitsRoot $WindowsKitsRoot)
  exit 0
}

if ($PrepareCredential) {
  if ([string]::IsNullOrWhiteSpace($RunnerTemp)) { throw 'RunnerTemp is required' }
  $credential = Get-NorthwingCredential
  $pfx = Join-Path $RunnerTemp 'northwing-release.pfx'
  [IO.File]::WriteAllBytes($pfx, $credential.Bytes)
  [Console]::WriteLine("::add-mask::$($credential.Password)")
  [Console]::WriteLine("::add-mask::$($env:NORTHWING_WINDOWS_RELEASE_CREDENTIAL)")
  $publicKey = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPublicKey($credential.Certificate)
  try { $spki = [Convert]::ToBase64String($publicKey.ExportSubjectPublicKeyInfo()) } finally { $publicKey.Dispose() }
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
$signtool = Find-SignTool -ExplicitPath $SignToolPath -KitsRoot $WindowsKitsRoot
$files = if ($SignPayload) { @((Join-Path $ArtifactDir 'northwing.exe'), (Join-Path $ArtifactDir 'northwing-update-helper.exe')) } else { @((Join-Path $ArtifactDir "Northwing-$Version-windows-x64-setup.exe")) }
foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "missing signing input: $file" }
  & $signtool sign /fd SHA256 /td SHA256 /tr https://timestamp.digicert.com /f $env:NORTHWING_RELEASE_PFX /p $env:NORTHWING_RELEASE_PFX_PASSWORD $file
  if ($LASTEXITCODE -ne 0) { throw "signtool sign failed: $file" }
  & $signtool verify /pa /all $file
  if ($LASTEXITCODE -ne 0) { throw "signtool verify failed: $file" }
}
