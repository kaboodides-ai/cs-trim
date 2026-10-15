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
        "מערכת": "מארחת",
        "ספוטיפי": "ספוטיפיי"
    },

    REMOTE_URLS: [
        "https://raw.githubusercontent.com/kaboodides-ai/cs-trim/main/website/corrections.json",
        "https://cstrim.vercel.app/corrections.json"
    ],

    fetchRemoteCorrections: function () {
        var self = this;
        return new Promise(function (resolve) {
            var urls = self.REMOTE_URLS;
            var nodeReq = self.getNodeRequire();

            var tryUrl = function (index) {
                if (index >= urls.length) {
                    resolve(self.getRemoteCorrections());
                    return;
                }
                var url = urls[index];

                // Method A: Node.js https (works reliably inside Adobe CEP without CORS)
                if (nodeReq) {
                    try {
                        var https = nodeReq("https");
                        https.get(url, { headers: { "User-Agent": "cs-trim-cep" } }, function (res) {
                            if (res.statusCode >= 200 && res.statusCode < 300) {
                                var body = "";
                                res.on("data", function (chunk) { body += chunk; });
                                res.on("end", function () {
                                    try {
                                        var json = JSON.parse(body);
                                        if (json && json.corrections) {
                                            localStorage.setItem("autocut_remote_corrections", JSON.stringify(json.corrections));
                                            console.log("[CS Trim] Loaded " + Object.keys(json.corrections).length + " remote corrections from cloud (" + url + ")");
                                            resolve(json.corrections);
                                            return;
                                        }
                                    } catch (e) {}
                                    tryUrl(index + 1);
                                });
                            } else {
                                tryUrl(index + 1);
                            }
                        }).on("error", function () {
                            tryUrl(index + 1);
                        });
                        return;
                    } catch (e) {}
                }

                // Method B: Browser fetch
                if (typeof fetch !== "undefined") {
                    fetch(url, { cache: "no-cache" })
                        .then(function (res) { return res.ok ? res.json() : null; })
                        .then(function (json) {
                            if (json && json.corrections) {
                                localStorage.setItem("autocut_remote_corrections", JSON.stringify(json.corrections));
                                console.log("[CS Trim] Loaded " + Object.keys(json.corrections).length + " remote corrections from cloud (" + url + ")");
                                resolve(json.corrections);
                            } else {
                                tryUrl(index + 1);
                            }
                        })
                        .catch(function () {
                            tryUrl(index + 1);
                        });
                    return;
                }

                tryUrl(index + 1);
            };

            tryUrl(0);
        });
    },

    getRemoteCorrections: function () {
        try {
            var raw = localStorage.getItem("autocut_remote_corrections");
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
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
            for (var wrong in map) {
                if (map.hasOwnProperty(wrong) && wrong) {
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
                                allTimelineWords.push({
                                    word: segWordsList[sw],
                                    start: sStart + sw * perWordDur,
                                    end: sStart + (sw + 1) * perWordDur
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
            return "";
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
            var endTime = Math.max(startTime + 0.35, rawEnd + syncDelay);

            if (startTime < prevEnd) {
                startTime = prevEnd;
                if (endTime <= startTime) {
                    endTime = startTime + 0.35;
                }
            }
            prevEnd = endTime;

            var text = chunk.map(function (w) { return w.word; }).join(" ");
            text = self.correctHebrewSpelling(text);
            if (text) {
                cues.push({
                    start: startTime,
                    end: endTime,
                    text: text
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

            // Find distinct media file paths in the sequence
            var uniquePaths = [];
            for (var i = 0; i < timelineClips.length; i++) {
                var p = timelineClips[i].path;
                if (p && uniquePaths.indexOf(p) === -1) {
                    uniquePaths.push(p);
                }
            }

            var whisperResultsByPath = {};
            var currentPathIdx = 0;

            var processNextPath = function () {
                if (currentPathIdx >= uniquePaths.length) {
                    // All media files transcribed! Now build full-sequence SRT
                    onProgress(85, "מעבד ומסנכרן כתוביות לכל הסיקוונס...");
                    try {
                        var srtContent = self.buildTimelineSrt(whisperResultsByPath, timelineClips, options);
                        if (!srtContent || !srtContent.trim()) {
                            return reject(new Error("לא זוהה דיבור ברור בקליפים בסיקוונס."));
                        }

                        var nodeReq = self.getNodeRequire();
                        var fs = nodeReq("fs");
                        var os = nodeReq("os");
                        var path = nodeReq("path");

                        var srtPath = path.join(os.tmpdir(), "captions_" + Date.now() + ".srt");
                        // UTF-8 with BOM (\uFEFF) for proper Hebrew RTL rendering in Premiere Pro
                        var bom = "\uFEFF";
                        fs.writeFileSync(srtPath, bom + srtContent, "utf8");

                        onProgress(100, "הכתוביות לכל הסיקוונס מוכנות!");

                        var blockMatches = srtContent.match(/\d+\n\d\d:/g) || [];
                        resolve({
                            srtPath: srtPath,
                            blocksCount: blockMatches.length
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
