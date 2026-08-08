# Northwing release signing helper.
# This script documents the required signing steps for a formal Northwing
# release on Windows. It expects a code-signing certificate or a configured
# SignPath / trusted signing service.
#
# Without a signing credential, formal release artifacts MUST NOT be published.
# Unsigned builds remain available for CI and developer testing.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern("^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$")]
    [string]$Version,

    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Container })]
    [string]$ArtifactDir,

    [string]$CertificatePath,
    [string]$TimestampServer = "http://timestamp.digicert.com",
    [ValidateSet("present", "missing", "service")]
    [string]$SigningMode = "service"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

$setup = Join-Path $ArtifactDir "Northwing-$Version-windows-x64-setup.exe"
$portableZip = Join-Path $ArtifactDir "Northwing-$Version-windows-x64-portable.zip"
$manifestPath = Join-Path $ArtifactDir "northwing-update.json"
$manifestSigPath = Join-Path $ArtifactDir "northwing-update.json.sig"

$required = @($setup, $portableZip, $manifestPath)
foreach ($f in $required) {
    if (-not (Test-Path -LiteralPath $f -PathType Leaf)) {
        throw "Missing required artifact: $f"
    }
}

switch ($SigningMode) {
    "missing" {
        Write-Host "Skipping signing: no signing credential was provided."
        Write-Host "This build is suitable for CI testing only, not for formal release."
        Write-Host ""
        Write-Host "To publish a formal Northwing release, configure one of:"
        Write-Host "  1. SIGNPATH_API_TOKEN (SignPath remote signing)"
        Write-Host "  2. A code-signing certificate and --CertificatePath"
        Write-Host "  3. AZURE_TRUSTED_SIGNING_* (Azure Trusted Signing)"
        Write-Host ""
        Write-Host "Without a signing credential, do not create northwing-vX.Y.Z tags."
        exit 0
    }

    "present" {
        if (-not $CertificatePath -or -not (Test-Path -LiteralPath $CertificatePath -PathType Leaf)) {
            throw "CertificatePath must point to an existing .pfx file when SigningMode is present"
        }
        Write-Host "Signing with local certificate: $CertificatePath"
        $signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
        if (-not $signtool) {
            $signtoolDirs = @(
                "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64",
                "${env:ProgramFiles(x86)}\Windows Kits\10\App Certification Kit"
            )
            foreach ($dir in $signtoolDirs) {
                $candidate = Get-ChildItem -Path $dir -Filter "signtool.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($candidate) { $signtool = $candidate.FullName; break }
            }
        }
        if (-not $signtool) {
            throw "signtool.exe not found. Install the Windows SDK or set --SigningMode service."
        }

        $toSign = @($setup)
        if (Test-Path (Join-Path $ArtifactDir "northwing-update-helper.exe")) {
            $toSign += Join-Path $ArtifactDir "northwing-update-helper.exe"
        }

        foreach ($file in $toSign) {
            Write-Host "Signing: $file"
            & $signtool sign /fd SHA256 /f $CertificatePath /tr $TimestampServer /td SHA256 /v $file
            if ($LASTEXITCODE -ne 0) {
                throw "signtool failed on $file with code $LASTEXITCODE"
            }
        }

        # Sign update manifest with RSA detached signature
        # Requires openssl or equivalent. Skip if not available.
        $openssl = Get-Command openssl.exe -ErrorAction SilentlyContinue
        if ($openssl) {
            $certPem = Join-Path $env:TEMP "northwing-sign-cert.pem"
            $keyPem = Join-Path $env:TEMP "northwing-sign-key.pem"
            try {
                & $openssl pkcs12 -in $CertificatePath -clcerts -nokeys -out $certPem -passin pass: | Out-Null
                & $openssl pkcs12 -in $CertificatePath -nocerts -nodes -out $keyPem -passin pass: | Out-Null
                & $openssl dgst -sha256 -sign $keyPem -out $manifestSigPath $manifestPath
                if ($LASTEXITCODE -ne 0) {
                    Write-Warning "Manifest detached signature failed; the manifest will be unsigned."
                } else {
                    Write-Host "Signed update manifest: $manifestSigPath"
                }
            } finally {
                Remove-Item -LiteralPath $certPem, $keyPem -Force -ErrorAction SilentlyContinue
            }
        } else {
            Write-Warning "openssl not found; update manifest detached signature was skipped."
        }
    }

    "service" {
        Write-Host "Signing delegated to CI signing service (SignPath / Azure Trusted Signing)."
        Write-Host "Verify that the CI workflow has completed the signing step with:"
        Write-Host "  signtool verify /pa /all $setup"
    }
}

# Verify signatures after signing
$signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
if (-not $signtool) {
    $signtoolDirs = @(
        "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64",
        "${env:ProgramFiles(x86)}\Windows Kits\10\App Certification Kit"
    )
    foreach ($dir in $signtoolDirs) {
        $candidate = Get-ChildItem -Path $dir -Filter "signtool.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($candidate) { $signtool = $candidate.FullName; break }
    }
}

if ($signtool -and $SigningMode -ne "missing") {
    Write-Host ""
    Write-Host "Verifying Authenticode signatures:"
    foreach ($file in @($setup)) {
        Write-Host "  $file"
        & $signtool verify /pa /all $file
        if ($LASTEXITCODE -ne 0) {
            throw "signtool verify failed on $file with code $LASTEXITCODE"
        }
    }
}

Write-Host ""
Write-Host "Northwing $Version signing complete."
