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
  [string]$WindowsKitsRoot,
  [string]$ExpectedSignerSPKIBase64,
  [switch]$RequireWindowsKits
)

$ErrorActionPreference = 'Stop'

function Get-NorthwingCredential {
  if ([string]::IsNullOrWhiteSpace($env:NORTHWING_WINDOWS_RELEASE_CREDENTIAL)) { throw 'NORTHWING_WINDOWS_RELEASE_CREDENTIAL is required' }
  try { $credential = $env:NORTHWING_WINDOWS_RELEASE_CREDENTIAL | ConvertFrom-Json -AsHashtable -ErrorAction Stop } catch { throw 'NORTHWING_WINDOWS_RELEASE_CREDENTIAL must be compact JSON' }
  if ($credential.Count -ne 2 -or @($credential.Keys | Where-Object { $_ -notin @('pfxBase64', 'password') }).Count -ne 0) { throw 'credential may contain only pfxBase64 and password' }
  if ([string]::IsNullOrWhiteSpace([string]$credential.pfxBase64) -or $null -eq $credential.password) { throw 'credential requires pfxBase64 and password' }
  try { $bytes = [Convert]::FromBase64String([string]$credential.pfxBase64) } catch { throw 'credential PFX is not base64' }
  $certificates = [System.Security.Cryptography.X509Certificates.X509Certificate2Collection]::new()
  try {
    $certificates.Import(
      $bytes,
      [string]$credential.password,
      [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable
    )
  } catch {
    foreach ($certificate in $certificates) { $certificate.Dispose() }
    throw 'credential PFX could not be opened with the supplied password'
  }
  try {
    $privateCertificates = @($certificates | Where-Object { $_.HasPrivateKey })
    if ($privateCertificates.Count -ne 1) { throw 'credential PFX must contain exactly one private key certificate' }
    $cert = $privateCertificates[0]
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
    return @{ Bytes = $bytes; Password = [string]$credential.password; Certificate = $cert; RSA = $rsa; Certificates = $certificates }
  } catch {
    if ($rsa) { $rsa.Dispose() }
    foreach ($certificate in $certificates) { $certificate.Dispose() }
    throw
  }
}

function Find-SignTool {
  param([string]$ExplicitPath, [string]$KitsRoot, [switch]$WindowsKitsOnly)

  if (-not [string]::IsNullOrWhiteSpace($ExplicitPath)) {
    if (Test-Path -LiteralPath $ExplicitPath -PathType Leaf) { return (Resolve-Path -LiteralPath $ExplicitPath).Path }
    throw "explicit signtool.exe was not found: $ExplicitPath"
  }
  if (-not $WindowsKitsOnly) {
    $tool = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($tool) { return $tool.Source }
  }

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

function Get-NorthwingSPKIBytes {
  param([Parameter(Mandatory = $true)]$Certificate)
  $publicKey = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPublicKey($Certificate)
  if ($null -eq $publicKey) { throw 'signer certificate requires an RSA public key' }
  try { return $publicKey.ExportSubjectPublicKeyInfo() } finally { $publicKey.Dispose() }
}

function Get-NorthwingExpectedSPKIBytes {
  param([Parameter(Mandatory = $true)][string]$Encoded)
  try { return [Convert]::FromBase64String($Encoded) } catch { throw 'expected signer SPKI is not valid base64' }
}

function Protect-NorthwingCredentialFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not $IsWindows) { throw 'release credential preparation requires Windows filesystem ACLs' }
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  & "$env:SystemRoot\System32\icacls.exe" $Path /inheritance:r /grant:r "${identity}:(F)" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'release credential PFX permissions could not be restricted' }
  $acl = Get-Acl -LiteralPath $Path
  if (-not $acl.AreAccessRulesProtected) { throw 'release credential PFX retained inherited permissions' }
}

function Assert-NorthwingSignedFile {
  param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][byte[]]$ExpectedSPKI)
  $signature = Get-AuthenticodeSignature -LiteralPath $Path
  if ($signature.Status -ne 'Valid') { throw "Authenticode signature is invalid: $Path" }
  if ($null -eq $signature.SignerCertificate) { throw "Authenticode signer certificate is missing: $Path" }
  if ($null -eq $signature.TimeStamperCertificate) { throw "RFC3161 timestamp is missing: $Path" }
  $actualSPKI = Get-NorthwingSPKIBytes -Certificate $signature.SignerCertificate
  if ($actualSPKI.Length -ne $ExpectedSPKI.Length -or -not [System.Security.Cryptography.CryptographicOperations]::FixedTimeEquals($actualSPKI, $ExpectedSPKI)) {
    throw "Authenticode signer does not match the Northwing release trust root: $Path"
  }
}

