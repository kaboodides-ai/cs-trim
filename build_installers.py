#!/usr/bin/env python3
import os
import shutil
import subprocess
import zipfile

def build():
    base = os.path.abspath(os.path.dirname(__file__))
    dl_dir = os.path.join(base, "website", "download")
    os.makedirs(dl_dir, exist_ok=True)

    # -------------------------------------------------------------
    # 1. Build Mac PKG Installer (native Apple Installer wizard)
    # -------------------------------------------------------------
    pkg_temp = os.path.join(base, "pkg_build_temp")
    payload_root = os.path.join(pkg_temp, "payload")
    target_ext = os.path.join(payload_root, "Library", "Application Support", "Adobe", "CEP", "extensions", "com.autocut.panel")
    scripts_dir = os.path.join(pkg_temp, "scripts")
    component_pkg = os.path.join(pkg_temp, "component.pkg")
    final_mac_pkg = os.path.join(dl_dir, "CS-Trim-v1.0.0-Mac.pkg")

    if os.path.exists(pkg_temp):
        shutil.rmtree(pkg_temp)
    os.makedirs(target_ext, exist_ok=True)
    os.makedirs(scripts_dir, exist_ok=True)

    items = ["CSXS", "css", "host", "img", "index.html", "js", ".debug"]
    for item in items:
        src = os.path.join(base, item)
        dst = os.path.join(target_ext, item)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        elif os.path.isfile(src):
            shutil.copy2(src, dst)

    postinstall_script = """#!/bin/bash
INSTALL_DIR="/Library/Application Support/Adobe/CEP/extensions/com.autocut.panel"
chmod -R 755 "$INSTALL_DIR" 2>/dev/null
xattr -d -r com.apple.quarantine "$INSTALL_DIR" 2>/dev/null

# Set PlayerDebugMode for all CSXS versions
for v in 7 8 9 10 11 12 13 14 15 16; do
    defaults write /Library/Preferences/com.adobe.CSXS.$v PlayerDebugMode 1 2>/dev/null
    defaults write com.adobe.CSXS.$v PlayerDebugMode 1 2>/dev/null
done

CURRENT_USER=$(stat -f "%Su" /dev/console 2>/dev/null || echo "$USER")
if [ -n "$CURRENT_USER" ] && [ "$CURRENT_USER" != "root" ]; then
    for v in 7 8 9 10 11 12 13 14 15 16; do
        sudo -u "$CURRENT_USER" defaults write com.adobe.CSXS.$v PlayerDebugMode 1 2>/dev/null
    done
fi
exit 0
"""
    postinstall_file = os.path.join(scripts_dir, "postinstall")
    with open(postinstall_file, "w") as f:
        f.write(postinstall_script)
    os.chmod(postinstall_file, 0o755)

    # Build component package
    subprocess.run([
        "pkgbuild",
        "--root", payload_root,
        "--scripts", scripts_dir,
        "--identifier", "com.autocut.panel.pkg",
        "--version", "1.0.0",
        "--install-location", "/",
        component_pkg
    ], check=True, stdout=subprocess.DEVNULL)

    # Build final product package
    subprocess.run([
        "productbuild",
        "--package", component_pkg,
        final_mac_pkg
    ], check=True, stdout=subprocess.DEVNULL)

    shutil.rmtree(pkg_temp)
    print(f"Created Mac PKG: {final_mac_pkg} ({os.path.getsize(final_mac_pkg)} bytes)")

    # -------------------------------------------------------------
    # 2. Build Windows Installer ZIP
    # -------------------------------------------------------------
    win_temp = os.path.join(base, "win_build_temp")
    win_plugin = os.path.join(win_temp, "com.autocut.panel")
    final_win_zip = os.path.join(dl_dir, "CS-Trim-v1.0.0-Windows.zip")

    if os.path.exists(win_temp):
        shutil.rmtree(win_temp)
    os.makedirs(win_plugin, exist_ok=True)

    for item in items:
        src = os.path.join(base, item)
        dst = os.path.join(win_plugin, item)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        elif os.path.isfile(src):
            shutil.copy2(src, dst)

    win_bat = """@echo off
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
for %%v in (7 8 9 10 11 12 13 14 15 16) do (
    reg add "HKEY_CURRENT_USER\\Software\\Adobe\\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
)

echo.
echo =================================================
echo  ההתקנה הושלמה בהצלחה!
echo  כעת פתח את Premiere Pro והיכנס ל:
echo  Window ^> Extensions ^> CS Trim
echo =================================================
pause
"""
    win_bat_path = os.path.join(win_temp, "התקנה_בווינדוס_Install_Windows.bat")
    with open(win_bat_path, "w", encoding="utf-8") as f:
        f.write(win_bat)

    readme_win = """מדריך התקנה מהיר - CS Trim ל-Adobe Premiere Pro (Windows)
=====================================================

1. חלצו את קובץ ה-ZIP למחשב (קליק ימני > Extract All / חלץ הכל).
2. לחצו לחיצה כפולה על הקובץ "התקנה_בווינדוס_Install_Windows.bat".
3. פתחו את Premiere Pro ובחרו בתפריט: Window > Extensions > CS Trim.
"""
    with open(os.path.join(win_temp, "מדריך_התקנה.txt"), "w", encoding="utf-8") as f:
        f.write(readme_win)

    with zipfile.ZipFile(final_win_zip, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(win_temp):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, win_temp)
                zipf.write(file_path, arcname)

    shutil.rmtree(win_temp)
    print(f"Created Windows ZIP: {final_win_zip} ({os.path.getsize(final_win_zip)} bytes)")

    # Also copy to legacy filename for backwards compatibility
    shutil.copy2(final_win_zip, os.path.join(dl_dir, "cs-trim-v1.0.0.zip"))

if __name__ == "__main__":
    build()

