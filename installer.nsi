Unicode True

; --------------------------------
; CS Trim Windows Installer Script
; Modern UI 2 (MUI2) with Full Metadata & Compatibility
; --------------------------------

!include "MUI2.nsh"

Name "CS Trim"
OutFile "website/download/CS-Trim-Setup.exe"
InstallDir "$APPDATA\Adobe\CEP\extensions\com.autocut.panel"
InstallDirRegKey HKCU "Software\CS Trim" "Install_Dir"
RequestExecutionLevel highest

; --------------------------------
; OS Compatibility & DPI Manifests
; --------------------------------
ManifestSupportedOS all
ManifestDPIAware true

; --------------------------------
; Version Metadata (Prevents Defender & Chrome Heuristic Flags)
; --------------------------------
VIProductVersion "1.0.2.0"
VIAddVersionKey "ProductName" "CS Trim"
VIAddVersionKey "CompanyName" "CS Trim"
VIAddVersionKey "LegalCopyright" "© 2026 CS Trim"
VIAddVersionKey "FileDescription" "CS Trim Extension Installer for Adobe Premiere Pro"
VIAddVersionKey "FileVersion" "1.0.2.0"
VIAddVersionKey "OriginalFilename" "CS-Trim-Setup.exe"
VIAddVersionKey "InternalName" "CS-Trim"

SetCompressor /SOLID lzma

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
!define MUI_FINISHPAGE_TEXT "CS Trim הותקן בהצלחה עבור Adobe Premiere Pro.$\r$\n$\r$\nכעת סגור ופתח מחדש את Premiere Pro והיכנס ל:$\r$\nWindow > Extensions > CS Trim$\r$\n(חלון > הרחבות > CS Trim)"
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
    SetShellVarContext current
    RMDir /r "$INSTDIR"
    SetOutPath "$INSTDIR"

    ; Copy all extension files including bundled binaries to User AppData
    File /r "bin"
    File /r "CSXS"
    File /r "css"
    File /r "host"
    File /r "img"
    File /r "js"
    File "index.html"
    File ".debug"

    ; Also copy to 32-bit Common Files (standard Adobe CEP system extension folder on Windows)
    ClearErrors
    RMDir /r "$COMMONFILES\Adobe\CEP\extensions\com.autocut.panel"
    CreateDirectory "$COMMONFILES\Adobe\CEP\extensions\com.autocut.panel"
    IfErrors skip_common32
    SetOutPath "$COMMONFILES\Adobe\CEP\extensions\com.autocut.panel"
    File /r "bin"
    File /r "CSXS"
    File /r "css"
    File /r "host"
    File /r "img"
    File /r "js"
    File "index.html"
    File ".debug"
skip_common32:

    ; Also copy to 64-bit Common Files if permissions allow
    ClearErrors
    RMDir /r "$COMMONFILES64\Adobe\CEP\extensions\com.autocut.panel"
    CreateDirectory "$COMMONFILES64\Adobe\CEP\extensions\com.autocut.panel"
    IfErrors skip_common64
    SetOutPath "$COMMONFILES64\Adobe\CEP\extensions\com.autocut.panel"
    File /r "bin"
    File /r "CSXS"
    File /r "css"
    File /r "host"
    File /r "img"
    File /r "js"
    File "index.html"
    File ".debug"
skip_common64:
    SetOutPath "$INSTDIR"

    ; Write registry keys for Adobe CEP PlayerDebugMode for CSXS 7 through 20 (HKCU & HKLM)
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
    WriteRegStr HKCU "Software\Adobe\CSXS.17" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.18" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.19" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.20" "PlayerDebugMode" "1"

    WriteRegStr HKLM "Software\Adobe\CSXS.7" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\Adobe\CSXS.8" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\Adobe\CSXS.9" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\Adobe\CSXS.10" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\Adobe\CSXS.11" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\Adobe\CSXS.12" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\Adobe\CSXS.13" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\Adobe\CSXS.14" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\Adobe\CSXS.15" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\Adobe\CSXS.16" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\Adobe\CSXS.17" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\Adobe\CSXS.18" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\Adobe\CSXS.19" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\Adobe\CSXS.20" "PlayerDebugMode" "1"

    WriteRegStr HKLM "Software\WOW6432Node\Adobe\CSXS.7" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\WOW6432Node\Adobe\CSXS.8" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\WOW6432Node\Adobe\CSXS.9" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\WOW6432Node\Adobe\CSXS.10" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\WOW6432Node\Adobe\CSXS.11" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\WOW6432Node\Adobe\CSXS.12" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\WOW6432Node\Adobe\CSXS.13" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\WOW6432Node\Adobe\CSXS.14" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\WOW6432Node\Adobe\CSXS.15" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\WOW6432Node\Adobe\CSXS.16" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\WOW6432Node\Adobe\CSXS.17" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\WOW6432Node\Adobe\CSXS.18" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\WOW6432Node\Adobe\CSXS.19" "PlayerDebugMode" "1"
    WriteRegStr HKLM "Software\WOW6432Node\Adobe\CSXS.20" "PlayerDebugMode" "1"

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
