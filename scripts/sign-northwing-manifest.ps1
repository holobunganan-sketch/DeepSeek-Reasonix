[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+$')][string]$Version,
  [Parameter(Mandatory = $true)][string]$ArtifactDir,
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')][string]$Repository
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $env:NORTHWING_RELEASE_PFX -PathType Leaf)) { throw 'prepared release PFX is unavailable' }
if ($null -eq $env:NORTHWING_RELEASE_PFX_PASSWORD) { throw 'prepared release PFX password is unavailable' }
$pfx = [IO.File]::ReadAllBytes($env:NORTHWING_RELEASE_PFX)
try {
  $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
    $pfx,
    $env:NORTHWING_RELEASE_PFX_PASSWORD,
    [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable
  )
} catch {
  throw 'prepared release PFX could not be opened'
}
$rsa = $null
$publicKey = $null
try {
  $rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
  if ($null -eq $rsa -or $rsa.KeySize -lt 2048) { throw 'release credential requires RSA private key' }
  $setup = Join-Path $ArtifactDir "Northwing-$Version-windows-x64-setup.exe"
  if (-not (Test-Path -LiteralPath $setup -PathType Leaf)) { throw "missing setup: $setup" }
  $setupInfo = Get-Item -LiteralPath $setup
  $hash = (Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash.ToLowerInvariant()
  $tag = "northwing-v$Version"
  $setupName = [IO.Path]::GetFileName($setup)
  $manifest = [ordered]@{
    schemaVersion = 1
    product = 'Northwing'
    version = $Version
    channel = 'stable'
    publishedAt = [DateTime]::UtcNow.ToString('o')
    repository = $Repository
    releaseNotes = "https://github.com/$Repository/releases/tag/$tag"
    assets = [ordered]@{
      'windows-x64' = [ordered]@{
        name = $setupName
        url = "https://github.com/$Repository/releases/download/$tag/$setupName"
        size = $setupInfo.Length
        sha256 = $hash
      }
    }
  }
  $manifestPath = Join-Path $ArtifactDir 'northwing-update.json'
  $signaturePath = Join-Path $ArtifactDir 'northwing-update.json.sig'
  [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 6 -Compress), [Text.UTF8Encoding]::new($false))
  $raw = [IO.File]::ReadAllBytes($manifestPath)
  if ($raw.Length -eq 0) { throw 'generated manifest is empty' }
  $signature = $rsa.SignData($raw, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
  $publicKey = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPublicKey($cert)
  if ($signature.Length -eq 0 -or $null -eq $publicKey -or -not $publicKey.VerifyData($raw, $signature, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)) { throw 'manifest signature verification failed' }
  [IO.File]::WriteAllBytes($signaturePath, $signature)
} finally {
  if ($publicKey) { $publicKey.Dispose() }
  if ($rsa) { $rsa.Dispose() }
  $cert.Dispose()
}
