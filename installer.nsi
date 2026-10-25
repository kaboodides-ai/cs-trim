Unicode True

; --------------------------------
; CS Trim Windows Installer Script
; Modern UI 2 (MUI2) - 100% Hebrew, Friendly & Reassuring
; --------------------------------

!include "MUI2.nsh"

Name "CS Trim"
Caption "התקנת CS Trim עבור Adobe Premiere Pro"
UninstallCaption "הסרת CS Trim"
BrandingText "CS Trim • תוסף חכם לעריכת וידאו בפרמייר"
OutFile "website/download/CS-Trim-Setup.exe"
InstallDir "$APPDATA\Adobe\CEP\extensions\com.autocut.panel"
InstallDirRegKey HKCU "Software\CS Trim" "Install_Dir"
RequestExecutionLevel user

; --------------------------------
; OS Compatibility & DPI Manifests
; --------------------------------
ManifestSupportedOS all
ManifestDPIAware true

; --------------------------------
; Version Metadata (Prevents Defender & Chrome Heuristic Flags)
; --------------------------------
VIProductVersion "1.0.42.0"
VIAddVersionKey "ProductName" "CS Trim"
VIAddVersionKey "CompanyName" "CS Trim"
VIAddVersionKey "LegalCopyright" "© 2026 CS Trim"
VIAddVersionKey "FileDescription" "התקנת תוסף CS Trim עבור Adobe Premiere Pro"
VIAddVersionKey "FileVersion" "1.0.42.0"
VIAddVersionKey "OriginalFilename" "CS-Trim-Setup.exe"
VIAddVersionKey "InternalName" "CS-Trim"

SetCompressor /SOLID lzma

; --------------------------------
; Interface Settings
; --------------------------------
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "האם אתם בטוחים שברצונכם לבטל את התקנת CS Trim?"
!define MUI_ICON "img/logo.ico"
!define MUI_UNICON "img/logo.ico"

; Installer Branding Graphics
!define MUI_WELCOMEFINISHPAGE_BITMAP "img/installer_welcome.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "img/installer_welcome.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "img/installer_header.bmp"
!define MUI_HEADERIMAGE_UNBITMAP "img/installer_header.bmp"

; --------------------------------
; Pages (All Customized in Warm, Reassuring Hebrew)
; --------------------------------

; 1. Welcome Page
!define MUI_WELCOMEPAGE_TITLE "ברוכים הבאים להתקנת CS Trim"
!define MUI_WELCOMEPAGE_TEXT "אשף זה יתקין עבורכם את תוסף CS Trim ב-Adobe Premiere Pro בצורה פשוטה, מהירה ובטוחה.$\r$\n$\r$\nמה CS Trim מעניק לכם?$\r$\n  • חיתוך שקט אוטומטי ומדויק לקטעי וידאו$\r$\n  • כתוביות AI אוטומטיות ומדויקות בעברית$\r$\n  • תהליך עבודה חלק וחיסכון משמעותי בזמן עריכה$\r$\n$\r$\nההתקנה מאובטחת לחלוטין ואינה דורשת הפעלה מחדש של המחשב.$\r$\n$\r$\nלחצו על 'הבא' כדי להתחיל בהתקנה."
!insertmacro MUI_PAGE_WELCOME

; 2. Directory Page
!define MUI_DIRECTORYPAGE_TEXT_TOP "תוסף CS Trim יותקן אוטומטית בתיקיית ההרחבות של Adobe Premiere Pro.$\r$\n$\r$\nנתיב היעד הוגדר מראש ומוכן עבורכם — פשוט לחצו על 'התקן'."
!define MUI_DIRECTORYPAGE_TEXT_DESTINATION "נתיב ההתקנה במחשב:"
!insertmacro MUI_PAGE_DIRECTORY

; 3. Installation Progress Page
!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "ההתקנה הושלמה בהצלחה!"
!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "תוסף CS Trim הותקן ומוכן לשימוש"
!insertmacro MUI_PAGE_INSTFILES

; 4. Finish Page
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_FINISHPAGE_TITLE "איזה כיף! ההתקנה הושלמה בהצלחה 🎉"
!define MUI_FINISHPAGE_TEXT "תוסף CS Trim מותקן כעת ומוכן לעבודה ב-Adobe Premiere Pro!$\r$\n$\r$\nאיך פותחים את התוסף?$\r$\n1. פתחו (או הפעילו מחדש) את Adobe Premiere Pro.$\r$\n2. בתפריט העליון בחרו:$\r$\n   חלון > הרחבות > CS Trim$\r$\n   (Window > Extensions > CS Trim)$\r$\n$\r$\nמאחלים לכם עריכה מהנה ויצירתית!"
!define MUI_FINISHPAGE_BUTTONTEXT "סיום"
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!define MUI_UNTEXT_WELCOME_INFO_TITLE "הסרת תוסף CS Trim"
!define MUI_UNTEXT_WELCOME_INFO_TEXT "אשף זה יסיר את תוסף CS Trim מ-Adobe Premiere Pro במחשב שלכם.$\r$\n$\r$\nלחצו על 'הסר' כדי להסיר את התוסף."
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!define MUI_UNFINISHPAGE_TITLE "ההסרה הושלמה"
!define MUI_UNFINISHPAGE_TEXT "תוסף CS Trim הוסר בהצלחה מהמחשב."
!define MUI_UNFINISHPAGE_BUTTONTEXT "סיום"
!insertmacro MUI_UNPAGE_FINISH

; --------------------------------
; Languages - Hebrew Only
; --------------------------------
!insertmacro MUI_LANGUAGE "Hebrew"

; --------------------------------
; Installer Section
; --------------------------------
Section "תוסף CS Trim" SecMain
    SetShellVarContext current
    RMDir /r "$INSTDIR"

    ; Clean CEP browser cache so Premiere Pro won't serve stale cached JS/CSS
    RMDir /r "$LOCALAPPDATA\Temp\cep_cache"
    RMDir /r "$APPDATA\Adobe\CEP\cache"

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
    File /nonfatal "corrections.json"

    ; Also copy to 32-bit Common Files if permissions allow (e.g. if run as admin)
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
    File /nonfatal "corrections.json"
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
    File /nonfatal "corrections.json"
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
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CSTrim" "DisplayName" "תוסף CS Trim עבור Adobe Premiere Pro"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CSTrim" "UninstallString" '"$INSTDIR\Uninstall.exe"'
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CSTrim" "DisplayIcon" "$INSTDIR\img\logo.ico"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CSTrim" "DisplayVersion" "1.0.42"
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
