Unicode true
RequestExecutionLevel user

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "StrFunc.nsh"
${StrStr}

!define APP_NAME "Northwing"
!ifndef APP_VERSION
  !error "APP_VERSION must be supplied by the packaging command"
!endif
!ifndef APP_SOURCE_EXE
  !define APP_SOURCE_EXE "${__FILEDIR__}\..\..\desktop\build\bin\northwing.exe"
!endif
!ifndef APP_UPDATE_HELPER
  !define APP_UPDATE_HELPER "${__FILEDIR__}\..\..\desktop\build\bin\northwing-update-helper.exe"
!endif
!define APP_PUBLISHER "Northwing Contributors"
!define APP_ID "io.github.holobunganansketch.northwing"
!define APP_EXE "northwing.exe"
!define APP_HELPER "northwing-update-helper.exe"

Name "${APP_NAME}"
OutFile "${__FILEDIR__}\..\..\Northwing-${APP_VERSION}-windows-x64-setup.exe"
Icon "${__FILEDIR__}\..\..\desktop\build\windows\icon.ico"
UninstallIcon "${__FILEDIR__}\..\..\desktop\build\windows\icon.ico"
InstallDir "$LOCALAPPDATA\Programs\Northwing"
InstallDirRegKey HKCU "Software\Northwing" "InstallDir"
BrandingText "Northwing — From intent to finished work."

!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "SimpChinese"

Section "Northwing" SEC_MAIN
  SetShellVarContext current
  SetOutPath "$INSTDIR"

  Call NorthwingAbortForRunningApp

  ; Keep an exact previous executable until the replacement has succeeded.
  ; This prevents a failed overwrite from leaving a missing or partial app.
  Delete "$INSTDIR\${APP_EXE}.previous"
  StrCpy $R1 "0"
  IfFileExists "$INSTDIR\${APP_EXE}" 0 NorthwingNoPrevious
  ClearErrors
  CopyFiles /SILENT "$INSTDIR\${APP_EXE}" "$INSTDIR\${APP_EXE}.previous"
  IfErrors NorthwingNoPrevious 0
  StrCpy $R1 "1"

NorthwingNoPrevious:
  SetOverwrite try
  StrCpy $R0 0

NorthwingRetryExecutable:
  ClearErrors
  File /oname=${APP_EXE} "${APP_SOURCE_EXE}"
  IfErrors 0 NorthwingExecutableInstalled
  IntOp $R0 $R0 + 1
  IfSilent NorthwingSilentRetry NorthwingInteractiveRetry

NorthwingSilentRetry:
  IntCmp $R0 40 NorthwingReplacementFailed NorthwingSilentContinue NorthwingReplacementFailed
NorthwingSilentContinue:
  Sleep 500
  Goto NorthwingRetryExecutable

NorthwingInteractiveRetry:
  MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "northwing.exe is still running. Close Northwing, then choose Retry. Cancel restores the previous executable." IDRETRY NorthwingRetryExecutable IDCANCEL NorthwingReplacementFailed

NorthwingReplacementFailed:
  Delete "$INSTDIR\${APP_EXE}"
  ${If} $R1 == "1"
    Rename "$INSTDIR\${APP_EXE}.previous" "$INSTDIR\${APP_EXE}"
  ${EndIf}
  SetOverwrite on
  Abort "Northwing could not replace northwing.exe. The previous executable was preserved."

NorthwingExecutableInstalled:
  SetOverwrite on
  Delete "$INSTDIR\${APP_EXE}.previous"
  File /oname=${APP_HELPER} "${APP_UPDATE_HELPER}"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  WriteRegStr HKCU "Software\Northwing" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "NoRepair" 1

  CreateDirectory "$SMPROGRAMS\Northwing"
  CreateShortcut "$SMPROGRAMS\Northwing\Northwing.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortcut "$SMPROGRAMS\Northwing\Uninstall Northwing.lnk" "$INSTDIR\Uninstall.exe"

  ; Per-user URL protocol registration. Windows passes the full URI as %1.
  WriteRegStr HKCU "Software\Classes\northwing" "" "URL:Northwing Protocol"
  WriteRegStr HKCU "Software\Classes\northwing" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\northwing\DefaultIcon" "" "$INSTDIR\${APP_EXE},0"
  WriteRegStr HKCU "Software\Classes\northwing\shell\open\command" "" '"$INSTDIR\${APP_EXE}" "%1"'
SectionEnd

Function NorthwingAbortForRunningApp
  ; The helper owns normal application shutdown for updates. tasklist itself
  ; returns zero when no task matches, so inspect its short filtered CSV output.
  nsExec::ExecToStack '"$SYSDIR\tasklist.exe" /FI "IMAGENAME eq ${APP_EXE}" /NH /FO CSV'
  Pop $R8
  Pop $R9
  ${StrStr} $R7 $R9 "${APP_EXE}"
  StrCmp $R7 "" NorthwingNoRunningApp NorthwingAppIsRunning

NorthwingAppIsRunning:
  IfSilent NorthwingSilentRunningApp NorthwingInteractiveRunningApp

NorthwingSilentRunningApp:
  Abort "Northwing update: application is still running."

NorthwingInteractiveRunningApp:
  MessageBox MB_OK|MB_ICONSTOP "Northwing is still running. Close Northwing manually, then run the installer again. The current installation has not been modified."
  Abort "Northwing update: application is still running."

NorthwingNoRunningApp:
FunctionEnd

Section "Uninstall"
  SetShellVarContext current
  nsExec::ExecToStack 'taskkill /IM ${APP_EXE}'
  Pop $R8
  Pop $R9
  Sleep 500
  Delete "$SMPROGRAMS\Northwing\Northwing.lnk"
  Delete "$SMPROGRAMS\Northwing\Uninstall Northwing.lnk"
  RMDir "$SMPROGRAMS\Northwing"
  DeleteRegKey HKCU "Software\Classes\northwing"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
  DeleteRegKey HKCU "Software\Northwing"
  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\${APP_EXE}.previous"
  Delete "$INSTDIR\${APP_HELPER}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
SectionEnd
