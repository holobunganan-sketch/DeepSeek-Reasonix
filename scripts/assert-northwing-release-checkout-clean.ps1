[CmdletBinding()]
param(
  [string]$RepositoryRoot = '.'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $RepositoryRoot -PathType Container)) {
  throw "release checkout is missing: $RepositoryRoot"
}

Push-Location -LiteralPath $RepositoryRoot
try {
  git diff --check
  if ($LASTEXITCODE -ne 0) {
    throw 'release checkout contains invalid whitespace'
  }
  $changes = @(git status --porcelain --untracked-files=all)
  if ($LASTEXITCODE -ne 0) {
    throw 'release checkout status could not be read'
  }
  if ($changes.Count -ne 0) {
    throw "release checkout contains unexpected inputs: $($changes -join '; ')"
  }
} finally {
  Pop-Location
}