if ($ResolveSignTool) {
  Write-Output (Find-SignTool -ExplicitPath $SignToolPath -KitsRoot $WindowsKitsRoot -WindowsKitsOnly:$RequireWindowsKits)
  return
}

if ($PrepareCredential) {
  if ([string]::IsNullOrWhiteSpace($RunnerTemp)) { throw 'RunnerTemp is required' }
  $credential = Get-NorthwingCredential
  try {
    $pfx = Join-Path $RunnerTemp 'northwing-release.pfx'
    [IO.File]::WriteAllBytes($pfx, $credential.Bytes)
    Protect-NorthwingCredentialFile -Path $pfx
    [Console]::WriteLine("::add-mask::$($credential.Password)")
    [Console]::WriteLine("::add-mask::$($env:NORTHWING_WINDOWS_RELEASE_CREDENTIAL)")
    $spki = [Convert]::ToBase64String((Get-NorthwingSPKIBytes -Certificate $credential.Certificate))
    $env:NORTHWING_RELEASE_PFX = $pfx
    $env:NORTHWING_RELEASE_PFX_PASSWORD = $credential.Password
    $env:NORTHWING_MANIFEST_SPKI_BASE64 = $spki
  } finally {
    $credential.RSA.Dispose()
    foreach ($certificate in $credential.Certificates) { $certificate.Dispose() }
  }
  return
}
if ($CleanupCredential) {
  if ($RunnerTemp) { Remove-Item -LiteralPath (Join-Path $RunnerTemp 'northwing-release.pfx') -Force -ErrorAction SilentlyContinue }
  Remove-Item Env:NORTHWING_RELEASE_PFX -ErrorAction SilentlyContinue
  Remove-Item Env:NORTHWING_RELEASE_PFX_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:NORTHWING_MANIFEST_SPKI_BASE64 -ErrorAction SilentlyContinue
  Remove-Item Env:NORTHWING_WINDOWS_RELEASE_CREDENTIAL -ErrorAction SilentlyContinue
  return
}
if (-not $SignPayload -and -not $SignSetup) { throw 'select PrepareCredential, CleanupCredential, SignPayload, or SignSetup' }
if ([string]::IsNullOrWhiteSpace($ArtifactDir) -or [string]::IsNullOrWhiteSpace($Version)) { throw 'Version and ArtifactDir are required for signing' }
if (-not (Test-Path -LiteralPath $env:NORTHWING_RELEASE_PFX -PathType Leaf)) { throw 'prepared release PFX is unavailable' }
$encodedExpectedSPKI = if ([string]::IsNullOrWhiteSpace($ExpectedSignerSPKIBase64)) { $env:NORTHWING_MANIFEST_SPKI_BASE64 } else { $ExpectedSignerSPKIBase64 }
if ([string]::IsNullOrWhiteSpace($encodedExpectedSPKI)) { throw 'ExpectedSignerSPKIBase64 is required for signing verification' }
$expectedSPKI = Get-NorthwingExpectedSPKIBytes -Encoded $encodedExpectedSPKI
$signtool = Find-SignTool -ExplicitPath $SignToolPath -KitsRoot $WindowsKitsRoot -WindowsKitsOnly:$RequireWindowsKits
$files = if ($SignPayload) { @((Join-Path $ArtifactDir 'northwing.exe'), (Join-Path $ArtifactDir 'northwing-update-helper.exe')) } else { @((Join-Path $ArtifactDir "Northwing-$Version-windows-x64-setup.exe")) }
foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "missing signing input: $file" }
  & $signtool sign /fd SHA256 /tr https://timestamp.digicert.com /td SHA256 /f $env:NORTHWING_RELEASE_PFX /p $env:NORTHWING_RELEASE_PFX_PASSWORD $file
  if ($LASTEXITCODE -ne 0) { throw "signtool sign failed: $file" }
  & $signtool verify /pa /all $file
  if ($LASTEXITCODE -ne 0) { throw "signtool verify failed: $file" }
  Assert-NorthwingSignedFile -Path $file -ExpectedSPKI $expectedSPKI
}
