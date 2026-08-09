$ErrorActionPreference = "Stop"

$resolver = Join-Path $PSScriptRoot "resolve-northwing-product-version.ps1"
$scratch = Join-Path ([IO.Path]::GetTempPath()) "northwing-version-resolver-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $scratch | Out-Null

function Invoke-VersionResolver([string]$Content) {
  $config = Join-Path $scratch "$([guid]::NewGuid().ToString('N')).json"
  [IO.File]::WriteAllText($config, $Content, [Text.UTF8Encoding]::new($false))
  $output = & pwsh -NoProfile -File $resolver -WailsConfig $config 2>&1
  return [PSCustomObject]@{
    ExitCode = $LASTEXITCODE
    Output = ($output -join "`n").Trim()
  }
}

function Invoke-WorkflowVersionCapture([string]$Content) {
  $config = Join-Path $scratch "$([guid]::NewGuid().ToString('N')).json"
  $githubOutput = Join-Path $scratch "$([guid]::NewGuid().ToString('N')).output"
  $capture = Join-Path $scratch "$([guid]::NewGuid().ToString('N')).ps1"
  [IO.File]::WriteAllText($config, $Content, [Text.UTF8Encoding]::new($false))
  $escapedResolver = $resolver.Replace("'", "''")
  $escapedConfig = $config.Replace("'", "''")
  $escapedOutput = $githubOutput.Replace("'", "''")
  @"
`$env:GITHUB_OUTPUT = '$escapedOutput'
`$version = & '$escapedResolver' -WailsConfig '$escapedConfig'
"version=`$version" | Out-File -FilePath `$env:GITHUB_OUTPUT -Encoding utf8 -Append
"@ | Set-Content -LiteralPath $capture -Encoding utf8
  $output = & pwsh -NoProfile -File $capture 2>&1
  return [PSCustomObject]@{
    ExitCode = $LASTEXITCODE
    Output = ($output -join "`n").Trim()
    GitHubOutput = if (Test-Path -LiteralPath $githubOutput) { (Get-Content -LiteralPath $githubOutput -Raw).Trim() } else { "" }
  }
}

try {
  $validContent = '{"info":{"productVersion":"0.3.0"}}'
  $valid = Invoke-VersionResolver $validContent
  if ($valid.ExitCode -ne 0 -or $valid.Output -ne "0.3.0") {
    throw "stable product version resolution = exit $($valid.ExitCode), output $($valid.Output)"
  }

  $workflowConfig = Join-Path $scratch "workflow-capture.json"
  [IO.File]::WriteAllText($workflowConfig, $validContent, [Text.UTF8Encoding]::new($false))
  $workflowVersion = & $resolver -WailsConfig $workflowConfig
  if (($workflowVersion -join "").Trim() -ne "0.3.0") {
    throw "workflow version capture = $workflowVersion, want 0.3.0"
  }

  $workflowValid = Invoke-WorkflowVersionCapture $validContent
  $workflowLines = @($workflowValid.GitHubOutput -split "`r?`n" | Where-Object { $_.Length -gt 0 })
  if ($workflowValid.ExitCode -ne 0 -or $workflowLines.Count -ne 1 -or $workflowLines[0] -ne "version=0.3.0") {
    throw "workflow output = exit $($workflowValid.ExitCode), value $($workflowValid.GitHubOutput)"
  }

  $workflowEmpty = Invoke-WorkflowVersionCapture '{"info":{"productVersion":""}}'
  if ($workflowEmpty.ExitCode -eq 0) {
    throw "workflow capture accepted an empty product version"
  }

  foreach ($content in @(
    '{"info":{"productVersion":""}}',
    '{"info":{"productVersion":" 0.3.0 "}}',
    '{"info":{"productVersion":"0.3.0\n"}}',
    '{"info":{"productVersion":"0.3.0-rc.1"}}',
    '{"info":{"productVersion":"00.3.0"}}'
  )) {
    $invalid = Invoke-VersionResolver $content
    if ($invalid.ExitCode -eq 0) {
      throw "invalid product version was accepted: $content"
    }
  }
} finally {
  Remove-Item -LiteralPath $scratch -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Northwing product version resolver tests passed."
exit 0
