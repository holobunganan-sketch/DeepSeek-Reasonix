[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ExePath,
  [string]$ExpectedTitle = "Northwing",
  [int]$ExpectedWidth = 1240,
  [int]$ExpectedHeight = 720,
  [int]$MinimumWidth = 760,
  [int]$MinimumHeight = 480,
  [string]$EvidencePath,
  [string]$ScreenshotPath,
  [switch]$RequireInteractiveWindow
)

$ErrorActionPreference = "Stop"
$exe = [IO.Path]::GetFullPath($ExePath)
if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) {
  throw "Northwing executable is missing: $exe"
}
if ([string]::IsNullOrWhiteSpace($EvidencePath)) {
  $EvidencePath = Join-Path (Split-Path -Parent $exe) "northwing-native-smoke.json"
}
$EvidencePath = [IO.Path]::GetFullPath($EvidencePath)
if (-not [string]::IsNullOrWhiteSpace($ScreenshotPath)) {
  $ScreenshotPath = [IO.Path]::GetFullPath($ScreenshotPath)
}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

namespace NorthwingNativeSmoke {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  public static class NativeMethods {
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SystemParametersInfo(
      uint action,
      uint parameter,
      out RECT value,
      uint flags
    );

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsZoomed(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int command);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr SendMessageTimeout(
      IntPtr hWnd,
      uint message,
      IntPtr wParam,
      IntPtr lParam,
      uint flags,
      uint timeout,
      out IntPtr result
    );
  }
}
"@

function Wait-Until([scriptblock]$Condition, [int]$TimeoutMilliseconds = 15000) {
  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
  do {
    if (& $Condition) { return $true }
    Start-Sleep -Milliseconds 100
  } while ([DateTime]::UtcNow -lt $deadline)
  return $false
}

