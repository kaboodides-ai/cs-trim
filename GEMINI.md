# CS Trim Development & Deployment Guidelines

## Deployment & Multi-Platform Synchronization (CRITICAL)

The user requires that **every update made to CS Trim must immediately be deployed to Vercel and Windows**.

Whenever changes are made to the extension, website, or backend:
1. **Never leave changes unbuilt or unpushed**:
   - The Windows in-app updater (`AutoUpdater` in `js/updater.js`) fetches updates from GitHub (`https://raw.githubusercontent.com/kaboodides-ai/cs-trim/main/website/version.json` and `cs-trim-update.zip`).
   - The website and installers on Vercel (`cstrim.vercel.app`, `cstrim.site`) are deployed directly from GitHub `main`.
   - Therefore, changes ONLY reach Windows users when:
     a) Installers and update ZIPs are rebuilt (`build_installers.py` and `package_extension.py`).
     b) Version numbers are synced in `CSXS/manifest.xml`, `index.html`, `js/updater.js`, `installer.nsi`, and `website/version.json`.
     c) All changes are committed and pushed to `origin main`.

2. **Automated Deployment**:
   - Use `python3 deploy.py "[Commit Message]"` or `python3 deploy.py --bump "[Commit Message]"` to rebuild all Windows packages (`CS-Trim-Setup.exe`, `CS-Trim-v1.0.0-Windows.zip`, `cs-trim-update.zip`, `cs-trim-v1.0.0.zip`, `CS-Trim-v1.0.0-Mac.pkg`), sync versions, commit, and push to GitHub/Vercel in a single verified step.

3. **Windows Specific Requirements**:
   - Ensure `input[type="color"]` elements are not set to `display: none` (use visually hidden / opacity 0) so programmatic clicks on Windows native color buttons succeed.
   - Preserve Windows ffmpeg binaries in `bin/win/ffmpeg.exe`.
   - Ensure CEP debug registry keys (CSXS 7-20) are maintained in Windows installers.
