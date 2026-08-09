[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+$')][string]$Version,
  [Parameter(Mandatory = $true)][string]$ArtifactDir,
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')][string]$Repository
)

$ErrorActionPreference = 'Stop'

function Assert-ExactProperties {
  param([Parameter(Mandatory = $true)]$Value, [Parameter(Mandatory = $true)][string[]]$Names, [Parameter(Mandatory = $true)][string]$Context)
  if ($null -eq $Value) { throw "$Context is required" }
  $actual = @($Value.PSObject.Properties.Name | Sort-Object)
  $expected = @($Names | Sort-Object)
  if (($actual -join "`n") -ne ($expected -join "`n")) { throw "$Context has unexpected or missing fields" }
}

if (-not (Test-Path -LiteralPath $env:NORTHWING_RELEASE_PFX -PathType Leaf)) { throw 'prepared release PFX is unavailable' }
if ($null -eq $env:NORTHWING_RELEASE_PFX_PASSWORD) { throw 'prepared release PFX password is unavailable' }

$manifestPath = Join-Path $ArtifactDir 'northwing-update.json'
$signaturePath = Join-Path $ArtifactDir 'northwing-update.json.sig'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf) -or -not (Test-Path -LiteralPath $signaturePath -PathType Leaf)) { throw 'manifest and detached signature are required' }
$raw = [IO.File]::ReadAllBytes($manifestPath)
$signature = [IO.File]::ReadAllBytes($signaturePath)
if ($raw.Length -eq 0) { throw 'manifest is empty' }
if ($signature.Length -eq 0) { throw 'manifest signature is empty' }

try {
  $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
    $env:NORTHWING_RELEASE_PFX,
    $env:NORTHWING_RELEASE_PFX_PASSWORD
  )
} catch {
  throw 'prepared release PFX could not be opened'
}
$publicKey = $null
try {
  $publicKey = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPublicKey($cert)
  if ($null -eq $publicKey -or $publicKey.KeySize -lt 2048) { throw 'release credential requires RSA public key' }
  if (-not $publicKey.VerifyData($raw, $signature, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)) { throw 'manifest signature verification failed' }
} finally {
  if ($publicKey) { $publicKey.Dispose() }
  $cert.Dispose()
}

try { $manifest = [Text.Encoding]::UTF8.GetString($raw) | ConvertFrom-Json -ErrorAction Stop } catch { throw 'manifest JSON is invalid' }
Assert-ExactProperties -Value $manifest -Names @('schemaVersion', 'product', 'version', 'channel', 'publishedAt', 'repository', 'releaseNotes', 'assets') -Context 'manifest'
Assert-ExactProperties -Value $manifest.assets -Names @('windows-x64') -Context 'manifest assets'
$asset = $manifest.assets.'windows-x64'
Assert-ExactProperties -Value $asset -Names @('name', 'url', 'size', 'sha256') -Context 'windows-x64 asset'

$tag = "northwing-v$Version"
$setupName = "Northwing-$Version-windows-x64-setup.exe"
$expectedReleaseNotes = "https://github.com/$Repository/releases/tag/$tag"
$expectedURL = "https://github.com/$Repository/releases/download/$tag/$setupName"
if ($manifest.schemaVersion -ne 1 -or $manifest.product -cne 'Northwing' -or $manifest.version -cne $Version -or $manifest.channel -cne 'stable') { throw 'manifest identity is invalid' }
if ($manifest.repository -cne $Repository -or $manifest.releaseNotes -cne $expectedReleaseNotes) { throw 'manifest repository metadata is invalid' }
$publishedAt = [DateTimeOffset]::MinValue
if (-not [DateTimeOffset]::TryParse([string]$manifest.publishedAt, [ref]$publishedAt)) { throw 'manifest publishedAt is invalid' }
if ($asset.name -cne $setupName -or $asset.url -cne $expectedURL) { throw 'manifest Windows asset identity is invalid' }
if ([string]$asset.sha256 -cnotmatch '^[0-9a-f]{64}$') { throw 'manifest Windows asset SHA-256 is invalid' }

$setupPath = Join-Path $ArtifactDir $setupName
if (-not (Test-Path -LiteralPath $setupPath -PathType Leaf)) { throw "missing setup: $setupPath" }
$setupInfo = Get-Item -LiteralPath $setupPath
$setupHash = (Get-FileHash -LiteralPath $setupPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ([int64]$asset.size -ne $setupInfo.Length -or [string]$asset.sha256 -cne $setupHash) { throw 'manifest Windows asset size or SHA-256 does not match setup' }

Write-Output 'Northwing release manifest signature and setup metadata verified.'
