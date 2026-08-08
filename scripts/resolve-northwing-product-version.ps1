param(
  [string]$WailsConfig = "desktop/wails.json"
)

function Fail-VersionResolution([string]$Message) {
  throw "Northwing product version: $Message"
}

if (-not (Test-Path -LiteralPath $WailsConfig -PathType Leaf)) {
  Fail-VersionResolution "wails config is missing: $WailsConfig"
}

try {
  $config = Get-Content -LiteralPath $WailsConfig -Raw | ConvertFrom-Json
} catch {
  Fail-VersionResolution "wails config is not valid JSON: $WailsConfig"
}

$info = $config.PSObject.Properties["info"]
$productVersion = if ($null -ne $info) { $info.Value.PSObject.Properties["productVersion"] } else { $null }
if ($null -eq $productVersion -or -not ($productVersion.Value -is [string])) {
  Fail-VersionResolution "info.productVersion must be a stable SemVer string"
}

$version = $productVersion.Value
if ($version -notmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\z') {
  Fail-VersionResolution "info.productVersion must be a stable SemVer: $version"
}

Write-Output $version
