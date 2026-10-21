/**
 * AutoUpdater - In-App One-Click Auto Update System for CS Trim
 * Cross-platform (macOS & Windows)
 */
var AutoUpdater = {
    CURRENT_VERSION: "1.0.23",
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
     * Fetch remote version metadata with multi-source fallback (Vercel, custom domain, GitHub raw)
     * Supports both browser fetch and Node.js HTTPS fallback for guaranteed reliability in CEP.
     */
    fetchVersionMetadata: function () {
        var self = this;
        var urls = [
            "https://cstrim.vercel.app/version.json?t=" + Date.now(),
            "https://cstrim.site/version.json?t=" + Date.now(),
            self.PRIMARY_URL + "?t=" + Date.now(),
            self.FALLBACK_URL + "?t=" + Date.now()
        ];

        var fetchWithNode = function (url) {
            return new Promise(function (resolve, reject) {
                try {
                    var nodeReq = self.getNodeRequire();
                    if (!nodeReq) return reject(new Error("Node require not available"));
                    var https = nodeReq("https");
                    var req = https.get(url, {
                        headers: {
                            "User-Agent": "CSTrim-AutoUpdater",
                            "Cache-Control": "no-cache, no-store, must-revalidate",
                            "Pragma": "no-cache"
                        }
                    }, function (res) {
                        if (res.statusCode < 200 || res.statusCode >= 300) {
                            return reject(new Error("HTTP " + res.statusCode));
                        }
                        var body = "";
                        res.setEncoding("utf8");
                        res.on("data", function (chunk) { body += chunk; });
                        res.on("end", function () {
                            try {
                                var parsed = JSON.parse(body);
                                resolve(parsed);
                            } catch (e) {
                                reject(e);
                            }
                        });
                    });
                    req.on("error", reject);
                    req.setTimeout(5000, function () {
                        req.abort();
                        reject(new Error("Timeout"));
                    });
                } catch (err) {
                    reject(err);
                }
            });
        };

        var tryFetch = function (idx) {
            if (idx >= urls.length) {
                return Promise.reject(new Error("לא ניתן היה להתחבר לשרת לבדיקת עדכונים"));
            }
            var targetUrl = urls[idx];
            return fetch(targetUrl, { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
                .then(function (res) {
                    if (!res.ok) throw new Error("HTTP " + res.status);
                    return res.json();
                })
                .catch(function () {
                    // Try Node.js HTTPS fallback for this URL before giving up
                    return fetchWithNode(targetUrl).catch(function () {
                        return tryFetch(idx + 1);
                    });
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
                        // "bundleHash", not "bundleSha256": v1.0.20/1.0.21 crash when verifying that key, so it is no longer published
                        bundleHash: ((data && data.bundleHash) || "").toLowerCase(),
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
                var https = nodeReq("https");
                var crypto = nodeReq("crypto");

                var extDir = self.getExtensionDir();
                if (!extDir || !fs.existsSync(extDir)) {
                    return reject(new Error("תיקיית התוסף לא נמצאה: " + (extDir || "ריק")));
                }
                // Development install (extension folder is the git repo): extracting the bundle would overwrite the source
                if (fs.existsSync(path.join(extDir, ".git"))) {
                    return reject(new Error("זו תיקיית פיתוח (git), העדכון האוטומטי מבוטל כדי לא לדרוס את הקוד."));
                }

                var bundleCandidateUrls = [
                    updateInfo.bundleUrl,
                    "https://cstrim.vercel.app/download/cs-trim-update.zip",
                    "https://cstrim.site/download/cs-trim-update.zip",
                    "https://raw.githubusercontent.com/kaboodides-ai/cs-trim/main/website/download/cs-trim-update.zip"
                ].filter(Boolean);

                if (bundleCandidateUrls.length === 0) {
                    return reject(new Error("כתובת קובץ העדכון אינה תקינה"));
                }

                if (onProgress) onProgress(15, "מוריד קבצי עדכון...");

                var tmpZipPath = path.join(os.tmpdir(), "cstrim_bundle_" + Date.now() + ".zip");

                // Resilient download with URL failover and Node.js fallback
                var downloadBundle = function (idx) {
                    if (idx >= bundleCandidateUrls.length) {
                        return Promise.reject(new Error("נכשלה הורדת קובץ העדכון מכל המקורות"));
                    }
                    var currentUrl = bundleCandidateUrls[idx] + "?t=" + Date.now();

                    return fetch(currentUrl, { cache: "no-store" })
                        .then(function (res) {
                            if (!res.ok) throw new Error("HTTP " + res.status);
                            return res.arrayBuffer();
                        })
                        .then(function (ab) {
                            fs.writeFileSync(tmpZipPath, Buffer.from(ab));
                            return true;
                        })
                        .catch(function () {
                            // Try downloading with Node.js https
                            return new Promise(function (resNode, rejNode) {
                                try {
                                    var fileStream = fs.createWriteStream(tmpZipPath);
                                    var req = https.get(currentUrl, {
                                        headers: { "User-Agent": "CSTrim-AutoUpdater" }
                                    }, function (res) {
                                        if (res.statusCode < 200 || res.statusCode >= 300) {
                                            fileStream.close();
                                            try { fs.unlinkSync(tmpZipPath); } catch (e) {}
                                            return rejNode(new Error("HTTP " + res.statusCode));
                                        }
                                        res.pipe(fileStream);
                                        fileStream.on("finish", function () {
                                            fileStream.close();
                                            resNode(true);
                                        });
                                    });
                                    req.on("error", function (err) {
                                        fileStream.close();
                                        try { fs.unlinkSync(tmpZipPath); } catch (e) {}
                                        rejNode(err);
                                    });
                                } catch (e) {
                                    rejNode(e);
                                }
                            }).catch(function () {
                                return downloadBundle(idx + 1);
                            });
                        });
                };

                downloadBundle(0)
                    .then(function () {
                        // Integrity check: the zip must match the hash published in version.json
                        if (updateInfo.bundleHash) {
                            var actual = crypto.createHash("sha256").update(fs.readFileSync(tmpZipPath)).digest("hex");
                            if (actual !== updateInfo.bundleHash) {
                                try { fs.unlinkSync(tmpZipPath); } catch (delErr) {}
                                throw new Error("קובץ העדכון לא עבר בדיקת תקינות. העדכון בוטל.");
                            }
                        }
                        if (onProgress) onProgress(65, "מחלץ ומעדכן את קבצי התוסף...");

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
                                if (!execErr) return onExtractFinished(null);

                                // The pkg installs into /Library (root-owned): retry with an admin password prompt.
                                if (onProgress) onProgress(70, "נדרשת הרשאת מנהל - הזן סיסמת Mac בחלון שנפתח...");
                                var shQuote = function (x) { return "'" + String(x).replace(/'/g, "'\\''") + "'"; };
                                var shell = "/usr/bin/unzip -o " + shQuote(tmpZipPath) + " -d " + shQuote(extDir) +
                                    " && /usr/sbin/chown -R " + shQuote(os.userInfo().username) + " " + shQuote(extDir);
                                var asScript = 'do shell script "' + shell.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '" with administrator privileges';
                                cp.execFile("/usr/bin/osascript", ["-e", asScript], function (adminErr, out2, err2) {
                                    if (adminErr) {
                                        return onExtractFinished(new Error("אין הרשאת כתיבה לתיקיית התוסף. הורד והתקן מחדש מהאתר. (" + ((err2 || adminErr.message || "").toString().trim()) + ")"));
                                    }
                                    onExtractFinished(null);
                                });
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

