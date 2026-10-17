/**
 * AutoUpdater - In-App One-Click Auto Update System for CS Trim
 * Cross-platform (macOS & Windows)
 */
var AutoUpdater = {
    CURRENT_VERSION: "1.0.10",
    PRIMARY_URL: "https://raw.githubusercontent.com/kaboodides-ai/cs-trim/main/website/version.json",
    FALLBACK_URL: "https://cstrim.vercel.app/version.json",

    getNodeRequire: function () {
        if (typeof window !== "undefined" && window.cep_node && window.cep_node.require) {
            return window.cep_node.require;
        }
        if (typeof require !== "undefined") {
            return require;
        }
        return null;
    },

    getExtensionDir: function () {
        var normalize = function (raw) {
            if (!raw) return "";
            var d = raw;
            try { d = decodeURIComponent(d); } catch (e) {
                try { d = decodeURI(d); } catch (e2) {}
            }
            return d.replace(/^file:\/\/\/?/i, "").replace(/^\/([a-zA-Z]:)/, "$1");
        };

        try {
            if (typeof csInterface !== "undefined" && csInterface && csInterface.getSystemPath) {
                var p = csInterface.getSystemPath("extension");
                if (p) return normalize(p);
            } else if (typeof window !== "undefined" && window.csInterface && window.csInterface.getSystemPath) {
                var wp = window.csInterface.getSystemPath("extension");
                if (wp) return normalize(wp);
            } else if (typeof CSInterface !== "undefined") {
                var cp = new CSInterface().getSystemPath("extension");
                if (cp) return normalize(cp);
            }
        } catch (e) {}

        if (typeof __dirname !== "undefined") {
            return normalize(__dirname);
        }

        return "";
    },

    /**
     * Compare two semver strings: e.g. "1.0.4" vs "1.0.3"
     * returns 1 if vA > vB, -1 if vA < vB, 0 if equal
     */
    compareVersions: function (vA, vB) {
        var cleanA = (vA || "").replace(/[^0-9.]/g, "").split(".").map(function (x) { return parseInt(x, 10) || 0; });
        var cleanB = (vB || "").replace(/[^0-9.]/g, "").split(".").map(function (x) { return parseInt(x, 10) || 0; });
        var maxLen = Math.max(cleanA.length, cleanB.length);
        for (var i = 0; i < maxLen; i++) {
            var a = cleanA[i] || 0;
            var b = cleanB[i] || 0;
            if (a > b) return 1;
            if (a < b) return -1;
        }
        return 0;
    },

    /**
     * Fetch remote version metadata with fallback
     */
    fetchVersionMetadata: function () {
        var self = this;
        var urls = [
            self.PRIMARY_URL + "?t=" + Date.now(),
            self.FALLBACK_URL + "?t=" + Date.now()
        ];

        var tryFetch = function (idx) {
            if (idx >= urls.length) {
                return Promise.reject(new Error("לא ניתן היה להתחבר לשרת לבדיקת עדכונים"));
            }
            return fetch(urls[idx], { cache: "no-store" })
                .then(function (res) {
                    if (!res.ok) throw new Error("HTTP " + res.status);
                    return res.json();
                })
                .catch(function () {
                    return tryFetch(idx + 1);
                });
        };

        return tryFetch(0);
    },

    /**
     * Check if a new version is available
     */
    checkForUpdates: function () {
        var self = this;
        return new Promise(function (resolve, reject) {
            self.fetchVersionMetadata()
                .then(function (data) {
                    var remoteVer = (data && data.version) ? data.version.trim() : "";
                    var hasUpdate = Boolean(remoteVer && self.compareVersions(remoteVer, self.CURRENT_VERSION) > 0);
                    resolve({
                        hasUpdate: hasUpdate,
                        currentVersion: self.CURRENT_VERSION,
                        latestVersion: remoteVer || self.CURRENT_VERSION,
                        title: (data && data.title) || ("גרסה " + remoteVer),
                        changelog: (data && data.changelog) || [],
                        bundleUrl: (data && data.bundleUrl) || "",
                        winSetupUrl: (data && data.winSetupUrl) || "",
                        macPkgUrl: (data && data.macPkgUrl) || ""
                    });
                })
                .catch(function (err) {
                    reject(err);
                });
        });
    },

    /**
     * Download and extract update bundle directly into extension directory
     * @param {Object} updateInfo
     * @param {Function} onProgress(percent, message)
     */
    applyUpdate: function (updateInfo, onProgress) {
        var self = this;
        return new Promise(function (resolve, reject) {
            try {
                var nodeReq = self.getNodeRequire();
                if (!nodeReq) {
                    return reject(new Error("סביבת Node.js אינה זמינה לעדכון אוטומטי"));
                }
                var fs = nodeReq("fs");
                var path = nodeReq("path");
                var os = nodeReq("os");
                var cp = nodeReq("child_process");

                var extDir = self.getExtensionDir();
                if (!extDir || !fs.existsSync(extDir)) {
                    return reject(new Error("תיקיית התוסף לא נמצאה: " + (extDir || "ריק")));
                }

                var bundleUrl = updateInfo.bundleUrl;
                if (!bundleUrl) {
                    return reject(new Error("כתובת קובץ העדכון אינה תקינה"));
                }

                if (onProgress) onProgress(15, "מוריד קבצי עדכון...");

                // Download the update zip bundle using fetch
                fetch(bundleUrl + "?t=" + Date.now(), { cache: "no-store" })
                    .then(function (res) {
                        if (!res.ok) {
                            throw new Error("שגיאה בהורדת העדכון (HTTP " + res.status + ")");
                        }
                        return res.arrayBuffer();
                    })
                    .then(function (arrayBuffer) {
                        if (onProgress) onProgress(50, "שומר קובץ עדכון זמני...");
                        var tmpZipPath = path.join(os.tmpdir(), "cstrim_bundle_" + Date.now() + ".zip");
                        fs.writeFileSync(tmpZipPath, Buffer.from(arrayBuffer));

                        if (onProgress) onProgress(70, "מחלץ ומעדכן את קבצי התוסף...");

                        var isWin = (os.platform() === "win32");

                        var onExtractFinished = function (err) {
                            try { fs.unlinkSync(tmpZipPath); } catch (delErr) {}
                            if (err) {
                                return reject(new Error("שגיאה בחילוץ העדכון: " + (err.message || err)));
                            }
                            proceedWithReload();
                        };

                        var proceedWithReload = function () {
                            if (onProgress) onProgress(90, "מרענן הגדרות ומנקה מטמון...");

                            // Re-evaluate host index.jsx in Premiere Pro ExtendScript engine
                            try {
                                var jsxPath = path.join(extDir, "host", "index.jsx").replace(/\\/g, "/");
                                if (typeof csInterface !== "undefined" && csInterface && csInterface.evalScript) {
                                    csInterface.evalScript('$.evalFile("' + jsxPath + '")');
                                }
                            } catch (jsxErr) {}

                            if (onProgress) onProgress(100, "העדכון הותקן בהצלחה! טוען מחדש...");

                            setTimeout(function () {
                                resolve({
                                    success: true,
                                    newVersion: updateInfo.latestVersion
                                });
                                // Reload panel
                                try {
                                    if (typeof window !== "undefined" && window.location) {
                                        window.location.reload(true);
                                    }
                                } catch (relErr) {}
                            }, 600);
                        };

                        if (isWin) {
                            var winTar = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
                            var psZip = tmpZipPath.replace(/'/g, "''");
                            var psDest = extDir.replace(/'/g, "''");

                            var runPowerShellFallback = function () {
                                var psCmd = 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "' +
                                    '$s = Join-Path $env:TEMP (\'cstrim_u_\' + [Environment]::TickCount); ' +
                                    'Expand-Archive -LiteralPath \'' + psZip + '\' -DestinationPath $s -Force; ' +
                                    'Copy-Item -Path ($s + \'\\*\') -Destination \'' + psDest + '\' -Recurse -Force; ' +
                                    'Remove-Item -Path $s -Recurse -Force -ErrorAction SilentlyContinue' +
                                    '"';
                                cp.exec(psCmd, function (psErr, stdout, stderr) {
                                    onExtractFinished(psErr ? (psErr.message || stderr) : null);
                                });
                            };

                            if (fs.existsSync(winTar)) {
                                cp.execFile(winTar, ["-xf", tmpZipPath, "-C", extDir], function (tarErr) {
                                    if (!tarErr) {
                                        onExtractFinished(null);
                                    } else {
                                        runPowerShellFallback();
                                    }
                                });
                            } else {
                                runPowerShellFallback();
                            }
                        } else {
                            // macOS
                            var extractCmd = '/usr/bin/unzip -o "' + tmpZipPath + '" -d "' + extDir + '"';
                            cp.exec(extractCmd, function (execErr, stdout, stderr) {
                                onExtractFinished(execErr ? (execErr.message || stderr) : null);
                            });
                        }
                    })
                    .catch(reject);
            } catch (err) {
                reject(err);
            }
        });
    }
};

if (typeof window !== "undefined") {
    window.AutoUpdater = AutoUpdater;
}

