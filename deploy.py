#!/usr/bin/env python3
import os
import sys
import json
import re
import subprocess

def run_cmd(cmd, check=True):
    print(f"--> Running: {cmd}")
    res = subprocess.run(cmd, shell=True, check=check, text=True, capture_output=True)
    if res.stdout:
        print(res.stdout.strip())
    if res.stderr and res.returncode != 0:
        print(res.stderr.strip(), file=sys.stderr)
    return res

def deploy(commit_msg=None, bump_patch=False):
    base_dir = os.path.abspath(os.path.dirname(__file__))
    os.chdir(base_dir)

    # 1. Read version from website/version.json
    version_file = os.path.join(base_dir, "website", "version.json")
    with open(version_file, "r", encoding="utf-8") as f:
        v_data = json.load(f)

    cur_ver = v_data.get("version", "1.0.6")
    parts = [int(p) for p in cur_ver.split(".")]
    
    if bump_patch:
        parts[-1] += 1
        new_ver = ".".join(str(p) for p in parts)
        new_code = v_data.get("versionCode", 100) + 1
        v_data["version"] = new_ver
        v_data["versionCode"] = new_code
        with open(version_file, "w", encoding="utf-8") as f:
            json.dump(v_data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"[*] Bumped version: {cur_ver} -> {new_ver} (code: {new_code})")
        cur_ver = new_ver

    # 2. Sync version in CSXS/manifest.xml
    manifest_path = os.path.join(base_dir, "CSXS", "manifest.xml")
    if os.path.exists(manifest_path):
        with open(manifest_path, "r", encoding="utf-8") as f:
            m_txt = f.read()
        m_txt = re.sub(r'ExtensionBundleVersion="[0-9.]+"', f'ExtensionBundleVersion="{cur_ver}"', m_txt)
        m_txt = re.sub(r'<Extension Id="com.autocut.panel" Version="[0-9.]+"', f'<Extension Id="com.autocut.panel" Version="{cur_ver}"', m_txt)
        with open(manifest_path, "w", encoding="utf-8") as f:
            f.write(m_txt)

    # 3. Sync version in js/updater.js
    updater_path = os.path.join(base_dir, "js", "updater.js")
    if os.path.exists(updater_path):
        with open(updater_path, "r", encoding="utf-8") as f:
            u_txt = f.read()
        u_txt = re.sub(r'CURRENT_VERSION:\s*"[0-9.]+"', f'CURRENT_VERSION: "{cur_ver}"', u_txt)
        with open(updater_path, "w", encoding="utf-8") as f:
            f.write(u_txt)

    # 4. Sync version in index.html
    index_path = os.path.join(base_dir, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            idx_txt = f.read()
        idx_txt = re.sub(r'id="updateVersionBadge"[^>]*>v[0-9.]+<', f'id="updateVersionBadge" class="update-vtag">v{cur_ver}<', idx_txt)
        idx_txt = re.sub(r'id="footerVersionText"[^>]*>v[0-9.]+<', f'id="footerVersionText">v{cur_ver}<', idx_txt)
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(idx_txt)

    # 5. Sync version in installer.nsi
    nsi_path = os.path.join(base_dir, "installer.nsi")
    if os.path.exists(nsi_path):
        with open(nsi_path, "r", encoding="utf-8") as f:
            nsi_txt = f.read()
        nsi_txt = re.sub(r'VIProductVersion\s+"[0-9.]+"', f'VIProductVersion "{cur_ver}.0"', nsi_txt)
        nsi_txt = re.sub(r'VIAddVersionKey "FileVersion"\s+"[0-9.]+"', f'VIAddVersionKey "FileVersion" "{cur_ver}.0"', nsi_txt)
        nsi_txt = re.sub(r'(WriteRegStr HKCU "Software\\+Microsoft\\+Windows\\+CurrentVersion\\+Uninstall\\+CSTrim"\s+"DisplayVersion"\s+)"[0-9.]+"', lambda m: f'{m.group(1)}"{cur_ver}"', nsi_txt)
        with open(nsi_path, "w", encoding="utf-8") as f:
            f.write(nsi_txt)

    # 6. Build all Windows & Mac installers and update archives
    print("[*] Building installers via build_installers.py...")
    run_cmd("python3 build_installers.py")

    print("[*] Building universal ZIP via package_extension.py...")
    run_cmd("python3 package_extension.py")

    # 7. Git add, commit, push to GitHub & Vercel
    msg = commit_msg or f"Update CS Trim v{cur_ver} (Windows & Vercel auto-sync)"
    print(f"[*] Committing and pushing to origin main: '{msg}'...")
    run_cmd("git add .")
    
    diff_check = subprocess.run("git diff --staged --quiet", shell=True)
    if diff_check.returncode != 0:
        run_cmd(f'git commit -m "{msg}"')
        run_cmd("git push origin main")
        print(f"[✓] Successfully deployed v{cur_ver} to GitHub, Vercel and Windows!")
    else:
        print("[!] No staged changes to commit. Everything is already up-to-date on GitHub & Vercel.")

if __name__ == "__main__":
    msg_arg = None
    bump = False
    for arg in sys.argv[1:]:
        if arg == "--bump":
            bump = True
        elif not msg_arg:
            msg_arg = arg
    deploy(commit_msg=msg_arg, bump_patch=bump)
