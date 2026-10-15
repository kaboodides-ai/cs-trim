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
    # 2. Build Windows Setup.exe Installer (Modern GUI Wizard)
    # -------------------------------------------------------------
    nsis_bin = os.path.join(base, "makensis", "3.13", "bin", "makensis")
    nsis_share = os.path.join(base, "makensis", "3.13", "share", "nsis")
    nsi_script = os.path.join(base, "installer.nsi")
    final_win_exe = os.path.join(dl_dir, "CS-Trim-v1.0.0-Windows-Setup.exe")

    if os.path.exists(nsis_bin) and os.path.exists(nsi_script):
        env = os.environ.copy()
        env["NSISDIR"] = nsis_share
        subprocess.run([nsis_bin, "-INPUTCHARSET", "UTF8", nsi_script], env=env, check=True, stdout=subprocess.DEVNULL)
        print(f"Created Windows Setup EXE: {final_win_exe} ({os.path.getsize(final_win_exe)} bytes)")

if __name__ == "__main__":
    build()

