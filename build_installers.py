#!/usr/bin/env python3
import os
import shutil
import subprocess
import zipfile
import generate_installer_assets

def build():
    base = os.path.abspath(os.path.dirname(__file__))
    dl_dir = os.path.join(base, "website", "download")
    os.makedirs(dl_dir, exist_ok=True)

    # Ensure all installer icons & branding bitmaps are fresh
    generate_installer_assets.generate_assets()

    extension_items = ["CSXS", "css", "host", "img", "index.html", "js", ".debug"]

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

    for item in extension_items:
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

# Set PlayerDebugMode for all CSXS versions 7 through 17
for v in 7 8 9 10 11 12 13 14 15 16 17; do
    defaults write /Library/Preferences/com.adobe.CSXS.$v PlayerDebugMode 1 2>/dev/null
    defaults write com.adobe.CSXS.$v PlayerDebugMode 1 2>/dev/null
done

CURRENT_USER=$(stat -f "%Su" /dev/console 2>/dev/null || echo "$USER")
if [ -n "$CURRENT_USER" ] && [ "$CURRENT_USER" != "root" ]; then
    for v in 7 8 9 10 11 12 13 14 15 16 17; do
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
    # 2. Build Windows Setup.exe Installer via NSIS
    # -------------------------------------------------------------
    nsis_bin = os.path.join(base, "makensis", "3.13", "bin", "makensis")
    nsis_share = os.path.join(base, "makensis", "3.13", "share", "nsis")
    nsi_script = os.path.join(base, "installer.nsi")
    final_win_exe = os.path.join(dl_dir, "CS-Trim-Setup.exe")
    legacy_win_exe = os.path.join(dl_dir, "CS-Trim-v1.0.0-Windows-Setup.exe")

    if os.path.exists(nsis_bin) and os.path.exists(nsi_script):
        env = os.environ.copy()
        env["NSISDIR"] = nsis_share
        subprocess.run([nsis_bin, "-INPUTCHARSET", "UTF8", nsi_script], env=env, check=True, stdout=subprocess.DEVNULL)
        if os.path.exists(final_win_exe):
            shutil.copy2(final_win_exe, legacy_win_exe)
        print(f"Created Windows Setup EXE: {final_win_exe} ({os.path.getsize(final_win_exe)} bytes)")

    # -------------------------------------------------------------
    # 3. Build Windows Distribution ZIP (Antivirus-Safe, Clean Archive)
    # -------------------------------------------------------------
    win_temp = os.path.join(base, "win_dist_temp")
    if os.path.exists(win_temp):
        shutil.rmtree(win_temp)
    os.makedirs(win_temp, exist_ok=True)

    # A. Copy extension files into com.autocut.panel folder
    ext_dir = os.path.join(win_temp, "com.autocut.panel")
    os.makedirs(ext_dir, exist_ok=True)
    extension_items_win = ["CSXS", "css", "host", "img", "index.html", "js", ".debug", "bin"]
    for item in extension_items_win:
        src = os.path.join(base, item)
        dst = os.path.join(ext_dir, item)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        elif os.path.isfile(src):
            shutil.copy2(src, dst)

    # B. Setup.exe in ZIP
    if os.path.exists(final_win_exe):
        shutil.copy2(final_win_exe, os.path.join(win_temp, "CS-Trim-Setup.exe"))

    # C. Graphical HTA Installer
    hta_src = os.path.join(base, "Setup.hta")
    if os.path.exists(hta_src):
        shutil.copy2(hta_src, os.path.join(win_temp, "Install-CS-Trim.hta"))

    # D. Quick-Install.bat
    bat_content = """@echo off
chcp 65001 >nul
echo ========================================================
echo       CS Trim - Adobe Premiere Pro Extension Installer
echo ========================================================
echo.

set "TARGET=%APPDATA%\\Adobe\\CEP\\extensions\\com.autocut.panel"

echo [1/2] Installing CS Trim to Adobe CEP extensions folder...
if not exist "%APPDATA%\\Adobe\\CEP\\extensions" mkdir "%APPDATA%\\Adobe\\CEP\\extensions"
if exist "%TARGET%" rmdir /s /q "%TARGET%"
mkdir "%TARGET%"

if exist "com.autocut.panel" (
    xcopy /e /i /y /q "com.autocut.panel\\*" "%TARGET%\\" >nul
) else (
    xcopy /e /i /y /q "bin" "%TARGET%\\bin\\" >nul
    xcopy /e /i /y /q "CSXS" "%TARGET%\\CSXS\\" >nul
    xcopy /e /i /y /q "css" "%TARGET%\\css\\" >nul
    xcopy /e /i /y /q "host" "%TARGET%\\host\\" >nul
    xcopy /e /i /y /q "img" "%TARGET%\\img\\" >nul
    xcopy /e /i /y /q "js" "%TARGET%\\js\\" >nul
    copy /y "index.html" "%TARGET%\\" >nul
    copy /y ".debug" "%TARGET%\\" >nul
)

echo [2/2] Configuring CSXS PlayerDebugMode in Windows Registry...
for %%v in (7 8 9 10 11 12 13 14 15 16 17 18 19 20) do (
    reg add "HKCU\\Software\\Adobe\\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
    reg add "HKLM\\Software\\Adobe\\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
)

echo.
echo ========================================================
echo [V] Installation completed successfully!
echo.
echo Now open or restart Adobe Premiere Pro:
echo Window ^> Extensions ^> CS Trim
echo ========================================================
echo.
pause
"""
    with open(os.path.join(win_temp, "Quick-Install.bat"), "w", encoding="utf-8") as f:
        f.write(bat_content)

    # E. Registry Fix .reg
    reg_lines = ["Windows Registry Editor Version 5.00\n"]
    for v in range(7, 21):
        reg_lines.append(f'[HKEY_CURRENT_USER\\Software\\Adobe\\CSXS.{v}]\n"PlayerDebugMode"="1"\n')
    with open(os.path.join(win_temp, "Enable-PlayerDebugMode.reg"), "w", encoding="utf-8") as f:
        f.write("\n".join(reg_lines))

    # F. Clean Installation Guide TXT
    guide_content = """מדריך התקנה של CS Trim ל-Windows
======================================

אפשרות 1 (מומלצת ומהירה ביותר):
לחצו לחיצה כפולה על "CS-Trim-Setup.exe".
ייפתח אשף התקנה גרפי מעוצב (המשך > התקן).
ההתקנה תעתיק אוטומטית את התוסף לתיקיות ההרחבה של אדובי ותגדיר את כל ההרשאות.

אפשרות 2 (אשף התקנה חלופי או קובץ Batch):
- לחצו לחיצה כפולה על "Install-CS-Trim.hta" (אשף גרפי מובנה)
או
- לחצו לחיצה כפולה על "Quick-Install.bat" להתקנה אוטומטית תוך שנייה אחת בלבד.

אפשרות 3 (התקנה ידנית):
1. העתיקו את התיקייה "com.autocut.panel" לתוך הנתיב הבא במחשב:
   %APPDATA%\\Adobe\\CEP\\extensions\\
2. לחצו לחיצה כפולה על "Enable-PlayerDebugMode.reg" כדי לאשר את הרשאות הפיתוח של פרמייר.

שלב סיום:
סגרו ופתחו מחדש את Adobe Premiere Pro.
היכנסו לתפריט העליון:
Window > Extensions > CS Trim
(בעברית: חלון > הרחבות > CS Trim)

זהו! הפלאגין מוכן לעבודה מלאה.
"""
    with open(os.path.join(win_temp, "Install_Instructions.txt"), "w", encoding="utf-8") as f:
        f.write(guide_content)

    # G. Compress win_temp into final ZIP
    final_win_zip = os.path.join(dl_dir, "CS-Trim-v1.0.0-Windows.zip")
    with zipfile.ZipFile(final_win_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(win_temp):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, win_temp)
                zf.write(full_path, rel_path)

    shutil.rmtree(win_temp)
    print(f"Created Windows Safe ZIP: {final_win_zip} ({os.path.getsize(final_win_zip)} bytes)")

if __name__ == "__main__":
    build()
