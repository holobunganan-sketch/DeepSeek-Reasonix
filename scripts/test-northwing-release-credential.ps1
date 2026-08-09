[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$signScript = Join-Path $PSScriptRoot 'sign-northwing-release.ps1'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("northwing-release-credential-" + [Guid]::NewGuid().ToString('N'))
$password = 'Northwing-Test-Only-42!'
$passed = [Collections.Generic.List[string]]::new()

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function New-TestPfx {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [ValidateSet('RSA', 'ECDSA')][string]$Algorithm = 'RSA',
    [int]$KeySize = 2048,
    [bool]$IncludeCodeSigningEku = $true,
    [bool]$IncludeDigitalSignature = $true,
    [datetime]$NotBefore = [DateTime]::UtcNow.AddDays(-1),
    [datetime]$NotAfter = [DateTime]::UtcNow.AddDays(7),
    [switch]$PublicOnly
  )

  $key = $null
  $certificate = $null
  try {
    if ($Algorithm -eq 'RSA') {
      $key = [Security.Cryptography.RSA]::Create($KeySize)
      $request = [Security.Cryptography.X509Certificates.CertificateRequest]::new(
        'CN=Northwing Ephemeral Release Test',
        $key,
        [Security.Cryptography.HashAlgorithmName]::SHA256,
        [Security.Cryptography.RSASignaturePadding]::Pkcs1
      )
    } else {
      $key = [Security.Cryptography.ECDsa]::Create()
      $key.GenerateKey([Security.Cryptography.ECCurve]::CreateFromFriendlyName('nistP256'))
      $request = [Security.Cryptography.X509Certificates.CertificateRequest]::new(
        'CN=Northwing Ephemeral Release Test',
        $key,
        [Security.Cryptography.HashAlgorithmName]::SHA256
      )
    }

    $usage = if ($IncludeDigitalSignature) {
      [Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature
    } else {
      [Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment
    }
    $request.CertificateExtensions.Add(
      [Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new($usage, $true)
    )
    if ($IncludeCodeSigningEku) {
      $oids = [Security.Cryptography.OidCollection]::new()
      $null = $oids.Add([Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.3'))
      $request.CertificateExtensions.Add(
        [Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($oids, $true)
      )
    }

    $certificate = $request.CreateSelfSigned($NotBefore, $NotAfter)
    if ($PublicOnly) {
      $publicCertificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new(
        $certificate.Export([Security.Cryptography.X509Certificates.X509ContentType]::Cert)
      )
      try {
        [IO.File]::WriteAllBytes(
          $Path,
          $publicCertificate.Export([Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $password)
        )
      } finally {
        $publicCertificate.Dispose()
      }
    } else {
      [IO.File]::WriteAllBytes(
        $Path,
        $certificate.Export([Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $password)
      )
    }
    return [pscustomobject]@{
      Thumbprint = $certificate.Thumbprint
      SPKI = if ($Algorithm -eq 'RSA') {
        $publicKey = [Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPublicKey($certificate)
        try { [Convert]::ToBase64String($publicKey.ExportSubjectPublicKeyInfo()) } finally { $publicKey.Dispose() }
      } else { '' }
    }
  } finally {
    if ($certificate) { $certificate.Dispose() }
    if ($key) { $key.Dispose() }
  }
}

function Invoke-SignScript {
  param(
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [hashtable]$Environment = @{}
  )

  $start = [Diagnostics.ProcessStartInfo]::new()
  $start.FileName = (Get-Command pwsh -ErrorAction Stop).Source
  $start.UseShellExecute = $false
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $start.ArgumentList.Add('-NoProfile')
  $start.ArgumentList.Add('-File')
  $start.ArgumentList.Add($signScript)
  foreach ($argument in $Arguments) { $start.ArgumentList.Add($argument) }
  foreach ($name in $Environment.Keys) { $start.Environment[$name] = [string]$Environment[$name] }
  $process = [Diagnostics.Process]::Start($start)
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  return [pscustomobject]@{ ExitCode = $process.ExitCode; Stdout = $stdout.Trim(); Stderr = $stderr.Trim() }
}

function New-CredentialJson {
  param([string]$PfxPath, [string]$PfxPassword = $password, [hashtable]$Extra = @{})
  $payload = [ordered]@{
    pfxBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($PfxPath))
    password = $PfxPassword
  }
  foreach ($name in $Extra.Keys) { $payload[$name] = $Extra[$name] }
  return $payload | ConvertTo-Json -Compress
}

function Assert-RejectedCredential {
  param([string]$Name, [string]$CredentialJson, [string]$ExpectedError)
  $caseRoot = Join-Path $testRoot $Name
  $null = New-Item -ItemType Directory -Path $caseRoot
  $githubEnv = Join-Path $caseRoot 'github-env.txt'
  $result = Invoke-SignScript -Arguments @('-PrepareCredential', '-RunnerTemp', $caseRoot) -Environment @{
    NORTHWING_WINDOWS_RELEASE_CREDENTIAL = $CredentialJson
    GITHUB_ENV = $githubEnv
  }
  Assert-True ($result.ExitCode -ne 0) "$Name unexpectedly succeeded"
  Assert-True (($result.Stdout + $result.Stderr) -match [regex]::Escape($ExpectedError)) "$Name did not report '$ExpectedError': $($result.Stdout) $($result.Stderr)"
  $passed.Add($Name)
}

try {
  $null = New-Item -ItemType Directory -Path $testRoot
  $validPfx = Join-Path $testRoot 'valid.pfx'
  $valid = New-TestPfx -Path $validPfx
  $validRoot = Join-Path $testRoot 'valid-runner'
  $null = New-Item -ItemType Directory -Path $validRoot
  $githubEnv = Join-Path $validRoot 'github-env.txt'
  $validResult = Invoke-SignScript -Arguments @('-PrepareCredential', '-RunnerTemp', $validRoot) -Environment @{
    NORTHWING_WINDOWS_RELEASE_CREDENTIAL = (New-CredentialJson -PfxPath $validPfx)
    GITHUB_ENV = $githubEnv
  }
  Assert-True ($validResult.ExitCode -eq 0) "valid credential failed: $($validResult.Stdout) $($validResult.Stderr)"
  $environmentLines = Get-Content -LiteralPath $githubEnv
  $preparedPfxLine = $environmentLines | Where-Object { $_ -like 'NORTHWING_RELEASE_PFX=*' }
  $spkiLine = $environmentLines | Where-Object { $_ -like 'NORTHWING_MANIFEST_SPKI_BASE64=*' }
  Assert-True ($null -ne $preparedPfxLine) 'valid credential did not export PFX path'
  Assert-True ($null -ne $spkiLine) 'valid credential did not export SPKI'
  $preparedPfx = $preparedPfxLine.Substring('NORTHWING_RELEASE_PFX='.Length)
  $preparedCertificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new($preparedPfx, $password)
  try {
    Assert-True ($preparedCertificate.Thumbprint -eq $valid.Thumbprint) 'prepared certificate thumbprint changed'
    Assert-True ($spkiLine.Substring('NORTHWING_MANIFEST_SPKI_BASE64='.Length) -eq $valid.SPKI) 'prepared certificate SPKI changed'
  } finally {
    $preparedCertificate.Dispose()
  }
  $cleanupResult = Invoke-SignScript -Arguments @('-CleanupCredential', '-RunnerTemp', $validRoot)
  Assert-True ($cleanupResult.ExitCode -eq 0) "credential cleanup failed: $($cleanupResult.Stderr)"
  Assert-True (-not (Test-Path -LiteralPath $preparedPfx)) 'credential cleanup left the PFX on disk'
  $passed.Add('valid credential prepare and cleanup')

  Assert-RejectedCredential -Name 'malformed JSON' -CredentialJson '{' -ExpectedError 'must be compact JSON'
  Assert-RejectedCredential -Name 'unknown JSON field' -CredentialJson (New-CredentialJson -PfxPath $validPfx -Extra @{ extra = 'rejected' }) -ExpectedError 'only pfxBase64 and password'
  Assert-RejectedCredential -Name 'wrong password' -CredentialJson (New-CredentialJson -PfxPath $validPfx -PfxPassword 'wrong') -ExpectedError 'could not be opened'

  $expiredPfx = Join-Path $testRoot 'expired.pfx'
  $null = New-TestPfx -Path $expiredPfx -NotBefore ([DateTime]::UtcNow.AddDays(-3)) -NotAfter ([DateTime]::UtcNow.AddDays(-2))
  Assert-RejectedCredential -Name 'expired certificate' -CredentialJson (New-CredentialJson -PfxPath $expiredPfx) -ExpectedError 'not currently valid'

  $weakPfx = Join-Path $testRoot 'weak-rsa.pfx'
  $null = New-TestPfx -Path $weakPfx -KeySize 1024
  Assert-RejectedCredential -Name 'RSA 1024 certificate' -CredentialJson (New-CredentialJson -PfxPath $weakPfx) -ExpectedError 'at least 2048 bits'

  $ecdsaPfx = Join-Path $testRoot 'ecdsa.pfx'
  $null = New-TestPfx -Path $ecdsaPfx -Algorithm ECDSA
  Assert-RejectedCredential -Name 'ECDSA certificate' -CredentialJson (New-CredentialJson -PfxPath $ecdsaPfx) -ExpectedError 'RSA private key'

  $missingEkuPfx = Join-Path $testRoot 'missing-eku.pfx'
  $null = New-TestPfx -Path $missingEkuPfx -IncludeCodeSigningEku $false
  Assert-RejectedCredential -Name 'certificate without Code Signing EKU' -CredentialJson (New-CredentialJson -PfxPath $missingEkuPfx) -ExpectedError 'Code Signing EKU'

  $missingUsagePfx = Join-Path $testRoot 'missing-digital-signature.pfx'
  $null = New-TestPfx -Path $missingUsagePfx -IncludeDigitalSignature $false
  Assert-RejectedCredential -Name 'certificate without DigitalSignature usage' -CredentialJson (New-CredentialJson -PfxPath $missingUsagePfx) -ExpectedError 'DigitalSignature key usage'

  $publicOnlyPfx = Join-Path $testRoot 'public-only.pfx'
  $null = New-TestPfx -Path $publicOnlyPfx -PublicOnly
  Assert-RejectedCredential -Name 'certificate without private key' -CredentialJson (New-CredentialJson -PfxPath $publicOnlyPfx) -ExpectedError 'private key'

  $explicitTool = Join-Path $testRoot 'explicit\signtool.exe'
  $null = New-Item -ItemType Directory -Path (Split-Path -Parent $explicitTool)
  $null = New-Item -ItemType File -Path $explicitTool
  $explicitResult = Invoke-SignScript -Arguments @('-ResolveSignTool', '-SignToolPath', $explicitTool)
  Assert-True ($explicitResult.ExitCode -eq 0 -and $explicitResult.Stdout -eq $explicitTool) 'explicit signtool path was not selected'
  $passed.Add('explicit signtool path')

  $pathToolDir = Join-Path $testRoot 'path-tool'
  $null = New-Item -ItemType Directory -Path $pathToolDir
  $pathTool = Join-Path $pathToolDir 'signtool.exe'
  $null = New-Item -ItemType File -Path $pathTool
  $pathResult = Invoke-SignScript -Arguments @('-ResolveSignTool') -Environment @{ PATH = "$pathToolDir;$env:PATH" }
  Assert-True ($pathResult.ExitCode -eq 0 -and $pathResult.Stdout -eq $pathTool) 'PATH signtool was not selected'
  $passed.Add('PATH signtool')

  $kitsRoot = Join-Path $testRoot 'program-files-x86'
  $olderTool = Join-Path $kitsRoot 'Windows Kits\10\bin\10.0.19041.0\x64\signtool.exe'
  $newerTool = Join-Path $kitsRoot 'Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe'
  $null = New-Item -ItemType Directory -Path (Split-Path -Parent $olderTool) -Force
  $null = New-Item -ItemType Directory -Path (Split-Path -Parent $newerTool) -Force
  $null = New-Item -ItemType File -Path $olderTool
  $null = New-Item -ItemType File -Path $newerTool
  $kitsResult = Invoke-SignScript -Arguments @('-ResolveSignTool', '-WindowsKitsRoot', $kitsRoot) -Environment @{ PATH = '' }
  Assert-True ($kitsResult.ExitCode -eq 0 -and $kitsResult.Stdout -eq $newerTool) 'newest Windows Kits signtool was not selected'
  $passed.Add('Windows Kits newest x64 signtool')

  $appKitRoot = Join-Path $testRoot 'app-kit-root'
  $appKitTool = Join-Path $appKitRoot 'Windows Kits\10\App Certification Kit\signtool.exe'
  $null = New-Item -ItemType Directory -Path (Split-Path -Parent $appKitTool) -Force
  $null = New-Item -ItemType File -Path $appKitTool
  $appKitResult = Invoke-SignScript -Arguments @('-ResolveSignTool', '-WindowsKitsRoot', $appKitRoot) -Environment @{ PATH = '' }
  Assert-True ($appKitResult.ExitCode -eq 0 -and $appKitResult.Stdout -eq $appKitTool) 'App Certification Kit signtool fallback was not selected'
  $passed.Add('App Certification Kit signtool')

  $missingResult = Invoke-SignScript -Arguments @('-ResolveSignTool', '-WindowsKitsRoot', (Join-Path $testRoot 'missing-kits')) -Environment @{ PATH = '' }
  Assert-True ($missingResult.ExitCode -ne 0 -and (($missingResult.Stdout + $missingResult.Stderr) -match 'signtool.exe is required')) 'missing signtool did not fail closed'
  $passed.Add('missing signtool rejected')

  foreach ($name in $passed) { Write-Output "PASS: $name" }
  Write-Output "Northwing release credential tests passed: $($passed.Count)"
} finally {
  Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
}
