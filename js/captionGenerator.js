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

    // Whisper reads the prompt as the transcript that came before the audio and copies its style.
    // A formal prompt makes it "clean up" speech: slang gets swapped for standard words and short words
    // like אבל / זה get dropped. A verbatim, colloquial sample keeps it writing what was actually said.
    SPEECH_STYLE_PROMPT: "אמאלה, אחשלי, זה היה מטורף. אבל רגע, תקשיב אחי, וואלה תכלס זה אשכרה עובד. יאללה סבבה, כפרה עליך, נו באמת, חבל על הזמן.",

    // Groq caps the prompt at 224 tokens; a Hebrew character is at most one Whisper token
    PROMPT_MAX_CHARS: 220,

    /**
     * Whisper prompt: the user's own corrected words (so it learns their names and terms), then the style sample last,
     * since the text closest to the audio steers it most.
     */
    buildPrompt: function () {
        var style = this.SPEECH_STYLE_PROMPT;
        var budget = this.PROMPT_MAX_CHARS - style.length - 1;
        var custom = this.getCustomCorrections();
        var seen = {};
        var vocab = [];
        var used = 0;
        for (var key in custom) {
            if (!Object.prototype.hasOwnProperty.call(custom, key)) continue;
            var term = String(custom[key] || "").trim();
            if (!term || seen[term] || style.indexOf(term) !== -1) continue;
            if (used + term.length + 2 > budget) break;
            seen[term] = true;
            vocab.push(term);
            used += term.length + 2;
        }
        return vocab.length ? vocab.join(", ") + ". " + style : style;
    },

    normalizeToken: function (str) {
        return String(str || "").replace(/[.,!?;:"'״׳—…\-()\[\]]/g, "").trim().toLowerCase();
    },

    /**
     * Whisper's word list sometimes leaves out words that are in the segment text (often short ones like אבל / זה).
     * Rebuild the word list per segment: keep every timed word, add the segment words it skipped with timings
     * spread over the gap they were spoken in, and drop segments that are silence hallucinations.
     */
    reconcileWords: function (whisperData) {
        var self = this;
        var words = whisperData.words || [];
        var segs = whisperData.segments || [];
        if (words.length === 0 || segs.length === 0) return words;

        var styleNorm = self.normalizeToken(self.SPEECH_STYLE_PROMPT).replace(/\s+/g, " ");
        var out = [];
        var wi = 0;

        for (var s = 0; s < segs.length; s++) {
            var seg = segs[s];
            var segWords = [];
            while (wi < words.length && (words[wi].start + words[wi].end) / 2 <= seg.end + 0.05) {
                segWords.push(words[wi++]);
            }

            // Silence that Whisper filled in: its own no-speech rule, or a long stretch of the prompt echoed back
            // (short slang phrases from the prompt are real speech too, so those stay)
            var segNorm = self.normalizeToken(seg.text).replace(/\s+/g, " ");
            var isSilence = seg.no_speech_prob > 0.6 && seg.avg_logprob < -1.0;
            var isPromptEcho = segNorm.split(" ").length >= 6 && styleNorm.indexOf(segNorm) !== -1;
            if (isSilence || isPromptEcho) continue;

            var tokens = String(seg.text || "").split(/\s+/).filter(function (t) { return self.normalizeToken(t); });
            if (tokens.length <= segWords.length) {
                for (var k = 0; k < segWords.length; k++) out.push(segWords[k]);
                continue;
            }

            // Align segment text to the timed words (longest common subsequence)
            var a = segWords.map(function (w) { return self.normalizeToken(w.word); });
            var b = tokens.map(function (t) { return self.normalizeToken(t); });
            var dp = [];
            for (var i = 0; i <= a.length; i++) {
                dp.push([]);
                for (var j = 0; j <= b.length; j++) {
                    if (i === 0 || j === 0) dp[i][j] = 0;
                    else if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
                    else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }

            // Different tokenization (numbers, English, hyphens) rather than missing words: keep the timed words as-is
            if (dp[a.length][b.length] < Math.ceil(a.length * 0.7)) {
                for (var k2 = 0; k2 < segWords.length; k2++) out.push(segWords[k2]);
                continue;
            }

            // Walk back through the alignment: entries are a timed word, or a segment token with no timing yet
            var merged = [];
            var ai = a.length, bj = b.length;
            while (ai > 0 || bj > 0) {
                if (ai > 0 && bj > 0 && a[ai - 1] === b[bj - 1]) {
                    merged.unshift({ word: segWords[ai - 1] });
                    ai--; bj--;
                } else if (bj > 0 && (ai === 0 || dp[ai][bj - 1] >= dp[ai - 1][bj])) {
                    merged.unshift({ token: tokens[bj - 1].replace(/^[.,!?;:"'״׳—…()\[\]]+|[.,!?;:"'״׳—…()\[\]]+$/g, "") });
                    bj--;
                } else {
                    merged.unshift({ word: segWords[ai - 1] });
                    ai--;
                }
            }

            var prevEnd = Math.max(seg.start, 0);
            for (var m = 0; m < merged.length; m++) {
                if (merged[m].word) {
                    out.push(merged[m].word);
                    prevEnd = Math.max(prevEnd, merged[m].word.end);
                    continue;
                }
                // A run of missing tokens: spread them across the gap up to the next timed word
                var run = [];
                while (m < merged.length && !merged[m].word) {
                    if (merged[m].token) run.push(merged[m].token);
                    m++;
                }
                m--;
                var nextStart = (m + 1 < merged.length) ? merged[m + 1].word.start : Math.max(seg.end, prevEnd);
                var step = Math.max(0.01, (nextStart - prevEnd) / Math.max(1, run.length));
                for (var r = 0; r < run.length; r++) {
                    var rs = Math.min(prevEnd + r * step, nextStart - 0.001 * (run.length - r));
                    out.push({ word: run[r], start: rs, end: rs + step });
                }
                prevEnd = Math.max(prevEnd, nextStart);
            }
        }

        while (wi < words.length) out.push(words[wi++]);
        return out;
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

        if (os.platform() !== "win32") {
            // macOS: bundled universal ffmpeg (bin-mac/ffmpeg) first, then Homebrew / system installs
            var macDirs = [];
            try {
                if (typeof csInterface !== "undefined" && csInterface && csInterface.getSystemPath) {
                    var macExt = csInterface.getSystemPath("extension") || "";
                    try { macExt = decodeURIComponent(macExt); } catch (e) {}
                    macExt = macExt.replace(/^file:\/\/\/?/i, "");
                    if (macExt && macExt.charAt(0) !== "/") macExt = "/" + macExt;
                    if (macExt) macDirs.push(macExt);
                }
            } catch (e) {}
            macDirs.push("/Library/Application Support/Adobe/CEP/extensions/com.autocut.panel");
            try { macDirs.push(path.join(os.homedir(), "Library", "Application Support", "Adobe", "CEP", "extensions", "com.autocut.panel")); } catch (e) {}
            var macCandidates = [];
            for (var mi = 0; mi < macDirs.length; mi++) macCandidates.push(path.join(macDirs[mi], "bin-mac", "ffmpeg"));
            macCandidates.push("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg");
            for (var mc = 0; mc < macCandidates.length; mc++) {
                try { if (fs.existsSync(macCandidates[mc])) return macCandidates[mc]; } catch (e) {}
            }
            return null;
        }

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
    extractAudio: function (mediaPath, onProgress, wavOnly) {
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

            // The local engine reads only 16 kHz WAV, so it always gets a fresh conversion
            if (!wavOnly && stats && (isDirectAudio || isDirectVideo) && stats.size < 24 * 1024 * 1024) {
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

                    if (wavOnly) {
                        return reject(new Error("חילוץ אודיו נכשל ב-Windows (ffmpeg). " + (stderr ? String(stderr).slice(-300) : (err && err.message) || "")));
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
                // 16kHz mono WAV via afconvert, then bundled ffmpeg for containers afconvert can't open
                var macWav = function () {
                    var tempWav = path.join(os.tmpdir(), "autocut_caption_" + Date.now() + ".wav");
                    var argsWav = ["-f", "WAVE", "-d", "LEI16@16000", "-c", "1", mediaPath, tempWav];
                    cp.execFile("/usr/bin/afconvert", argsWav, function (err2, out2, errStr2) {
                        if (!err2) return resolve({ path: tempWav, type: "audio/wav", filename: "audio.wav", isTemp: true });

                        // Fallback: bundled ffmpeg (or Homebrew / system) for containers afconvert can't open (mkv, avi, ts, mxf, some mov/mp4 codecs)
                        var ffmpegMac = self.getFfmpegPath();
                        var failMsg = "חילוץ אודיו נכשל ב-macOS (קובץ " + (ext || "ללא סיומת") + " לא נתמך): " + (errStr2 || err2.message);
                        if (!ffmpegMac) {
                            return reject(new Error(failMsg + ". ffmpeg המצורף לא נמצא - התקן מחדש את התוסף, או המר את הקליפ ל-MP4/MOV ונסה שוב."));
                        }
                        var tempWavFf = path.join(os.tmpdir(), "autocut_caption_" + Date.now() + "_ff.wav");
                        cp.execFile(ffmpegMac, ["-i", mediaPath, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", tempWavFf, "-y"], function (err3, out3, errStr3) {
                            if (!err3 && fs.existsSync(tempWavFf)) {
                                return resolve({ path: tempWavFf, type: "audio/wav", filename: "audio.wav", isTemp: true });
                            }
                            reject(new Error(failMsg + " | ffmpeg: " + (errStr3 || (err3 && err3.message) || "")));
                        });
                    });
                };

                if (wavOnly) return macWav();

                // macOS extraction via afconvert (built-in): compact AAC for the Groq upload limit
                var tempAudio = path.join(os.tmpdir(), "autocut_caption_" + Date.now() + ".m4a");
                var argsMac = ["-f", "m4af", "-d", "aac", "-c", "1", "-b", "64000", mediaPath, tempAudio];

                cp.execFile("/usr/bin/afconvert", argsMac, function (err, stdout, stderr) {
                    if (err) return macWav();
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

            var hebrewPrompt = self.buildPrompt();
            formData.append("prompt", hebrewPrompt);

            var cleanup = function () {
                if (audioInfo && audioInfo.isTemp !== false) {
                    try { fs.unlinkSync(audioPath); } catch (e) {}
                }
            };

            var httpError = function (status, errData) {
                var msg = (errData && errData.error && errData.error.message) ? errData.error.message : ("HTTP " + status);
                if (status === 401) {
                    msg = "מפתח Groq API שגוי או לא בתוקף. אנא בדוק את המפתח שהזנת.";
                }
                return new Error(msg);
            };

            // Fallback: Node https with a hand-built multipart body. Used when Chromium's fetch
            // fails at the network level ("Failed to fetch") - seen on some Macs (proxy/VPN/security software).
            var nodeTranscribe = function (fetchErr) {
                var nodeHttps;
                try { nodeHttps = nodeReq("https"); } catch (e) { nodeHttps = null; }
                if (!nodeHttps) { cleanup(); return reject(fetchErr); }

                var boundary = "----cstrim" + Date.now().toString(16) + Math.random().toString(16).slice(2);
                var parts = [];
                var addField = function (name, value) {
                    parts.push(Buffer.from("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name + "\"\r\n\r\n" + value + "\r\n", "utf8"));
                };
                parts.push(Buffer.from("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + fileName + "\"\r\nContent-Type: " + mimeType + "\r\n\r\n", "utf8"));
                parts.push(fileBuffer);
                parts.push(Buffer.from("\r\n", "utf8"));
                addField("model", "whisper-large-v3");
                addField("response_format", "verbose_json");
                addField("temperature", "0.0");
                addField("timestamp_granularities[]", "word");
                addField("timestamp_granularities[]", "segment");
                if (language && language !== "auto") addField("language", language);
                addField("prompt", hebrewPrompt);
                parts.push(Buffer.from("--" + boundary + "--\r\n", "utf8"));
                var body = Buffer.concat(parts);

                var req = nodeHttps.request({
                    method: "POST",
                    hostname: "api.groq.com",
                    path: "/openai/v1/audio/transcriptions",
                    headers: {
                        "Authorization": "Bearer " + apiKey.trim(),
                        "Content-Type": "multipart/form-data; boundary=" + boundary,
                        "Content-Length": body.length
                    }
                }, function (res) {
                    var chunks = [];
                    res.on("data", function (c) { chunks.push(c); });
                    res.on("end", function () {
                        var text = Buffer.concat(chunks).toString("utf8");
                        var json = null;
                        try { json = JSON.parse(text); } catch (e) {}
                        if (res.statusCode >= 200 && res.statusCode < 300 && json) {
                            cleanup();
                            resolve(json);
                        } else {
                            cleanup();
                            reject(httpError(res.statusCode, json));
                        }
                    });
                });
                req.on("error", function (e) {
                    cleanup();
                    reject(new Error("אין חיבור ל-Groq (" + (e && e.message ? e.message : "שגיאת רשת") + "). בדוק אינטרנט, VPN או חומת אש."));
                });
                req.setTimeout(300000, function () {
                    req.abort();
                });
                req.write(body);
                req.end();
            };

            fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + apiKey.trim()
                },
                body: formData
            })
            .then(function (res) {
                if (!res.ok) {
                    return res.json().catch(function () { return null; }).then(function (errData) {
                        var e = httpError(res.status, errData);
                        e.isHttp = true;
                        throw e;
                    });
                }
                return res.json();
            })
            .then(function (data) {
                cleanup();
                resolve(data);
            })
            .catch(function (err) {
                if (err && err.isHttp) {
                    cleanup();
                    return reject(err);
                }
                nodeTranscribe(err);
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
                if (!whisperData._reconciledWords) whisperData._reconciledWords = self.reconcileWords(whisperData);
                var timedWords = whisperData._reconciledWords;
                for (var w = 0; w < timedWords.length; w++) {
                    var wordObj = timedWords[w];
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
     * Render transparent PNG overlay frames: one per spoken word with a colored marker highlight box,
     * or (highlightWords off) one plain frame per caption line. Placed on a managed video track so edits replace them.
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
                var highlightOn = Boolean(options.highlightWords);

                var outDir = path.join(os.tmpdir(), "autocut_hl_" + Date.now());
                if (!fs.existsSync(outDir)) {
                    fs.mkdirSync(outDir, { recursive: true });
                }

                // A @font-face font renders as the fallback until it is requested, so load the chosen face first
                var reqWeight = parseInt(options.markerFontWeight, 10) || 900;
                var reqFamily = String(options.markerFontFamily || "Heebo").replace(/['"\\]/g, "");
                var fontReadyPromise = (typeof document !== "undefined" && document.fonts && document.fonts.load)
                    ? Promise.all([
                        document.fonts.load(reqWeight + " 40px '" + reqFamily + "'", "אבג").catch(function () {}),
                        document.fonts.ready
                    ])
                    : Promise.resolve();

                fontReadyPromise.then(function () {
                    var canvas = document.createElement("canvas");
                    canvas.width = seqWidth;
                    canvas.height = seqHeight;
                    var ctx = canvas.getContext("2d");

                    var minDim = Math.min(seqWidth, seqHeight);
                    var fontScale = Number(options.markerFontScale);
                    if (!(fontScale >= 0.5 && fontScale <= 2)) fontScale = 1;
                    var fontSize = Math.round(minDim * 0.068 * fontScale);
                    var fontWeight = parseInt(options.markerFontWeight, 10) || 900;
                    var fontFamily = String(options.markerFontFamily || "Heebo").replace(/['"\\]/g, "");
                    var fontCss = fontWeight + " " + fontSize + "px '" + fontFamily + "', 'Heebo', 'Arial', sans-serif";
                    var posXFrac = Number(options.markerPosX);
                    if (!(posXFrac >= 0.05 && posXFrac <= 0.95)) posXFrac = 0.5;
                    var posYFrac = Number(options.markerPosY);
                    if (!(posYFrac >= 0.03 && posYFrac <= 0.97)) posYFrac = 0.78;
                    var lineHeight = Math.round(fontSize * 1.38);
                    var spaceW = Math.round(fontSize * 0.32);
                    var maxLineWidth = Math.round(seqWidth * 0.84);
                    var baseCenterY = Math.round(seqHeight * posYFrac);

                    var padX = Math.round(fontSize * 0.21);
                    var padY = Math.round(fontSize * 0.13);
                    var cornerRadius = Math.round(fontSize * 0.22);
                    var strokeW = Math.max(4, Math.round(fontSize * 0.16));

                    var items = [];
                    var frameCounter = 0;

                    for (var cIdx = 0; cIdx < cues.length; cIdx++) {
                        var cue = cues[cIdx];
                        var wordsArr = cue.words || [];
                        if (wordsArr.length === 0 && !highlightOn) {
                            wordsArr = String(cue.text || "").split(/\s+/).filter(Boolean).map(function (wt) {
                                return { word: wt, start: cue.start, end: cue.end };
                            });
                        }
                        if (wordsArr.length === 0) continue;

                        ctx.font = fontCss;
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
                        // Keep the whole block inside the frame wherever the user parked it
                        var halfBlockH = Math.round(totalBlockHeight / 2) + Math.round(lineHeight / 2);
                        var blockCenterY = Math.max(halfBlockH, Math.min(seqHeight - halfBlockH, baseCenterY));
                        var startLineY = blockCenterY - Math.round(totalBlockHeight / 2);

                        for (var lIdx = 0; lIdx < lines.length; lIdx++) {
                            var lineObj = lines[lIdx];
                            var lineY = startLineY + lIdx * lineHeight;
                            var halfLineW = lineObj.totalWidth / 2 + padX;
                            var lineCenterX = Math.max(halfLineW, Math.min(seqWidth - halfLineW, seqWidth * posXFrac));
                            var cursorRightX = Math.round(lineCenterX + lineObj.totalWidth / 2);

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

                        // Render one PNG state per active word in this cue (or a single plain frame for the whole line)
                        var stateCount = highlightOn ? wordsArr.length : 1;
                        for (var activeIdx = 0; activeIdx < stateCount; activeIdx++) {
                            var wTiming = highlightOn ? wordsArr[activeIdx] : { start: cue.start, end: cue.end, word: cue.text };
                            var activeLayout = wordLayouts[activeIdx];
                            if (!activeLayout) continue;

                            ctx.clearRect(0, 0, seqWidth, seqHeight);
                            ctx.font = fontCss;
                            ctx.direction = "rtl";
                            ctx.textBaseline = "middle";
                            ctx.textAlign = "center";

                            // 1. Draw the colored Marker Highlight box behind the active word
                            if (highlightOn) {
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
                            }

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
                            onProgress(renderPct, (highlightOn ? "מייצר מרקר על המילים (" : "מייצר שכבת כתוביות (") + (cIdx + 1) + "/" + cues.length + ")...");
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
     * Marker mode: render PNG frames for the managed video track the host replaces on every edit.
     * Plain captions need no layer here: they are placed as a native caption track from the SRT.
     * Resolves { highlightWords, highlightManifestPath?, highlightClipsCount? }
     */
    buildCaptionLayer: function (cues, options, srtPath, onProgress) {
        var self = this;
        options = options || {};
        var hlOn = Boolean(options.highlightWords);

        var renderFrames = function () {
            return self.renderHighlightFrames(cues, options, onProgress).then(function (hlData) {
                var nodeReq = self.getNodeRequire();
                var fs = nodeReq("fs");
                var path = nodeReq("path");
                var manifestPath = path.join(hlData.outDir, "manifest.json");
                fs.writeFileSync(manifestPath, JSON.stringify({
                    srtPath: srtPath,
                    highlightColor: options.highlightColor || "#FACC15",
                    items: hlData.items
                }), "utf8");
                return {
                    highlightWords: hlOn,
                    highlightManifestPath: manifestPath,
                    highlightClipsCount: hlData.items.length
                };
            });
        };

        if (!hlOn) return Promise.resolve({ highlightWords: false });
        return renderFrames();
    },

    /**
     * Generate captions for the ENTIRE active sequence across all its clips
     */
    generateCaptionsForSequence: function (timelineClips, apiKey, language, options, onProgress) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var useLocal = Boolean(options && options.engine === "local") && typeof LocalTranscriber !== "undefined" && LocalTranscriber.isSupported();
            var engineNote = null;
            if (!useLocal && (!apiKey || !apiKey.trim())) {
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
                // Skip graphics/templates/stills: they hold no speech and ffmpeg can't open them
                if (p && /\.(aegraphic|mogrt|prproj|png|jpe?g|gif|bmp|tiff?|svg|psd|ai|webp|heic)$/i.test(p)) continue;
                if (p && uniquePaths.indexOf(p) === -1) {
                    uniquePaths.push(p);
                }
            }

            if (uniquePaths.length === 0) {
                return reject(new Error("לא נמצאו קליפי וידאו או אודיו עם דיבור בסיקוונס."));
            }

            var whisperResultsByPath = {};
            var currentPathIdx = 0;
            var lastExtractError = null;

            var processNextPath = function () {
                if (currentPathIdx >= uniquePaths.length) {
                    if (Object.keys(whisperResultsByPath).length === 0 && lastExtractError) {
                        return reject(lastExtractError);
                    }
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

                        var hlOn = Boolean(options && options.highlightWords);
                        onProgress(86, hlOn ? "מייצר שכבות מרקר (הייליט) לכל מילה..." : "מייצר שכבת כתוביות...");
                        self.buildCaptionLayer(cues, options, srtPath, onProgress).then(function (layer) {
                            onProgress(100, (hlOn ? "כתוביות המרקר " : "הכתוביות ") + targetLabel + " מוכנות!");
                            layer.engine = useLocal ? "local" : "groq";
                            layer.engineNote = engineNote;
                            layer.srtPath = srtPath;
                            layer.blocksCount = cues.length;
                            layer.cues = cues;
                            resolve(layer);
                        }).catch(reject);
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
                }, useLocal).then(function (audioInfo) {
                    if (useLocal) {
                        onProgress(pctBase + 35, "מתמלל במחשב (" + (currentPathIdx + 1) + "/" + uniquePaths.length + ")...");
                        return LocalTranscriber.transcribe(audioInfo, function (p, msg) {
                            onProgress(Math.min(84, pctBase + 35 + Math.round(p * 0.45)), msg);
                        }).catch(function (localErr) {
                            // The engine can't run on this machine: with a Groq key, finish the job there instead
                            if (!apiKey || !apiKey.trim()) throw localErr;
                            useLocal = false;
                            engineNote = "התמלול המקומי נכשל (" + localErr.message + "), לכן התמלול נעשה ב-Groq.";
                            return self.extractAudio(mediaPath, function () {}).then(function (groqAudio) {
                                return self.transcribe(groqAudio, apiKey, language, function (p, msg) {
                                    onProgress(pctBase + 35 + Math.round(p * 0.4), msg);
                                });
                            });
                        });
                    }
                    onProgress(pctBase + 35, "מתמלל ב-Groq AI (" + (currentPathIdx + 1) + "/" + uniquePaths.length + ")...");
                    return self.transcribe(audioInfo, apiKey, language, function (p, msg) {
                        onProgress(pctBase + 35 + Math.round(p * 0.4), msg);
                    });
                }, function (extractErr) {
                    // A file we can't read audio from (e.g. a graphic) shouldn't abort the whole sequence
                    lastExtractError = extractErr;
                    return null;
                }).then(function (whisperResult) {
                    if (whisperResult) whisperResultsByPath[mediaPath] = whisperResult;
                    currentPathIdx++;
                    processNextPath();
                }).catch(reject);
            };

            // The local engine and model download once; if that fails, a Groq key (when there is one) takes over
            var prepareEngine = function () {
                if (!useLocal) return Promise.resolve();
                return LocalTranscriber.ensureInstalled(onProgress).catch(function (err) {
                    if (!apiKey || !apiKey.trim()) throw err;
                    useLocal = false;
                    engineNote = "התמלול המקומי לא זמין (" + err.message + "), לכן התמלול נעשה ב-Groq.";
                });
            };

            // Ensure fresh remote corrections are loaded from cloud before transcription starts
            self.fetchRemoteCorrections().catch(function () {}).then(prepareEngine).then(function () {
                processNextPath();
            }).catch(reject);
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

                options = options || {};
                var hlOn = Boolean(options.highlightWords);
                if (onProgress) onProgress(30, hlOn ? "מייצר מחדש שכבות מרקר עם הטקסט המתוקן..." : "מייצר מחדש את שכבת הכתוביות עם הטקסט המתוקן...");
                self.buildCaptionLayer(cues, options, srtPath, function (p, msg) {
                    if (onProgress) onProgress(p, msg);
                }).then(function (layer) {
                    layer.srtPath = srtPath;
                    layer.blocksCount = cues.length;
                    layer.cues = cues;
                    resolve(layer);
                }).catch(reject);
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
