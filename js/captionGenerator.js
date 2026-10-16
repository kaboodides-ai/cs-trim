/**
 * CS Trim - Groq AI Whisper Caption Generator
 * Free, ultra-fast transcription using Groq Cloud API with Whisper Large v3.
 * Supports single media clips and entire cut sequences across all timeline clips.
 * Cross-platform (macOS & Windows).
 */

var CaptionGenerator = {
    STORAGE_KEY: "autocut_groq_api_key",

    getApiKey: function () {
        try {
            return localStorage.getItem(this.STORAGE_KEY) || "";
        } catch (e) {
            return "";
        }
    },

    saveApiKey: function (key) {
        try {
            localStorage.setItem(this.STORAGE_KEY, (key || "").trim());
        } catch (e) {}
    },

    // Built-in dictionary of Hebrew spelling and terminology corrections for Whisper
    HEBREW_CORRECTIONS: {
        "מקאבי": "מכבי",
        "מקבי": "מכבי",
        "מכאבי": "מכבי",
        "קריש דם": "קריש דם",
        "קרישים": "כרישים",
        "קריש": "כריש",
        "טיק טוק": "טיקטוק",
        "יו טיוב": "יוטיוב",
        "פייס בוק": "פייסבוק",
        "וואטס אפ": "וואטסאפ",
        "ווטסאפ": "וואטסאפ",
        "פריימיר": "פרמייר",
        "פרימייר": "פרמייר",
        "אינסטה": "אינסטגרם",
        "אינסטה גרם": "אינסטגרם",
        "וואצאפ": "וואטסאפ",
        "ספוטיפי": "ספוטיפיי",
        "הצירה": "עצירה",
        "מצחונות": "נצחונות",
        "דגדק": "דגדג"
    },

    REMOTE_URLS: [
        "https://raw.githubusercontent.com/kaboodides-ai/cs-trim/main/website/corrections.json",
        "https://cstrim.vercel.app/corrections.json"
    ],

    getExtensionDir: function () {
        var normalize = function (raw) {
            if (!raw) return "";
            var d = raw;
            try { d = decodeURIComponent(d); } catch (e) {
                try { d = decodeURI(d); } catch (e2) {}
            }
            return d.replace(/^file:\/\/\/?/i, "").replace(/^\/([a-zA-Z]:)/, "$1").replace(/\//g, "\\");
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

        try {
            if (typeof window !== "undefined" && window.location && window.location.pathname) {
                var loc = normalize(window.location.pathname);
                var nodeReq = this.getNodeRequire();
                if (nodeReq) {
                    var path = nodeReq("path");
                    return path.dirname(loc);
                }
            }
        } catch (e) {}

        return "";
    },

    fetchRemoteCorrections: function () {
        var self = this;
        return new Promise(function (resolve) {
            var urls = [
                self.REMOTE_URLS[0] + "?t=" + Date.now(),
                self.REMOTE_URLS[1] + "?t=" + Date.now()
            ];

            var saveLoadedCorrections = function (corrections, sourceUrl) {
                if (!corrections || typeof corrections !== "object") return;
                try {
                    localStorage.setItem("autocut_remote_corrections", JSON.stringify(corrections));
                } catch (e) {}

                // Also persist to disk on Windows and macOS so it survives CEP cache resets
                try {
                    var nodeReq = self.getNodeRequire();
                    if (nodeReq) {
                        var fs = nodeReq("fs");
                        var path = nodeReq("path");
                        var extDir = self.getExtensionDir();
                        if (extDir && fs.existsSync(extDir)) {
                            var diskPath = path.join(extDir, "corrections.json");
                            fs.writeFileSync(diskPath, JSON.stringify({ version: 1, corrections: corrections }, null, 2), "utf8");
                        }
                    }
                } catch (fsErr) {}

                console.log("[CS Trim] Loaded " + Object.keys(corrections).length + " remote corrections from cloud (" + sourceUrl + ")");
            };

            var tryNode = function (index, url) {
                var nodeReq = self.getNodeRequire();
                if (!nodeReq) {
                    tryFetch(index + 1);
                    return;
                }
                try {
                    var https = nodeReq("https");
                    var req = https.get(url, { headers: { "User-Agent": "cs-trim-cep", "Cache-Control": "no-cache" } }, function (res) {
                        // Handle 301/302/307 redirects
                        if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location) {
                            var redirectUrl = res.headers.location;
                            if (redirectUrl.indexOf("?") === -1) redirectUrl += "?t=" + Date.now();
                            tryNode(index, redirectUrl);
                            return;
                        }
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            res.setEncoding("utf8");
                            var body = "";
                            res.on("data", function (chunk) { body += chunk; });
                            res.on("end", function () {
                                try {
                                    var json = JSON.parse(body);
                                    if (json && json.corrections) {
                                        saveLoadedCorrections(json.corrections, url);
                                        resolve(json.corrections);
                                        return;
                                    }
                                } catch (e) {}
                                tryFetch(index + 1);
                            });
                        } else {
                            tryFetch(index + 1);
                        }
                    });
                    req.on("error", function () {
                        tryFetch(index + 1);
                    });
                    req.setTimeout(7000, function () {
                        req.abort();
                        tryFetch(index + 1);
                    });
                } catch (e) {
                    tryFetch(index + 1);
                }
            };

            var tryFetch = function (index) {
                if (index >= urls.length) {
                    resolve(self.getRemoteCorrections());
                    return;
                }
                var url = urls[index];

                // Method A: Browser fetch (Uses Chromium's native network stack on Windows: system proxy, Windows cert store, UTF-8)
                if (typeof fetch !== "undefined") {
                    fetch(url, { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
                        .then(function (res) {
                            if (!res.ok) throw new Error("HTTP " + res.status);
                            return res.json();
                        })
                        .then(function (json) {
                            if (json && json.corrections) {
                                saveLoadedCorrections(json.corrections, url);
                                resolve(json.corrections);
                            } else {
                                tryNode(index, url);
                            }
                        })
                        .catch(function () {
                            tryNode(index, url);
                        });
                } else {
                    tryNode(index, url);
                }
            };

            tryFetch(0);
        });
    },

    getRemoteCorrections: function () {
        var corrections = {};

        // 1. Try local disk file in extension folder first
        try {
            var nodeReq = this.getNodeRequire();
            if (nodeReq) {
                var fs = nodeReq("fs");
                var path = nodeReq("path");
                var extDir = this.getExtensionDir();
                if (extDir) {
                    var diskPath = path.join(extDir, "corrections.json");
                    if (fs.existsSync(diskPath)) {
                        var rawDisk = fs.readFileSync(diskPath, "utf8");
                        var parsedDisk = JSON.parse(rawDisk);
                        if (parsedDisk && parsedDisk.corrections && typeof parsedDisk.corrections === "object") {
                            corrections = Object.assign({}, parsedDisk.corrections);
                        }
                    }
                }
            }
        } catch (e) {}

        // 2. Merge with localStorage
        try {
            var raw = localStorage.getItem("autocut_remote_corrections");
            if (raw) {
                var localObj = JSON.parse(raw);
                if (localObj && typeof localObj === "object") {
                    corrections = Object.assign(corrections, localObj);
                }
            }
        } catch (e) {}

        return corrections;
    },

    getCustomCorrections: function () {
        try {
            var raw = localStorage.getItem("autocut_caption_corrections");
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    },

    saveCustomCorrections: function (map) {
        try {
            localStorage.setItem("autocut_caption_corrections", JSON.stringify(map || {}));
        } catch (e) {}
    },

    correctHebrewSpelling: function (text) {
        if (!text) return "";
        var result = text;
        var custom = this.getCustomCorrections();
        var remote = this.getRemoteCorrections();

        var allMaps = [this.HEBREW_CORRECTIONS, remote, custom];
        for (var m = 0; m < allMaps.length; m++) {
            var map = allMaps[m];
            if (!map) continue;
            var keys = Object.keys(map).sort(function (a, b) { return b.length - a.length; });
            for (var k = 0; k < keys.length; k++) {
                var wrong = keys[k];
                if (wrong && map.hasOwnProperty(wrong)) {
                    var correct = map[wrong];
                    var escaped = wrong.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
                    if (wrong.indexOf(" ") === -1) {
                        // Single word: support optional Hebrew prefixes (ב, ל, מ, ש, ו, כ, ה)
                        var regex = new RegExp("(^|\\s|[.,!?;:״׳\"'\\(])([ובשמכלה]{0,3})" + escaped + "($|\\s|[.,!?;:״׳\"'\\)])", "g");
                        result = result.replace(regex, "$1$2" + correct + "$3");
                    } else {
                        // Multi-word phrase
                        var regex = new RegExp("(^|\\s|[.,!?;:״׳\"'\\(])" + escaped + "($|\\s|[.,!?;:״׳\"'\\)])", "gi");
                        result = result.replace(regex, "$1" + correct + "$2");
                    }
                }
            }
        }
        return result;
    },

    getNodeRequire: function () {
        if (typeof window !== "undefined" && window.cep_node && window.cep_node.require) return window.cep_node.require;
        if (typeof require !== "undefined") return require;
        if (typeof window !== "undefined" && typeof window.require !== "undefined") return window.require;
        return null;
    },

    getFfmpegPath: function () {
        var self = this;
        var nodeReq = self.getNodeRequire();
        if (!nodeReq) return "ffmpeg";
        var path = nodeReq("path");
        var fs = nodeReq("fs");
        var os = nodeReq("os");

        if (os.platform() !== "win32") return "ffmpeg";

        var normalizeWinDir = function (rawDir) {
            if (!rawDir) return "";
            var d = rawDir;
            try { d = decodeURIComponent(d); } catch (e) {
                try { d = decodeURI(d); } catch (e2) {}
            }
            return d.replace(/^file:\/\/\/?/i, "").replace(/^\/([a-zA-Z]:)/, "$1").replace(/\//g, "\\");
        };

        var dirs = [];

        // 1. From window.location
        try {
            if (typeof window !== "undefined" && window.location && window.location.pathname) {
                var locFile = normalizeWinDir(window.location.pathname);
                if (locFile) dirs.push(path.dirname(locFile));
            }
        } catch (e) {}

        // 2. From CSInterface.getSystemPath("extension")
        try {
            var extDir = "";
            if (typeof csInterface !== "undefined" && csInterface && csInterface.getSystemPath) {
                extDir = csInterface.getSystemPath("extension");
            } else if (typeof window !== "undefined" && window.csInterface && window.csInterface.getSystemPath) {
                extDir = window.csInterface.getSystemPath("extension");
            } else if (typeof CSInterface !== "undefined") {
                extDir = new CSInterface().getSystemPath("extension");
            }
            extDir = normalizeWinDir(extDir);
            if (extDir) dirs.push(extDir);
        } catch (e) {}

        // 3. Standard Windows CEP extension directories
        var homeDir = "";
        try { homeDir = os.homedir(); } catch (e) {}
        var appData = (typeof process !== "undefined" && process.env && process.env.APPDATA) || (homeDir ? path.join(homeDir, "AppData", "Roaming") : "");
        var localAppData = (typeof process !== "undefined" && process.env && process.env.LOCALAPPDATA) || (homeDir ? path.join(homeDir, "AppData", "Local") : "");
        var common64 = (typeof process !== "undefined" && process.env && (process.env.CommonProgramW6432 || process.env.CommonProgramFiles)) || "C:\\Program Files\\Common Files";
        var common86 = (typeof process !== "undefined" && process.env && process.env["CommonProgramFiles(x86)"]) || "C:\\Program Files (x86)\\Common Files";

        if (appData) dirs.push(path.join(appData, "Adobe", "CEP", "extensions", "com.autocut.panel"));
        if (homeDir) dirs.push(path.join(homeDir, "AppData", "Roaming", "Adobe", "CEP", "extensions", "com.autocut.panel"));
        if (localAppData) dirs.push(path.join(localAppData, "Adobe", "CEP", "extensions", "com.autocut.panel"));
        if (common86) dirs.push(path.join(common86, "Adobe", "CEP", "extensions", "com.autocut.panel"));
        if (common64) dirs.push(path.join(common64, "Adobe", "CEP", "extensions", "com.autocut.panel"));
        dirs.push("C:\\Program Files (x86)\\Common Files\\Adobe\\CEP\\extensions\\com.autocut.panel");
        dirs.push("C:\\Program Files\\Common Files\\Adobe\\CEP\\extensions\\com.autocut.panel");

        if (typeof __dirname !== "undefined") {
            dirs.push(__dirname);
            dirs.push(path.join(__dirname, ".."));
        }
        if (typeof process !== "undefined" && process.cwd) {
            try { dirs.push(process.cwd()); } catch (e) {}
        }

        var candidates = [];
        for (var dIdx = 0; dIdx < dirs.length; dIdx++) {
            var base = dirs[dIdx];
            if (!base) continue;
            candidates.push(path.join(base, "bin", "win", "ffmpeg.exe"));
            candidates.push(path.join(base, "bin", "ffmpeg.exe"));
            candidates.push(path.join(base, "ffmpeg.exe"));
        }

        for (var i = 0; i < candidates.length; i++) {
            try {
                if (candidates[i] && fs.existsSync(candidates[i])) {
                    return candidates[i];
                }
            } catch (err) {}
        }

        return "ffmpeg";
    },

    /**
     * Format seconds to SRT timestamp: HH:MM:SS,mmm
     */
    formatSrtTime: function (totalSeconds) {
        var sec = Math.max(0, totalSeconds);
        var hrs = Math.floor(sec / 3600);
        var mins = Math.floor((sec % 3600) / 60);
        var secs = Math.floor(sec % 60);
        var millis = Math.floor((sec - Math.floor(sec)) * 1000);

        var pad = function (n, z) {
            z = z || 2;
            var s = String(n);
            while (s.length < z) s = "0" + s;
            return s;
        };

        return pad(hrs, 2) + ":" + pad(mins, 2) + ":" + pad(secs, 2) + "," + pad(millis, 3);
    },

    /**
     * Extract audio from media file cross-platform:
     * - macOS: uses native /usr/bin/afconvert (AAC M4A or WAV)
     * - Windows: uses bundled ffmpeg with native WinRT MediaTranscoder fallback
     */
    extractAudio: function (mediaPath, onProgress) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var nodeReq = self.getNodeRequire();
            if (!nodeReq) return reject(new Error("Node.js runtime not accessible in CEP panel"));

            var cp = nodeReq("child_process");
            var os = nodeReq("os");
            var path = nodeReq("path");
            var fs = nodeReq("fs");

            if (!fs.existsSync(mediaPath)) return reject(new Error("קובץ המקור לא נמצא בדיסק: " + mediaPath));

            onProgress(15, "מחלץ אודיו לתמלול...");

            var ext = path.extname(mediaPath).toLowerCase();
            var stats = null;
            try { stats = fs.statSync(mediaPath); } catch (e) {}

            // Direct upload check: If media is already an audio file or small video supported directly by Groq (< 24 MB)
            var directAudioExts = [".mp3", ".m4a", ".wav", ".aac", ".ogg", ".flac"];
            var isDirectAudio = directAudioExts.indexOf(ext) !== -1;
            var isDirectVideo = (ext === ".mp4" || ext === ".webm" || ext === ".mpeg" || ext === ".mpga") && stats && stats.size < 24 * 1024 * 1024;

            if (stats && (isDirectAudio || isDirectVideo) && stats.size < 24 * 1024 * 1024) {
                var mime = "audio/wav";
                if (ext === ".mp3" || ext === ".mpga" || ext === ".mpeg") mime = "audio/mp3";
                else if (ext === ".m4a") mime = "audio/m4a";
                else if (ext === ".mp4") mime = "audio/mp4";
                else if (ext === ".webm") mime = "audio/webm";
                else if (ext === ".ogg") mime = "audio/ogg";
                else if (ext === ".flac") mime = "audio/flac";

                return resolve({
                    path: mediaPath,
                    type: mime,
                    filename: path.basename(mediaPath),
                    isTemp: false
                });
            }

            var isWin = (os.platform() === "win32");

            if (isWin) {
                // Windows extraction via bundled ffmpeg (compact 64kbps mono MP3/WAV so large files stay under Groq 25MB limit)
                var tempWav = path.join(os.tmpdir(), "autocut_caption_" + Date.now() + ".wav");
                var ffmpegBin = self.getFfmpegPath();
                var argsWin = ["-i", mediaPath, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", tempWav, "-y"];

                cp.execFile(ffmpegBin, argsWin, { windowsHide: true }, function (err, stdout, stderr) {
                    if (!err && fs.existsSync(tempWav)) {
                        return resolve({ path: tempWav, type: "audio/wav", filename: "audio.wav", isTemp: true });
                    }

                    // Fallback 1: Native Windows 10/11 MediaTranscoder (CreateM4a) via PowerShell
                    var tempM4a = path.join(os.tmpdir(), "autocut_caption_" + Date.now() + ".m4a");
                    var psIn = mediaPath.replace(/'/g, "''");
                    var psOut = tempM4a.replace(/'/g, "''");
                    var psScript = [
                        "$ErrorActionPreference = 'Stop'",
                        "Add-Type -AssemblyName System.Runtime.WindowsRuntime",
                        "$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]",
                        "$asTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]",
                        "Function Await($WinRtTask, $ResultType) { $asTask = $asTaskGeneric.MakeGenericMethod($ResultType); $netTask = $asTask.Invoke($null, @($WinRtTask)); $netTask.Wait(-1) | Out-Null; $netTask.Result }",
                        "Function AwaitAction($WinRtAction) { $netTask = $asTaskAction.Invoke($null, @($WinRtAction)); $netTask.Wait(-1) | Out-Null }",
                        "[void][Windows.Media.Transcoding.MediaTranscoder, Windows.Media, ContentType = WindowsRuntime]",
                        "[void][Windows.Media.MediaProperties.MediaEncodingProfile, Windows.Media, ContentType = WindowsRuntime]",
                        "[void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]",
                        "[void][Windows.Storage.StorageFolder, Windows.Storage, ContentType = WindowsRuntime]",
                        "$inPath = '" + psIn + "'",
                        "$outPath = '" + psOut + "'",
                        "$outDir = [System.IO.Path]::GetDirectoryName($outPath)",
                        "$outName = [System.IO.Path]::GetFileName($outPath)",
                        "$sIn = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($inPath)) ([Windows.Storage.StorageFile])",
                        "$fOut = Await ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync($outDir)) ([Windows.Storage.StorageFolder])",
                        "$sOut = Await ($fOut.CreateFileAsync($outName, [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])",
                        "$profile = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateM4a([Windows.Media.MediaProperties.AudioEncodingQuality]::Medium)",
                        "$transcoder = New-Object Windows.Media.Transcoding.MediaTranscoder",
                        "$prep = Await ($transcoder.PrepareFileTranscodeAsync($sIn, $sOut, $profile)) ([Windows.Media.Transcoding.PrepareTranscodeResult])",
                        "if ($prep.CanTranscode) { AwaitAction ($prep.TranscodeAsync()); exit 0 } else { exit 1 }"
                    ].join("; ");

                    cp.execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript], { windowsHide: true }, function (psErr) {
                        if (!psErr && fs.existsSync(tempM4a)) {
                            return resolve({ path: tempM4a, type: "audio/m4a", filename: "audio.m4a", isTemp: true });
                        }

                        // Direct WAV fallback
                        if (ext === ".wav") {
                            try {
                                fs.copyFileSync(mediaPath, tempWav);
                                return resolve({ path: tempWav, type: "audio/wav", filename: "audio.wav", isTemp: true });
                            } catch (copyErr) {}
                        }

                        var errMsg = "חילוץ אודיו נכשל ב-Windows. ודא ש-ffmpeg זמין או נמצא בתיקיית התוסף.";
                        if (stderr || (err && err.message)) {
                            errMsg += " שגיאה: " + (stderr || err.message);
                        }
                        return reject(new Error(errMsg));
                    });
                });
            } else {
                // macOS extraction via afconvert (built-in)
                var tempAudio = path.join(os.tmpdir(), "autocut_caption_" + Date.now() + ".m4a");
                var argsMac = ["-f", "m4af", "-d", "aac", "-c", "1", "-b", "64000", mediaPath, tempAudio];

                cp.execFile("/usr/bin/afconvert", argsMac, function (err, stdout, stderr) {
                    if (err) {
                        // Fallback to 16kHz mono WAV if m4af isn't supported for this source format
                        var tempWav = path.join(os.tmpdir(), "autocut_caption_" + Date.now() + ".wav");
                        var argsWav = ["-f", "WAVE", "-d", "LEI16@16000", "-c", "1", mediaPath, tempWav];
                        cp.execFile("/usr/bin/afconvert", argsWav, function (err2, out2, errStr2) {
                            if (err2) return reject(new Error("חילוץ אודיו נכשל ב-macOS: " + (errStr2 || err2.message)));
                            resolve({ path: tempWav, type: "audio/wav", filename: "audio.wav", isTemp: true });
                        });
                        return;
                    }
                    resolve({ path: tempAudio, type: "audio/m4a", filename: "audio.m4a", isTemp: true });
                });
            }
        });
    },

    /**
     * Send audio to Groq Whisper Large v3
     */
    transcribe: function (audioInfo, apiKey, language, onProgress) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var nodeReq = self.getNodeRequire();
            var fs = nodeReq("fs");

            var audioPath = (typeof audioInfo === "string") ? audioInfo : audioInfo.path;
            var mimeType = audioInfo.type || "audio/wav";
            var fileName = audioInfo.filename || "audio.wav";

            if (!fs.existsSync(audioPath)) return reject(new Error("קובץ האודיו הזמני לא נמצא"));

            onProgress(40, "מתמלל ב-Groq AI (Whisper Large v3)...");

            var fileBuffer = fs.readFileSync(audioPath);
            var blob = new Blob([fileBuffer], { type: mimeType });

            var formData = new FormData();
            formData.append("file", blob, fileName);
            formData.append("model", "whisper-large-v3");
            formData.append("response_format", "verbose_json");
            formData.append("temperature", "0.0");
            formData.append("timestamp_granularities[]", "word");
            formData.append("timestamp_granularities[]", "segment");

            if (language && language !== "auto") {
                formData.append("language", language);
            }

            // Guiding prompt in Hebrew for Whisper to maintain correct spelling, ktiv male and technical terminology
            var hebrewPrompt = "כתוביות בעברית תקנית, כתיב מלא, פיסוק נכון, מכבי, כריש, עריכת וידאו, פרמייר פרו, טיקטוק, אינסטגרם, יוטיוב, רילס, פודקאסט.";
            formData.append("prompt", hebrewPrompt);

            fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + apiKey.trim()
                },
                body: formData
            })
            .then(function (res) {
                if (!res.ok) {
                    return res.json().then(function (errData) {
                        var msg = (errData && errData.error && errData.error.message) ? errData.error.message : ("HTTP " + res.status);
                        if (res.status === 401) {
                            msg = "מפתח Groq API שגוי או לא בתוקף. אנא בדוק את המפתח שהזנת.";
                        }
                        throw new Error(msg);
                    }).catch(function (e) {
                        throw new Error(e.message || ("HTTP " + res.status));
                    });
                }
                return res.json();
            })
            .then(function (data) {
                if (audioInfo && audioInfo.isTemp !== false) {
                    try { fs.unlinkSync(audioPath); } catch (e) {}
                }
                resolve(data);
            })
            .catch(function (err) {
                if (audioInfo && audioInfo.isTemp !== false) {
                    try { fs.unlinkSync(audioPath); } catch (e) {}
                }
                reject(err);
            });
        });
    },

    /**
     * Map Whisper results across all timeline clips of the entire sequence
     * @param {Object} whisperResultsByPath - Map of { mediaPath: whisperResult }
     * @param {Array} timelineClips - Array of clips on the timeline
     * @param {Object} options - { syncDelay, wordCount, includePunctuation }
     */
    buildTimelineSrt: function (whisperResultsByPath, timelineClips, options) {
        var self = this;
        options = options || {};
        var syncDelay = (typeof options.syncDelay !== "undefined") ? Number(options.syncDelay) : 0.12;
        var wordCount = options.wordCount ? parseInt(options.wordCount, 10) : 3;
        if (isNaN(wordCount) || wordCount < 1) wordCount = 3;
        var includePunctuation = (typeof options.includePunctuation !== "undefined") ? Boolean(options.includePunctuation) : true;

        var cleanText = function (str) {
            var s = (str || "").trim();
            if (!includePunctuation) {
                s = s.replace(/[,.!?;:"'״׳—…\-]/g, "").replace(/\s+/g, " ").trim();
            }
            s = self.correctHebrewSpelling(s);
            return s;
        };

        var allTimelineWords = [];

        // Loop through EVERY clip on the sequence timeline in chronological order
        for (var c = 0; c < timelineClips.length; c++) {
            var clip = timelineClips[c];
            var whisperData = whisperResultsByPath[clip.path];
            if (!whisperData) continue;

            if (whisperData.words && whisperData.words.length > 0) {
                for (var w = 0; w < whisperData.words.length; w++) {
                    var wordObj = whisperData.words[w];
                    var mid = (wordObj.start + wordObj.end) / 2;

                    // If word's position in the source media falls within this clip's inPoint/outPoint
                    if (mid >= clip.inPoint - 0.12 && mid <= clip.outPoint + 0.12) {
                        var offset = Math.max(0, wordObj.start - clip.inPoint);
                        var dur = Math.max(0.12, wordObj.end - wordObj.start);
                        var wStart = clip.start + offset;
                        var wEnd = Math.min(clip.end, wStart + dur);
                        var wordClean = cleanText(wordObj.word);

                        if (wordClean && wEnd > wStart) {
                            if (options && options.scope === "inout" && typeof options.rangeStart === "number" && typeof options.rangeEnd === "number") {
                                var wordMid = (wStart + wEnd) / 2;
                                if (wordMid < options.rangeStart || wordMid > options.rangeEnd) {
                                    continue;
                                }
                            }
                            allTimelineWords.push({
                                word: wordClean,
                                start: wStart,
                                end: wEnd
                            });
                        }
                    }
                }
            } else if (whisperData.segments && whisperData.segments.length > 0) {
                // Segment fallback
                for (var s = 0; s < whisperData.segments.length; s++) {
                    var seg = whisperData.segments[s];
                    var segMid = (seg.start + seg.end) / 2;
                    if (segMid >= clip.inPoint - 0.2 && segMid <= clip.outPoint + 0.2) {
                        var segOffset = Math.max(0, seg.start - clip.inPoint);
                        var segDur = Math.max(0.3, seg.end - seg.start);
                        var sStart = clip.start + segOffset;
                        var sEnd = Math.min(clip.end, sStart + segDur);
                        var txt = cleanText(seg.text);
                        if (txt) {
                            var segWordsList = txt.split(/\s+/).filter(Boolean);
                            var perWordDur = (sEnd - sStart) / Math.max(1, segWordsList.length);
                            for (var sw = 0; sw < segWordsList.length; sw++) {
                                var pwStart = sStart + sw * perWordDur;
                                var pwEnd = sStart + (sw + 1) * perWordDur;
                                if (options && options.scope === "inout" && typeof options.rangeStart === "number" && typeof options.rangeEnd === "number") {
                                    var pwMid = (pwStart + pwEnd) / 2;
                                    if (pwMid < options.rangeStart || pwMid > options.rangeEnd) {
                                        continue;
                                    }
                                }
                                allTimelineWords.push({
                                    word: segWordsList[sw],
                                    start: pwStart,
                                    end: pwEnd
                                });
                            }
                        }
                    }
                }
            }
        }

        // Sort all mapped words across the entire sequence chronologically
        allTimelineWords.sort(function (a, b) { return a.start - b.start; });

        if (allTimelineWords.length === 0) {
            return options && options._returnCuesOnly ? [] : "";
        }

        var stretchGaps = Boolean(options.stretchGaps);

        // Group into cues of wordCount
        var cues = [];
        var prevEnd = 0;

        for (var i = 0; i < allTimelineWords.length; i += wordCount) {
            var chunk = allTimelineWords.slice(i, i + wordCount);
            var rawStart = chunk[0].start;
            var rawEnd = chunk[chunk.length - 1].end;

            var startTime = Math.max(0, rawStart + syncDelay);
            var endTime = Math.max(startTime + Math.max(0.35, chunk.length * 0.14), rawEnd + syncDelay);

            if (startTime < prevEnd) {
                startTime = prevEnd;
                if (endTime <= startTime) {
                    endTime = startTime + Math.max(0.35, chunk.length * 0.14);
                }
            }
            prevEnd = endTime;

            var text = chunk.map(function (w) { return w.word; }).join(" ");
            text = self.correctHebrewSpelling(text);
            if (text) {
                var correctedParts = text.split(/\s+/).filter(Boolean);
                var rawWords = [];
                if (correctedParts.length === chunk.length) {
                    for (var cw = 0; cw < chunk.length; cw++) {
                        rawWords.push({
                            word: correctedParts[cw],
                            rawStart: chunk[cw].start + syncDelay,
                            rawEnd: chunk[cw].end + syncDelay
                        });
                    }
                } else {
                    var stepDur = (endTime - startTime) / Math.max(1, correctedParts.length);
                    for (var cp = 0; cp < correctedParts.length; cp++) {
                        rawWords.push({
                            word: correctedParts[cp],
                            rawStart: startTime + cp * stepDur,
                            rawEnd: startTime + (cp + 1) * stepDur
                        });
                    }
                }

                cues.push({
                    start: startTime,
                    end: endTime,
                    text: text,
                    rawWords: rawWords
                });
            }
        }

        // If stretchGaps is active: extend each cue's end time right up to the start of the next cue
        if (stretchGaps) {
            for (var k = 0; k < cues.length - 1; k++) {
                if (cues[k].end < cues[k + 1].start) {
                    cues[k].end = cues[k + 1].start;
                }
            }
        }

        // Clamp cues to range if scope is inout
        if (options && options.scope === "inout") {
            if (typeof options.rangeStart === "number") {
                for (var c1 = 0; c1 < cues.length; c1++) {
                    if (cues[c1].start < options.rangeStart) {
                        cues[c1].start = options.rangeStart;
                    }
                }
            }
            if (typeof options.rangeEnd === "number") {
                for (var c2 = 0; c2 < cues.length; c2++) {
                    if (cues[c2].end > options.rangeEnd) {
                        cues[c2].end = options.rangeEnd;
                    }
                }
            }
            cues = cues.filter(function (cue) {
                return (cue.end - cue.start) > 0.05;
            });
        }

        // Compute contiguous per-word intervals within each cue so word-by-word highlight never flickers
        for (var q = 0; q < cues.length; q++) {
            var cueItem = cues[q];
            var rw = cueItem.rawWords || [];
            var wordTimings = [];
            var n = rw.length;
            var minWordDur = 0.08;

            if (n === 1) {
                wordTimings.push({
                    word: rw[0].word,
                    start: cueItem.start,
                    end: cueItem.end
                });
            } else if (n > 1) {
                var curStart = cueItem.start;
                for (var idx = 0; idx < n; idx++) {
                    var wStart = (idx === 0) ? cueItem.start : Math.max(curStart, rw[idx].rawStart);
                    var maxAllowedStart = cueItem.end - (n - idx) * minWordDur;
                    if (wStart > maxAllowedStart) {
                        wStart = maxAllowedStart;
                    }
                    if (idx > 0) {
                        wordTimings[idx - 1].end = wStart;
                    }
                    wordTimings.push({
                        word: rw[idx].word,
                        start: wStart,
                        end: cueItem.end
                    });
                    curStart = wStart + minWordDur;
                }
                wordTimings[n - 1].end = cueItem.end;
            }
            cueItem.words = wordTimings;
        }

        if (options && options._returnCuesOnly) {
            return cues;
        }

        // Build SRT output blocks
        var srtBlocks = [];
        for (var b = 0; b < cues.length; b++) {
            var cue = cues[b];
            srtBlocks.push(
                (b + 1) + "\n" +
                self.formatSrtTime(cue.start) + " --> " + self.formatSrtTime(cue.end) + "\n" +
                cue.text + "\n"
            );
        }

        return srtBlocks.join("\n");
    },

    /**
     * Draw a rounded rectangle path on an HTML5 Canvas 2D context
     */
    drawRoundedRect: function (ctx, x, y, width, height, radius) {
        var r = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + width - r, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + r);
        ctx.lineTo(x + width, y + height - r);
        ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        ctx.lineTo(x + r, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    },

    /**
     * Render transparent PNG overlay frames for each spoken word with a colored marker highlight box
     */
    renderHighlightFrames: function (cues, options, onProgress) {
        var self = this;
        options = options || {};
        return new Promise(function (resolve, reject) {
            try {
                var nodeReq = self.getNodeRequire();
                if (!nodeReq) return reject(new Error("Node.js runtime not available for rendering highlight frames"));
                var fs = nodeReq("fs");
                var os = nodeReq("os");
                var path = nodeReq("path");

                var seqWidth = parseInt(options.seqWidth, 10) || 1080;
                var seqHeight = parseInt(options.seqHeight, 10) || 1920;
                var highlightColor = options.highlightColor || "#FACC15";

                var outDir = path.join(os.tmpdir(), "autocut_hl_" + Date.now());
                if (!fs.existsSync(outDir)) {
                    fs.mkdirSync(outDir, { recursive: true });
                }

                var fontReadyPromise = (typeof document !== "undefined" && document.fonts && document.fonts.ready)
                    ? document.fonts.ready
                    : Promise.resolve();

                fontReadyPromise.then(function () {
                    var canvas = document.createElement("canvas");
                    canvas.width = seqWidth;
                    canvas.height = seqHeight;
                    var ctx = canvas.getContext("2d");

                    var minDim = Math.min(seqWidth, seqHeight);
                    var fontSize = Math.round(minDim * 0.068);
                    var lineHeight = Math.round(fontSize * 1.38);
                    var spaceW = Math.round(fontSize * 0.32);
                    var maxLineWidth = Math.round(seqWidth * 0.84);
                    var baseCenterY = Math.round(seqHeight * 0.78);

                    var padX = Math.round(fontSize * 0.21);
                    var padY = Math.round(fontSize * 0.13);
                    var cornerRadius = Math.round(fontSize * 0.22);
                    var strokeW = Math.max(4, Math.round(fontSize * 0.16));

                    var items = [];
                    var frameCounter = 0;

                    for (var cIdx = 0; cIdx < cues.length; cIdx++) {
                        var cue = cues[cIdx];
                        var wordsArr = cue.words || [];
                        if (wordsArr.length === 0) continue;

                        ctx.font = "900 " + fontSize + "px 'Heebo', 'Arial', sans-serif";
                        ctx.direction = "rtl";
                        ctx.textBaseline = "middle";
                        ctx.textAlign = "center";

                        // Measure each word and wrap into RTL lines if needed
                        var lines = [];
                        var currentLine = [];
                        var currentLineWidth = 0;

                        for (var m = 0; m < wordsArr.length; m++) {
                            var wText = wordsArr[m].word;
                            var wWidth = Math.ceil(ctx.measureText(wText).width);
                            var addedWidth = (currentLine.length === 0) ? wWidth : (spaceW + wWidth);

                            if (currentLine.length > 0 && (currentLineWidth + addedWidth) > maxLineWidth) {
                                lines.push({ words: currentLine, totalWidth: currentLineWidth });
                                currentLine = [{ index: m, word: wText, width: wWidth }];
                                currentLineWidth = wWidth;
                            } else {
                                currentLine.push({ index: m, word: wText, width: wWidth });
                                currentLineWidth += addedWidth;
                            }
                        }
                        if (currentLine.length > 0) {
                            lines.push({ words: currentLine, totalWidth: currentLineWidth });
                        }

                        // Compute locked coordinates for every word in this cue (Right-to-Left)
                        var wordLayouts = new Array(wordsArr.length);
                        var totalBlockHeight = (lines.length - 1) * lineHeight;
                        var startLineY = baseCenterY - Math.round(totalBlockHeight / 2);

                        for (var lIdx = 0; lIdx < lines.length; lIdx++) {
                            var lineObj = lines[lIdx];
                            var lineY = startLineY + lIdx * lineHeight;
                            var cursorRightX = Math.round((seqWidth + lineObj.totalWidth) / 2);

                            for (var lw = 0; lw < lineObj.words.length; lw++) {
                                var itemW = lineObj.words[lw];
                                var wRight = cursorRightX;
                                var wLeft = wRight - itemW.width;
                                var wCenterX = Math.round((wLeft + wRight) / 2);

                                wordLayouts[itemW.index] = {
                                    word: itemW.word,
                                    left: wLeft,
                                    right: wRight,
                                    width: itemW.width,
                                    centerX: wCenterX,
                                    centerY: lineY
                                };

                                cursorRightX = wLeft - spaceW;
                            }
                        }

                        // Render one PNG state per active word in this cue
                        for (var activeIdx = 0; activeIdx < wordsArr.length; activeIdx++) {
                            var wTiming = wordsArr[activeIdx];
                            var activeLayout = wordLayouts[activeIdx];
                            if (!activeLayout) continue;

                            ctx.clearRect(0, 0, seqWidth, seqHeight);
                            ctx.font = "900 " + fontSize + "px 'Heebo', 'Arial', sans-serif";
                            ctx.direction = "rtl";
                            ctx.textBaseline = "middle";
                            ctx.textAlign = "center";

                            // 1. Draw the colored Marker Highlight box behind the active word
                            var boxX = activeLayout.left - padX;
                            var boxY = activeLayout.centerY - Math.round(fontSize * 0.52) - padY;
                            var boxW = activeLayout.width + padX * 2;
                            var boxH = Math.round(fontSize * 1.04) + padY * 2;

                            ctx.save();
                            ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
                            ctx.shadowBlur = Math.round(fontSize * 0.2);
                            ctx.shadowOffsetX = 0;
                            ctx.shadowOffsetY = Math.round(fontSize * 0.06);
                            ctx.fillStyle = highlightColor;
                            self.drawRoundedRect(ctx, boxX, boxY, boxW, boxH, cornerRadius);
                            ctx.fill();
                            ctx.restore();

                            // 2. Draw all words of the sentence in their locked positions
                            for (var dIdx = 0; dIdx < wordLayouts.length; dIdx++) {
                                var wl = wordLayouts[dIdx];
                                if (!wl) continue;

                                ctx.save();
                                ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
                                ctx.shadowBlur = Math.round(fontSize * 0.14);
                                ctx.shadowOffsetX = 0;
                                ctx.shadowOffsetY = Math.round(fontSize * 0.05);

                                ctx.lineJoin = "round";
                                ctx.lineCap = "round";
                                ctx.miterLimit = 2;
                                ctx.strokeStyle = "#000000";
                                ctx.lineWidth = strokeW;
                                ctx.strokeText(wl.word, wl.centerX, wl.centerY);

                                ctx.shadowColor = "transparent";
                                ctx.fillStyle = "#FFFFFF";
                                ctx.fillText(wl.word, wl.centerX, wl.centerY);
                                ctx.restore();
                            }

                            frameCounter++;
                            var padNum = ("0000" + frameCounter).slice(-4);
                            var runTag = String(Date.now()).slice(-4);
                            var pngName = "hl_" + runTag + "_" + padNum + ".png";
                            var pngPath = path.join(outDir, pngName);

                            var dataUrl = canvas.toDataURL("image/png");
                            var base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
                            fs.writeFileSync(pngPath, Buffer.from(base64Data, "base64"));

                            items.push({
                                pngName: pngName,
                                pngPath: pngPath,
                                start: Number(wTiming.start.toFixed(3)),
                                end: Number(wTiming.end.toFixed(3)),
                                word: wTiming.word
                            });
                        }

                        if (onProgress && cIdx % 4 === 0) {
                            var renderPct = 86 + Math.round(((cIdx + 1) / cues.length) * 8);
                            onProgress(renderPct, "מייצר מרקר על המילים (" + (cIdx + 1) + "/" + cues.length + ")...");
                        }
                    }

                    resolve({
                        outDir: outDir,
                        items: items
                    });
                }).catch(reject);
            } catch (err) {
                reject(err);
            }
        });
    },

    /**
     * Generate captions for the ENTIRE active sequence across all its clips
     */
    generateCaptionsForSequence: function (timelineClips, apiKey, language, options, onProgress) {
        var self = this;
        return new Promise(function (resolve, reject) {
            if (!apiKey || !apiKey.trim()) {
                return reject(new Error("נא להזין מפתח Groq API חינמי."));
            }
            if (!timelineClips || timelineClips.length === 0) {
                return reject(new Error("לא נמצאו קליפים בסיקוונס הפעיל."));
            }

            var targetClips = timelineClips;
            if (options && options.scope === "inout" && typeof options.rangeStart === "number" && typeof options.rangeEnd === "number") {
                targetClips = timelineClips.filter(function (clip) {
                    return clip.end > options.rangeStart + 0.01 && clip.start < options.rangeEnd - 0.01;
                });
                if (targetClips.length === 0) {
                    return reject(new Error("לא נמצאו קליפים בטווח ה-In/Out שנבחר בסיקוונס."));
                }
            }

            // Find distinct media file paths in the sequence
            var uniquePaths = [];
            for (var i = 0; i < targetClips.length; i++) {
                var p = targetClips[i].path;
                if (p && uniquePaths.indexOf(p) === -1) {
                    uniquePaths.push(p);
                }
            }

            var whisperResultsByPath = {};
            var currentPathIdx = 0;

            var processNextPath = function () {
                if (currentPathIdx >= uniquePaths.length) {
                    var isInOut = (options && options.scope === "inout");
                    var targetLabel = isInOut ? "לטווח In/Out" : "לכל הסיקוונס";
                    onProgress(85, "מעבד ומסנכרן כתוביות " + targetLabel + "...");
                    try {
                        var cueOpts = {};
                        if (options) {
                            for (var k in options) {
                                if (Object.prototype.hasOwnProperty.call(options, k)) cueOpts[k] = options[k];
                            }
                        }
                        cueOpts._returnCuesOnly = true;
                        var cues = self.buildTimelineSrt(whisperResultsByPath, targetClips, cueOpts);
                        if (!cues || cues.length === 0) {
                            return reject(new Error(isInOut ? "לא זוהה דיבור בטווח ה-In/Out שנבחר." : "לא זוהה דיבור ברור בקליפים בסיקוונס."));
                        }

                        self.lastGeneratedCues = cues;
                        self.lastGeneratedOptions = options || {};
                        try {
                            localStorage.setItem("autocut_last_cues", JSON.stringify(cues));
                            localStorage.setItem("autocut_last_options", JSON.stringify(options || {}));
                        } catch (e) {}

                        var srtBlocks = [];
                        for (var b = 0; b < cues.length; b++) {
                            var cue = cues[b];
                            srtBlocks.push(
                                (b + 1) + "\n" +
                                self.formatSrtTime(cue.start) + " --> " + self.formatSrtTime(cue.end) + "\n" +
                                cue.text + "\n"
                            );
                        }
                        var srtContent = srtBlocks.join("\n");

                        var nodeReq = self.getNodeRequire();
                        var fs = nodeReq("fs");
                        var os = nodeReq("os");
                        var path = nodeReq("path");

                        var srtPath = path.join(os.tmpdir(), "captions_" + Date.now() + ".srt");
                        // UTF-8 with BOM (\uFEFF) for proper Hebrew RTL rendering in Premiere Pro
                        var bom = "\uFEFF";
                        fs.writeFileSync(srtPath, bom + srtContent, "utf8");

                        if (options && options.highlightWords) {
                            onProgress(86, "מייצר שכבות מרקר (הייליט) לכל מילה...");
                            self.renderHighlightFrames(cues, options, onProgress).then(function (hlData) {
                                var manifestPath = path.join(hlData.outDir, "manifest.json");
                                var manifestObj = {
                                    srtPath: srtPath,
                                    highlightColor: options.highlightColor || "#FACC15",
                                    items: hlData.items
                                };
                                fs.writeFileSync(manifestPath, JSON.stringify(manifestObj), "utf8");

                                onProgress(100, "כתוביות המרקר " + targetLabel + " מוכנות!");
                                resolve({
                                    srtPath: srtPath,
                                    blocksCount: cues.length,
                                    highlightWords: true,
                                    highlightManifestPath: manifestPath,
                                    highlightClipsCount: hlData.items.length,
                                    cues: cues
                                });
                            }).catch(reject);
                            return;
                        }

                        onProgress(100, "הכתוביות " + targetLabel + " מוכנות!");

                        resolve({
                            srtPath: srtPath,
                            blocksCount: cues.length,
                            highlightWords: false,
                            cues: cues
                        });
                    } catch (e) {
                        reject(e);
                    }
                    return;
                }

                var mediaPath = uniquePaths[currentPathIdx];
                var pctBase = Math.round((currentPathIdx / uniquePaths.length) * 70);

                onProgress(pctBase + 10, "מחלץ שמע (" + (currentPathIdx + 1) + "/" + uniquePaths.length + ")...");

                self.extractAudio(mediaPath, function (p, msg) {
                    onProgress(pctBase + Math.round(p * 0.3), msg);
                }).then(function (audioInfo) {
                    onProgress(pctBase + 35, "מתמלל ב-Groq AI (" + (currentPathIdx + 1) + "/" + uniquePaths.length + ")...");
                    return self.transcribe(audioInfo, apiKey, language, function (p, msg) {
                        onProgress(pctBase + 35 + Math.round(p * 0.4), msg);
                    });
                }).then(function (whisperResult) {
                    whisperResultsByPath[mediaPath] = whisperResult;
                    currentPathIdx++;
                    processNextPath();
                }).catch(reject);
            };

            // Ensure fresh remote corrections are loaded from cloud before transcription starts
            self.fetchRemoteCorrections().catch(function () {}).then(function () {
                processNextPath();
            });
        });
    },

    /**
     * Re-generate SRT and word-highlight marker frames from edited cues (instant, no AI API call)
     */
    regenerateFromEditedCues: function (cues, options, onProgress) {
        var self = this;
        return new Promise(function (resolve, reject) {
            try {
                if (!cues || cues.length === 0) {
                    return reject(new Error("אין שורות כתוביות לעדכון."));
                }
                self.lastGeneratedCues = cues;
                self.lastGeneratedOptions = options || {};
                try {
                    localStorage.setItem("autocut_last_cues", JSON.stringify(cues));
                    localStorage.setItem("autocut_last_options", JSON.stringify(options || {}));
                } catch (e) {}

                var srtBlocks = [];
                for (var b = 0; b < cues.length; b++) {
                    var cue = cues[b];
                    srtBlocks.push(
                        (b + 1) + "\n" +
                        self.formatSrtTime(cue.start) + " --> " + self.formatSrtTime(cue.end) + "\n" +
                        cue.text + "\n"
                    );
                }
                var srtContent = srtBlocks.join("\n");

                var nodeReq = self.getNodeRequire();
                var fs = nodeReq("fs");
                var os = nodeReq("os");
                var path = nodeReq("path");

                var srtPath = path.join(os.tmpdir(), "captions_" + Date.now() + ".srt");
                var bom = "\uFEFF";
                fs.writeFileSync(srtPath, bom + srtContent, "utf8");

                if (options && options.highlightWords) {
                    if (onProgress) onProgress(30, "מייצר מחדש שכבות מרקר עם הטקסט המתוקן...");
                    self.renderHighlightFrames(cues, options, function (p, msg) {
                        if (onProgress) onProgress(p, msg);
                    }).then(function (hlData) {
                        var manifestPath = path.join(hlData.outDir, "manifest.json");
                        var manifestObj = {
                            srtPath: srtPath,
                            highlightColor: options.highlightColor || "#FACC15",
                            items: hlData.items
                        };
                        fs.writeFileSync(manifestPath, JSON.stringify(manifestObj), "utf8");

                        resolve({
                            srtPath: srtPath,
                            blocksCount: cues.length,
                            highlightWords: true,
                            highlightManifestPath: manifestPath,
                            highlightClipsCount: hlData.items.length,
                            cues: cues
                        });
                    }).catch(reject);
                    return;
                }

                resolve({
                    srtPath: srtPath,
                    blocksCount: cues.length,
                    highlightWords: false,
                    cues: cues
                });
            } catch (e) {
                reject(e);
            }
        });
    },

    /**
     * Backward-compatible entrypoint
     */
    generateCaptions: function (mediaPathOrClips, apiKey, language, options, onProgress) {
        if (Array.isArray(mediaPathOrClips)) {
            return this.generateCaptionsForSequence(mediaPathOrClips, apiKey, language, options, onProgress);
        }

        // If single mediaPath, wrap it as a single timeline clip
        var clip = {
            path: mediaPathOrClips,
            start: (options && options.clipStart) || 0,
            end: 999999,
            inPoint: (options && options.clipInPoint) || 0,
            outPoint: 999999
        };
        return this.generateCaptionsForSequence([clip], apiKey, language, options, onProgress);
    }
};
