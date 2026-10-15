Unicode True

; --------------------------------
; CS Trim Windows Installer Script
; Modern UI 2 (MUI2) with Hebrew & English Support
; --------------------------------

!include "MUI2.nsh"

Name "CS Trim"
OutFile "website/download/CS-Trim-v1.0.0-Windows-Setup.exe"
InstallDir "$APPDATA\Adobe\CEP\extensions\com.autocut.panel"
InstallDirRegKey HKCU "Software\CS Trim" "Install_Dir"
RequestExecutionLevel user

; --------------------------------
; Interface Settings
; --------------------------------
!define MUI_ABORTWARNING
!define MUI_ICON "img/logo.ico"

; --------------------------------
; Pages
; --------------------------------
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_FINISHPAGE_TITLE "ההתקנה הושלמה בהצלחה!"
!define MUI_FINISHPAGE_TEXT "CS Trim הותקן בהצלחה עבור Adobe Premiere Pro.$\r$\n$\r$\nכעת פתח את Premiere Pro והיכנס ל:$\r$\nWindow > Extensions > CS Trim"
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; --------------------------------
; Languages
; --------------------------------
!insertmacro MUI_LANGUAGE "Hebrew"
!insertmacro MUI_LANGUAGE "English"

; --------------------------------
; Installer Section
; --------------------------------
Section "CS Trim Extension" SecMain
    SetOutPath "$INSTDIR"

    ; Copy all extension files
    File /r "CSXS"
    File /r "css"
    File /r "host"
    File /r "img"
    File /r "js"
    File "index.html"
    File ".debug"

    ; Write registry keys for Adobe CEP PlayerDebugMode
    WriteRegStr HKCU "Software\Adobe\CSXS.7" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.8" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.9" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.10" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.11" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.12" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.13" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.14" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.15" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.16" "PlayerDebugMode" "1"

    ; Create Uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CSTrim" "DisplayName" "CS Trim for Adobe Premiere Pro"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CSTrim" "UninstallString" '"$INSTDIR\Uninstall.exe"'
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CSTrim" "DisplayVersion" "1.0.0"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CSTrim" "Publisher" "CS Trim"
SectionEnd

; --------------------------------
; Uninstaller Section
; --------------------------------
Section "Uninstall"
    RMDir /r "$INSTDIR"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CSTrim"
    DeleteRegKey HKCU "Software\CS Trim"
SectionEnd