function Save-Evidence([System.Collections.IDictionary]$Evidence) {
  $parent = Split-Path -Parent $EvidencePath
  if (-not [string]::IsNullOrWhiteSpace($parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  $Evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $EvidencePath -Encoding utf8
}

$evidence = [ordered]@{
  executable = $exe
  expectedTitle = $ExpectedTitle
  expectedClientSize = [ordered]@{ width = $ExpectedWidth; height = $ExpectedHeight }
  minimumClientSize = [ordered]@{ width = $MinimumWidth; height = $MinimumHeight }
  workArea = $null
  effectiveExpectedClientSize = $null
  clientSizeMode = $null
  interactiveWindow = $false
  title = $null
  clientSize = $null
  visible = $false
  minimize = $false
  maximize = $false
  restore = $false
  secondLaunch = $false
  normalClose = $false
  screenshot = $null
  status = "starting"
  error = $null
  checkedAtUtc = [DateTime]::UtcNow.ToString("o")
}

$scratch = Join-Path ([IO.Path]::GetTempPath()) "northwing-native-smoke-$([guid]::NewGuid().ToString('N'))"
$runtimeHome = Join-Path $scratch "runtime home"
$runtimeState = Join-Path $scratch "runtime state"
$runtimeCache = Join-Path $scratch "runtime cache"
$runtimeEnvironment = @{
  REASONIX_HOME = $runtimeHome
  REASONIX_STATE_HOME = $runtimeState
  REASONIX_CACHE_HOME = $runtimeCache
}
$previousRuntimeEnvironment = @{}
$process = $null
$secondProcess = $null

try {
  New-Item -ItemType Directory -Force -Path $runtimeHome, $runtimeState, $runtimeCache | Out-Null
  @"
[desktop]
close_behavior = "quit"
telemetry = false
metrics = false
check_updates = false
"@ | Set-Content -LiteralPath (Join-Path $runtimeHome "config.toml") -Encoding utf8
  foreach ($name in $runtimeEnvironment.Keys) {
    $previousRuntimeEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
    [Environment]::SetEnvironmentVariable($name, $runtimeEnvironment[$name], "Process")
  }

  $process = Start-Process -FilePath $exe -PassThru
  $windowReady = Wait-Until {
    if ($process.HasExited) { return $false }
    $process.Refresh()
    return $process.MainWindowHandle -ne [IntPtr]::Zero
  } 20000

  if (-not $windowReady) {
    if ($process.HasExited) {
      throw "Northwing exited before creating a top-level window (exit $($process.ExitCode))"
    }
    $evidence.status = "interactive-window-unavailable"
    $message = "Northwing has no interactive top-level window in this runner session"
    $evidence.error = $message
    if ($RequireInteractiveWindow) { throw $message }
    Write-Warning $message
    return
  }

  $handle = $process.MainWindowHandle
  $evidence.interactiveWindow = $true
  $evidence.visible = [NorthwingNativeSmoke.NativeMethods]::IsWindowVisible($handle)
  if (-not $evidence.visible) { throw "Northwing top-level window is not visible" }

  $titleBuffer = [Text.StringBuilder]::new(512)
  [void][NorthwingNativeSmoke.NativeMethods]::GetWindowText($handle, $titleBuffer, $titleBuffer.Capacity)
  $evidence.title = $titleBuffer.ToString()
  if ($evidence.title -ne $ExpectedTitle) {
    throw "Northwing window title is '$($evidence.title)'; expected '$ExpectedTitle'"
  }

  $clientRect = [NorthwingNativeSmoke.RECT]::new()
  if (-not [NorthwingNativeSmoke.NativeMethods]::GetClientRect($handle, [ref]$clientRect)) {
    throw "GetClientRect failed with Win32 error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
  }
  $clientWidth = $clientRect.Right - $clientRect.Left
  $clientHeight = $clientRect.Bottom - $clientRect.Top
  $evidence.clientSize = [ordered]@{ width = $clientWidth; height = $clientHeight }

  # Hosted Windows runners can expose an interactive desktop whose work area is
  # narrower than Northwing's 1240px default. Windows legitimately clamps a new
  # top-level window in that case. Query the real work area so this condition is
  # recorded and distinguished from a regression that creates an undersized or
  # arbitrarily sized window. Win32 can include an invisible resize border in
  # the reported client/window relationship, hence the 32px constrained margin.
  $workAreaRect = [NorthwingNativeSmoke.RECT]::new()
  $SPI_GETWORKAREA = 0x0030
  if (-not [NorthwingNativeSmoke.NativeMethods]::SystemParametersInfo($SPI_GETWORKAREA, 0, [ref]$workAreaRect, 0)) {
    throw "SystemParametersInfo(SPI_GETWORKAREA) failed with Win32 error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
  }
  $workAreaWidth = $workAreaRect.Right - $workAreaRect.Left
  $workAreaHeight = $workAreaRect.Bottom - $workAreaRect.Top
  $effectiveWidth = [Math]::Min($ExpectedWidth, $workAreaWidth)
  $effectiveHeight = [Math]::Min($ExpectedHeight, $workAreaHeight)
  $widthConstrained = $workAreaWidth -lt ($ExpectedWidth - 8)
  $heightConstrained = $workAreaHeight -lt ($ExpectedHeight - 8)
  $evidence.workArea = [ordered]@{ width = $workAreaWidth; height = $workAreaHeight }
  $evidence.effectiveExpectedClientSize = [ordered]@{ width = $effectiveWidth; height = $effectiveHeight }
  $evidence.clientSizeMode = if ($widthConstrained -or $heightConstrained) { "work-area-constrained" } else { "exact-default" }

  if ($clientWidth -lt $MinimumWidth -or $clientHeight -lt $MinimumHeight) {
    throw "Northwing client size is ${clientWidth}x${clientHeight}; minimum is ${MinimumWidth}x${MinimumHeight}"
  }
  if (-not $widthConstrained -and [Math]::Abs($clientWidth - $ExpectedWidth) -gt 8) {
    throw "Northwing client width is $clientWidth; expected $ExpectedWidth (±8)"
  }
  if (-not $heightConstrained -and [Math]::Abs($clientHeight - $ExpectedHeight) -gt 8) {
    throw "Northwing client height is $clientHeight; expected $ExpectedHeight (±8)"
  }
  if ($widthConstrained -and ($clientWidth -lt ($effectiveWidth - 32) -or $clientWidth -gt ($ExpectedWidth + 8))) {
    throw "Northwing client width is $clientWidth; expected an OS-clamped width near $effectiveWidth (work area $workAreaWidth)"
  }
  if ($heightConstrained -and ($clientHeight -lt ($effectiveHeight - 32) -or $clientHeight -gt ($ExpectedHeight + 8))) {
    throw "Northwing client height is $clientHeight; expected an OS-clamped height near $effectiveHeight (work area $workAreaHeight)"
  }

  Start-Sleep -Seconds 3
  if (-not [string]::IsNullOrWhiteSpace($ScreenshotPath)) {
    $windowRect = [NorthwingNativeSmoke.RECT]::new()
    if (-not [NorthwingNativeSmoke.NativeMethods]::GetWindowRect($handle, [ref]$windowRect)) {
      throw "GetWindowRect failed before screenshot"
    }
    Add-Type -AssemblyName System.Drawing
    $width = $windowRect.Right - $windowRect.Left
    $height = $windowRect.Bottom - $windowRect.Top
    $bitmap = [Drawing.Bitmap]::new($width, $height)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.CopyFromScreen($windowRect.Left, $windowRect.Top, 0, 0, $bitmap.Size)
      $screenshotParent = Split-Path -Parent $ScreenshotPath
      if (-not [string]::IsNullOrWhiteSpace($screenshotParent)) {
        New-Item -ItemType Directory -Force -Path $screenshotParent | Out-Null
      }
      $bitmap.Save($ScreenshotPath, [Drawing.Imaging.ImageFormat]::Png)
      $evidence.screenshot = $ScreenshotPath
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }

  # SW_MINIMIZE = 6, SW_MAXIMIZE = 3, SW_RESTORE = 9.
  [void][NorthwingNativeSmoke.NativeMethods]::ShowWindowAsync($handle, 6)
  if (-not (Wait-Until { [NorthwingNativeSmoke.NativeMethods]::IsIconic($handle) } 5000)) {
    throw "Northwing did not enter minimized state"
  }
  $evidence.minimize = $true

  [void][NorthwingNativeSmoke.NativeMethods]::ShowWindowAsync($handle, 9)
  if (-not (Wait-Until { -not [NorthwingNativeSmoke.NativeMethods]::IsIconic($handle) } 5000)) {
    throw "Northwing did not restore from minimized state"
  }

  [void][NorthwingNativeSmoke.NativeMethods]::ShowWindowAsync($handle, 3)
  if (-not (Wait-Until { [NorthwingNativeSmoke.NativeMethods]::IsZoomed($handle) } 5000)) {
    throw "Northwing did not enter maximized state"
  }
  $evidence.maximize = $true

  [void][NorthwingNativeSmoke.NativeMethods]::ShowWindowAsync($handle, 9)
  if (-not (Wait-Until { -not [NorthwingNativeSmoke.NativeMethods]::IsZoomed($handle) } 5000)) {
    throw "Northwing did not restore from maximized state"
  }
  $evidence.restore = $true

  $secondProcess = Start-Process -FilePath $exe -PassThru
  if (-not $secondProcess.WaitForExit(15000)) {
    throw "A second Northwing launch did not hand off to the existing single instance"
  }
  $secondProcess.WaitForExit()
  if ($secondProcess.ExitCode -ne 0) {
    throw "Second Northwing launch exited $($secondProcess.ExitCode)"
  }
  if ($process.HasExited) { throw "Second launch terminated the original Northwing instance" }
  $evidence.secondLaunch = $true

  # WM_CLOSE is a normal top-level-window close request, not process termination.
  $WM_CLOSE = 0x0010
  $sendResult = [IntPtr]::Zero
  $sent = [NorthwingNativeSmoke.NativeMethods]::SendMessageTimeout(
    $handle,
    $WM_CLOSE,
    [IntPtr]::Zero,
    [IntPtr]::Zero,
    0x0002,
    5000,
    [ref]$sendResult
  )
  if ($sent -eq [IntPtr]::Zero) {
    throw "WM_CLOSE failed with Win32 error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
  }
  if (-not $process.WaitForExit(15000)) {
    throw "Northwing did not exit normally after WM_CLOSE"
  }
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) {
    throw "Northwing exited $($process.ExitCode) after WM_CLOSE"
  }
  $evidence.normalClose = $true
  $evidence.status = "passed"
} catch {
  $evidence.status = "failed"
  $evidence.error = $_.Exception.Message
  throw
} finally {
  if ($secondProcess -and -not $secondProcess.HasExited) {
    Stop-Process -Id $secondProcess.Id -Force -ErrorAction SilentlyContinue
    $secondProcess.WaitForExit()
  }
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    $process.WaitForExit()
  }
  foreach ($name in $runtimeEnvironment.Keys) {
    [Environment]::SetEnvironmentVariable($name, $previousRuntimeEnvironment[$name], "Process")
  }
  Save-Evidence $evidence
  Remove-Item -LiteralPath $scratch -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Northwing native window smoke passed: $EvidencePath"
