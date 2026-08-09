[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Tag,
  [string]$WailsConfig = 'desktop/wails.json'
)

$ErrorActionPreference = 'Stop'

if ($Tag -notmatch '^northwing-v(?<version>(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))$') {
  throw 'Northwing release tag must be stable'
}

$version = $Matches.version
$product = & (Join-Path $PSScriptRoot 'resolve-northwing-product-version.ps1') -WailsConfig $WailsConfig
if ($product -ne $version) {
  throw "tag version $version does not match product version $product"
}

Write-Output $version
