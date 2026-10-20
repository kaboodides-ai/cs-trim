#!/usr/bin/env python3
import os
import shutil
import zipfile

def package():
    base_dir = os.path.abspath(os.path.dirname(__file__))
    pkg_root = os.path.join(base_dir, "package_temp")
    plugin_dest = os.path.join(pkg_root, "com.autocut.panel")
    zip_dest = os.path.join(base_dir, "website", "download", "cs-trim-v1.0.0.zip")

    if os.path.exists(pkg_root):
        shutil.rmtree(pkg_root)
    os.makedirs(plugin_dest, exist_ok=True)

    # Files and folders to copy into the extension bundle
    items = [
        "CSXS",
        "css",
        "host",
        "img",
        "index.html",
        "js",
        ".debug",
        "bin",
        "bin-mac",
        "corrections.json"
    ]

    for item in items:
        src = os.path.join(base_dir, item)
        dst = os.path.join(plugin_dest, item)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        elif os.path.isfile(src):
            shutil.copy2(src, dst)

    # Create Mac installer script
    mac_installer = """#!/bin/bash
# CS Trim - התקנה אוטומטית למשתמשי Mac
echo "================================================="
echo "   מתקין את CS Trim עבור Adobe Premiere Pro   "
echo "================================================="

TARGET_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"
mkdir -p "$TARGET_DIR"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PLUGIN_SRC="$SCRIPT_DIR/com.autocut.panel"

if [ ! -d "$PLUGIN_SRC" ]; then
    echo "שגיאה: תיקיית com.autocut.panel לא נמצאה באותו מיקום של הסקריפט."
    exit 1
fi

echo "מעתיק קבצים לתיקיית ההרחבות..."
rm -rf "$TARGET_DIR/com.autocut.panel"
cp -R "$PLUGIN_SRC" "$TARGET_DIR/"

echo "מגדיר הרשאות פיתוח עבור Adobe CEP (PlayerDebugMode)..."
for v in 7 8 9 10 11 12 13 14 15 16; do
    defaults write com.adobe.CSXS.$v PlayerDebugMode 1 2>/dev/null
done

echo ""
echo "================================================="
echo " ✅ ההתקנה הושלמה בהצלחה! "
echo " כעת פתח את Premiere Pro והיכנס ל:"
echo " Window > Extensions > CS Trim"
echo "================================================="
read -p "לחץ Enter לסגירת החלון..."
"""

    # Create Windows installer script
    win_installer = """@echo off
chcp 65001 >nul
echo =================================================
echo    מתקין את CS Trim עבור Adobe Premiere Pro
echo =================================================

set "TARGET_DIR=%APPDATA%\\Adobe\\CEP\\extensions\\com.autocut.panel"
set "SCRIPT_DIR=%~dp0"
set "PLUGIN_SRC=%SCRIPT_DIR%com.autocut.panel"

if not exist "%PLUGIN_SRC%" (
    echo שגיאה: תיקיית com.autocut.panel לא נמצאה.
    pause
    exit /b 1
)

echo יוצר תיקייה ומעתיק קבצים...
if not exist "%APPDATA%\\Adobe\\CEP\\extensions" mkdir "%APPDATA%\\Adobe\\CEP\\extensions"
if exist "%TARGET_DIR%" rmdir /s /q "%TARGET_DIR%"
xcopy /E /I /Y "%PLUGIN_SRC%" "%TARGET_DIR%" >nul

echo מגדיר הרשאות PlayerDebugMode ב-Registry...
for %%v in (7 8 9 10 11 12 13 14 15 16 17 18 19 20) do (
    reg add "HKEY_CURRENT_USER\\Software\\Adobe\\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
    reg add "HKEY_LOCAL_MACHINE\\Software\\Adobe\\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
)

echo.
echo =================================================
echo  ההתקנה הושלמה בהצלחה!
echo  כעת פתח את Premiere Pro והיכנס ל:
echo  Window ^> Extensions ^> CS Trim
echo =================================================
pause
"""

    # Create README in Hebrew
    readme_txt = """מדריך התקנה מהיר - CS Trim ל-Adobe Premiere Pro
=====================================================

תוסף לחיתוך שקט אוטומטי וכתוביות AI מהירות בפרמייר פרו.

אפשרות 1: התקנה אוטומטית (מומלץ)
----------------------------------
משתמשי Mac:
1. לחצו לחיצה כפולה על הקובץ "Install_Mac.command".
2. אם מופיעה התרעת אבטחה של Apple ("לא נפתח" / Gatekeeper):
   - לחצו על "סיום" (Done) בחלון ההתרעה.
   - היכנסו ל: הגדרות המערכת > פרטיות ואבטחה > גללו למטה למקטע "אבטחה" ולחצו על "פתיחה בכל זאת" (Open Anyway).
   - לחצו "פתח" (Open) וההתקנה תסתיים אוטומטית!
   (טיפ נוסף: בחלק מגרסאות Mac ניתן ללחוץ קליק ימני על הקובץ > פתח).
3. פתחו את Premiere Pro ובחרו בתפריט: Window > Extensions > CS Trim.

משתמשי Windows:
1. לחצו לחיצה כפולה על הקובץ "Install_Windows.bat".
2. פתחו את Premiere Pro ובחרו בתפריט: Window > Extensions > CS Trim.

אפשרות 2: התקנה ידנית
----------------------------------
העתיקו את התיקייה "com.autocut.panel" למיקום הבא במחשב שלכם:

ב-Mac:
~/Library/Application Support/Adobe/CEP/extensions/

ב-Windows:
C:\\Users\\<שם_המשתמש>\\AppData\\Roaming\\Adobe\\CEP\\extensions\\

*הערה: כדי שפרמייר יטען הרחבות, יש לוודא שמופעל PlayerDebugMode בגרסאות CSXS.
הסקריפטים האוטומטיים מבצעים זאת בלחיצה אחת!

חיבור מפתח Groq AI חינם לכתוביות:
1. כנסו לאתר https://console.groq.com/keys
2. צרו משתמש חינם והפיקו API Key בתוך 10 שניות.
3. הדביקו אותו בלשונית 'כתוביות AI' בתוסף - וזהו!

תהנו מחסכון של שעות עבודה!
"""

    mac_script_path = os.path.join(pkg_root, "Install_Mac.command")
    with open(mac_script_path, "w", encoding="utf-8") as f:
        f.write(mac_installer)
    os.chmod(mac_script_path, 0o755)

    win_script_path = os.path.join(pkg_root, "Install_Windows.bat")
    with open(win_script_path, "w", encoding="utf-8") as f:
        f.write(win_installer)

    readme_path = os.path.join(pkg_root, "מדריך_התקנה_README.txt")
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(readme_txt)

    # Create ZIP
    os.makedirs(os.path.dirname(zip_dest), exist_ok=True)
    with zipfile.ZipFile(zip_dest, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(pkg_root):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, pkg_root)
                zipf.write(file_path, arcname)

    shutil.rmtree(pkg_root)
    print(f"Created ZIP: {zip_dest} ({os.path.getsize(zip_dest)} bytes)")

if __name__ == "__main__":
    package()
