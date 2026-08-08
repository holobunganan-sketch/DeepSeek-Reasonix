[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$ArtifactDir, [Parameter(Mandatory = $true)][string]$CertificatePath, [Parameter(Mandatory = $true)][string]$Password)
$ErrorActionPreference = 'Stop'
$cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($CertificatePath, $Password)
$manifest = Join-Path $ArtifactDir 'northwing-update.json'; $signature = Join-Path $ArtifactDir 'northwing-update.json.sig'
if (-not (Test-Path -LiteralPath $manifest) -or -not (Test-Path -LiteralPath $signature)) { throw 'manifest and detached signature are required' }
$raw = [IO.File]::ReadAllBytes($manifest); $sig = [IO.File]::ReadAllBytes($signature)
if ($sig.Length -eq 0 -or -not $cert.GetRSAPublicKey().VerifyData($raw, $sig, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)) { throw 'manifest signature verification failed' }
