Unicode true
RequestExecutionLevel user

!include "MUI2.nsh"
!include "FileFunc.nsh"

!define APP_NAME "Northwing"
!ifndef APP_VERSION
  !define APP_VERSION "0.1.0"
!endif
!define APP_PUBLISHER "Northwing Contributors"
!define APP_ID "io.github.holobunganansketch.northwing"
!define APP_EXE "northwing.exe"

Name "${APP_NAME}"
OutFile "Northwing-${APP_VERSION}-windows-x64-setup.exe"
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
  File "..\..\desktop\build\bin\northwing.exe"
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

Section "Uninstall"
  SetShellVarContext current
  Delete "$SMPROGRAMS\Northwing\Northwing.lnk"
  Delete "$SMPROGRAMS\Northwing\Uninstall Northwing.lnk"
  RMDir "$SMPROGRAMS\Northwing"
  DeleteRegKey HKCU "Software\Classes\northwing"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
  DeleteRegKey HKCU "Software\Northwing"
  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
SectionEnd
