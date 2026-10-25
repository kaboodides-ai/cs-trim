/**
 * CS Trim - Local Hebrew transcription (Hebrew speech model on whisper.cpp)
 * Free, no API key, works offline. The engine (~4 MB) and the model (~1.6 GB) download once on first use
 * into a folder outside the extension, so plugin updates never touch them.
 */

var LocalTranscriber = {
    ENGINE_VERSION: "1.9.5",

    ENGINES: {
        darwin: {
            file: "whisper-mac-1.9.5.zip",
            sha256: "5f949227eae76d2c3a731f02e8607fe01add28f736a0407f5d6d63567c04b920",
            bin: "whisper-cli"
        },
        win32: {
            file: "whisper-win-x64-1.9.5.zip",
            sha256: "e142adc14cc7a7607bbbb469ae4641f9ca6f7036f97b57d9aa4396daecb4dd29",
            bin: "whisper-cli.exe"
        }
    },

    ENGINE_BASE_URLS: [
        "https://raw.githubusercontent.com/kaboodides-ai/cs-trim/main/website/download/engine/",
        "https://cstrim.site/download/engine/"
    ],

    // Hebrew turbo model (ggml), pinned to a commit so the hash below always matches
    MODEL: {
        file: "hebrew-model.bin",
        legacyFile: "ivr" + "it-turbo.bin",
        url: "https://github.com/kaboodides-ai/cs-trim/releases/download/model-1/cstrim-hebrew.bin",
        size: 1624555275,
        sha256: "c8090411113357097bfafc2b8e228ec1639fa7f5fe4ecb5d054ac0ccef8641b1"
    },

    node: function (name) {
        return CaptionGenerator.getNodeRequire()(name);
    },

    getBaseDir: function () {
        var os = this.node("os");
        var path = this.node("path");
        if (os.platform() === "win32") {
            var local = (process.env && process.env.LOCALAPPDATA) || path.join(os.homedir(), "AppData", "Local");
            return path.join(local, "CS Trim", "local-whisper");
        }
        return path.join(os.homedir(), "Library", "Application Support", "CS Trim", "local-whisper");
    },

    getEngineInfo: function () {
        return this.ENGINES[this.node("os").platform()] || null;
    },

    isSupported: function () {
        try {
            return Boolean(CaptionGenerator.getNodeRequire() && this.getEngineInfo());
        } catch (e) {
            return false;
        }
    },

    // A marker file is written only after a download passed its hash check
    isEngineReady: function () {
        var fs = this.node("fs");
        var path = this.node("path");
        var dir = this.getBaseDir();
        var info = this.getEngineInfo();
        return Boolean(info) && fs.existsSync(path.join(dir, "engine", info.bin)) &&
            fs.existsSync(path.join(dir, "engine", "ok-" + this.ENGINE_VERSION));
    },

    isModelReady: function () {
        var fs = this.node("fs");
        var path = this.node("path");
        var dir = this.getBaseDir();
        // Installs from before the rename: move the file over instead of downloading 1.6 GB again
        var legacy = path.join(dir, this.MODEL.legacyFile);
        if (!fs.existsSync(path.join(dir, this.MODEL.file)) && fs.existsSync(legacy) && fs.existsSync(legacy + ".ok")) {
            try {
                fs.renameSync(legacy, path.join(dir, this.MODEL.file));
                fs.renameSync(legacy + ".ok", path.join(dir, this.MODEL.file + ".ok"));
            } catch (e) {}
        }
        return fs.existsSync(path.join(dir, this.MODEL.file)) && fs.existsSync(path.join(dir, this.MODEL.file + ".ok"));
    },

    isReady: function () {
        try {
            return this.isEngineReady() && this.isModelReady();
        } catch (e) {
            return false;
        }
    },

    // Older CEP builds ship a Node without mkdirSync's recursive option
    mkdirp: function (dir) {
        var fs = this.node("fs");
        var path = this.node("path");
        if (fs.existsSync(dir)) return;
        this.mkdirp(path.dirname(dir));
        fs.mkdirSync(dir);
    },

    /**
     * Stream a URL to destPath with Node https: follows redirects (Hugging Face hands off to a CDN),
     * resumes a partial .part file with a Range request, and checks the SHA-256 of the whole file.
     */
    download: function (url, destPath, expected, onBytes) {
        var self = this;
        var fs = this.node("fs");
        var https = this.node("https");
        var crypto = this.node("crypto");
        var partPath = destPath + ".part";

        return new Promise(function (resolve, reject) {
            var hash = crypto.createHash("sha256");
            var have = 0;

            var hashExisting = function (done) {
                if (!fs.existsSync(partPath)) return done();
                have = fs.statSync(partPath).size;
                if (expected.size && have >= expected.size) {
                    try { fs.unlinkSync(partPath); } catch (e) {}
                    have = 0;
                    return done();
                }
                var rs = fs.createReadStream(partPath);
                rs.on("data", function (c) { hash.update(c); });
                rs.on("error", function () {
                    try { fs.unlinkSync(partPath); } catch (e) {}
                    hash = crypto.createHash("sha256");
                    have = 0;
                    done();
                });
                rs.on("end", done);
            };

            var activeReq = null;
            var request = function (currentUrl, redirectsLeft) {
                var headers = { "User-Agent": "cs-trim-cep" };
                if (have > 0) headers["Range"] = "bytes=" + have + "-";
                var req = activeReq = https.get(currentUrl, { headers: headers }, function (res) {
                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        res.resume();
                        if (redirectsLeft <= 0) return reject(new Error("יותר מדי הפניות בהורדה"));
                        var next = res.headers.location;
                        if (next.charAt(0) === "/") {
                            var u = new URL(currentUrl);
                            next = u.protocol + "//" + u.host + next;
                        }
                        return request(next, redirectsLeft - 1);
                    }
                    // Server ignored the Range header: start over
                    if (res.statusCode === 200 && have > 0) {
                        hash = crypto.createHash("sha256");
                        have = 0;
                    } else if (res.statusCode !== 200 && res.statusCode !== 206) {
                        res.resume();
                        return reject(new Error("HTTP " + res.statusCode));
                    }

                    var total = expected.size || (have + (parseInt(res.headers["content-length"], 10) || 0));
                    var out = fs.createWriteStream(partPath, { flags: have > 0 ? "a" : "w" });
                    res.on("data", function (chunk) {
                        hash.update(chunk);
                        have += chunk.length;
                        if (onBytes) onBytes(have, total);
                    });
                    res.on("error", function (e) { out.destroy(); reject(e); });
                    out.on("error", function (e) {
                        res.destroy();
                        reject(e && e.code === "ENOSPC" ? new Error("אין מספיק מקום פנוי בדיסק להורדה") : e);
                    });
                    res.pipe(out);
                    out.on("finish", function () {
                        var digest = hash.digest("hex");
                        if (expected.sha256 && digest !== expected.sha256) {
                            try { fs.unlinkSync(partPath); } catch (e) {}
                            return reject(new Error("הקובץ שירד לא עבר בדיקת תקינות"));
                        }
                        try {
                            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
                            fs.renameSync(partPath, destPath);
                        } catch (e) {
                            return reject(e);
                        }
                        resolve(destPath);
                    });
                });
                req.on("error", function (e) {
                    if (req === activeReq) reject(e);
                });
                // Inactivity timeout; a request we already moved past (a redirect) must not fail the download
                req.setTimeout(60000, function () {
                    req.abort();
                    if (req !== activeReq) return;
                    reject(new Error("ההורדה נתקעה (אין תגובה מהשרת)"));
                });
            };

            hashExisting(function () { request(url, 8); });
        });
    },

    extractZip: function (zipPath, destDir) {
        var cp = this.node("child_process");
        var fs = this.node("fs");
        var path = this.node("path");
        var os = this.node("os");
        return new Promise(function (resolve, reject) {
            if (os.platform() !== "win32") {
                cp.execFile("/usr/bin/unzip", ["-o", zipPath, "-d", destDir], function (err, so, se) {
                    if (err) return reject(new Error(se || err.message));
                    resolve();
                });
                return;
            }
            var psFallback = function () {
                var ps = "Expand-Archive -LiteralPath '" + zipPath.replace(/'/g, "''") + "' -DestinationPath '" + destDir.replace(/'/g, "''") + "' -Force";
                cp.execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps], { windowsHide: true }, function (err, so, se) {
                    if (err) return reject(new Error(se || err.message));
                    resolve();
                });
            };
            var winTar = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
            if (!fs.existsSync(winTar)) return psFallback();
            cp.execFile(winTar, ["-xf", zipPath, "-C", destDir], { windowsHide: true }, function (err) {
                if (err) return psFallback();
                resolve();
            });
        });
    },

    ensureEngine: function (onProgress) {
        var self = this;
        if (this.isEngineReady()) return Promise.resolve();
        var fs = this.node("fs");
        var path = this.node("path");
        var info = this.getEngineInfo();
        if (!info) return Promise.reject(new Error("תמלול מקומי לא נתמך במערכת הזו"));

        var engineDir = path.join(this.getBaseDir(), "engine");
        this.mkdirp(engineDir);
        var zipPath = path.join(this.getBaseDir(), info.file);

        var tryUrl = function (idx) {
            if (idx >= self.ENGINE_BASE_URLS.length) return Promise.reject(new Error("הורדת מנוע התמלול נכשלה. בדוק חיבור לאינטרנט."));
            return self.download(self.ENGINE_BASE_URLS[idx] + info.file, zipPath, { sha256: info.sha256 }, function (got) {
                if (onProgress) onProgress(3, "מוריד מנוע תמלול (" + Math.round(got / 1048576) + "MB)...");
            }).catch(function () {
                return tryUrl(idx + 1);
            });
        };

        return tryUrl(0).then(function () {
            if (onProgress) onProgress(4, "מתקין מנוע תמלול...");
            return self.extractZip(zipPath, engineDir);
        }).then(function () {
            try { fs.unlinkSync(zipPath); } catch (e) {}
            var binPath = path.join(engineDir, info.bin);
            if (!fs.existsSync(binPath)) throw new Error("מנוע התמלול לא נמצא אחרי ההתקנה");
            try { fs.chmodSync(binPath, 493); } catch (e) {}
            fs.writeFileSync(path.join(engineDir, "ok-" + self.ENGINE_VERSION), "");
        });
    },

    ensureModel: function (onProgress) {
        var self = this;
        if (this.isModelReady()) return Promise.resolve();
        var fs = this.node("fs");
        var path = this.node("path");
        var dir = this.getBaseDir();
        this.mkdirp(dir);
        var modelPath = path.join(dir, this.MODEL.file);
        var lastPct = -1;

        return this.download(this.MODEL.url, modelPath, this.MODEL, function (got, total) {
            var pct = total ? Math.floor((got / total) * 100) : 0;
            if (pct === lastPct || !onProgress) return;
            lastPct = pct;
            onProgress(5 + Math.round(pct * 0.3), "מוריד מודל עברית חד־פעמי: " + Math.round(got / 1048576) + " מתוך " + Math.round(total / 1048576) + "MB (" + pct + "%)");
        }).then(function () {
            fs.writeFileSync(modelPath + ".ok", "");
        });
    },

    // One install at a time: a background pre-download and a transcription started meanwhile share it
    ensureInstalled: function (onProgress) {
        var self = this;
        if (this.isReady()) return Promise.resolve();
        if (!this._listeners) this._listeners = [];
        if (onProgress) this._listeners.push(onProgress);
        if (!this._pending) {
            var notify = function (pct, msg) {
                for (var i = 0; i < self._listeners.length; i++) self._listeners[i](pct, msg);
            };
            this._pending = this.ensureEngine(notify).then(function () {
                return self.ensureModel(notify);
            }).then(function () {
                self._pending = null;
                self._listeners = [];
            }, function (err) {
                self._pending = null;
                self._listeners = [];
                throw err;
            });
        }
        return this._pending;
    },

    // Measured against speech onsets in real voice-overs: DTW times land ~0.1s after the word is heard,
    // the decoder's own timestamps ~0.09s after (and much worse at segment starts)
    DTW_LEAD: 0.1,
    OFFSET_LEAD: 0.08,

    /**
     * Loudness of a 16-bit PCM WAV in 10 ms frames (dB), with the level that separates speech from silence.
     */
    loudnessEnvelope: function (buf) {
        var pos = 12, dataStart = -1, dataLen = 0, rate = 16000, channels = 1;
        while (pos + 8 <= buf.length) {
            var id = buf.toString("ascii", pos, pos + 4);
            var len = buf.readUInt32LE(pos + 4);
            if (id === "fmt ") {
                channels = buf.readUInt16LE(pos + 10) || 1;
                rate = buf.readUInt32LE(pos + 12) || 16000;
            } else if (id === "data") {
                dataStart = pos + 8;
                dataLen = Math.min(len, buf.length - dataStart);
                break;
            }
            pos += 8 + len + (len % 2);
        }
        if (dataStart < 0) return null;

        var hop = Math.round(rate / 100) * channels;
        var count = Math.floor(dataLen / 2);
        var db = [];
        for (var i = 0; i + hop <= count; i += hop) {
            var sum = 0;
            for (var k = 0; k < hop; k++) {
                var v = buf.readInt16LE(dataStart + (i + k) * 2);
                sum += v * v;
            }
            db.push(10 * Math.log10(sum / hop + 1e-9));
        }
        if (db.length < 10) return null;
        var sorted = db.slice().sort(function (a, b) { return a - b; });
        var floor = sorted[Math.floor(sorted.length * 0.1)];
        var loud = sorted[Math.floor(sorted.length * 0.9)];
        return { db: db, threshold: floor + 0.4 * (loud - floor) };
    },

    /**
     * Build timed words from whisper.cpp's full JSON: a word starts at its first token's DTW time
     * and runs until the next word, or, before a pause, until the voice actually stops.
     */
    wordsFromTokens: function (segments, envelope) {
        var self = this;
        var words = [];
        for (var s = 0; s < segments.length; s++) {
            var seg = segments[s];
            var segEnd = ((seg.offsets && seg.offsets.to) || 0) / 1000;
            var segWords = [];
            var cur = null;
            var tokens = seg.tokens || [];
            for (var t = 0; t < tokens.length; t++) {
                var tk = tokens[t];
                var text = String(tk.text || "");
                if (/^\[_.*\]$/.test(text.trim())) continue;
                var hasDtw = typeof tk.t_dtw === "number" && tk.t_dtw >= 0;
                var time = hasDtw
                    ? tk.t_dtw / 100 - self.DTW_LEAD
                    : (((tk.offsets && tk.offsets.from) || 0) / 1000) - self.OFFSET_LEAD;
                if (!cur || /^\s/.test(text)) {
                    if (cur) segWords.push(cur);
                    cur = { word: "", start: Math.max(0, time), end: 0 };
                }
                cur.word += text;
            }
            if (cur) segWords.push(cur);

            for (var w = 0; w < segWords.length; w++) {
                var word = segWords[w];
                word.word = word.word.trim();
                if (w + 1 < segWords.length) {
                    word.end = Math.max(word.start + 0.05, segWords[w + 1].start);
                } else {
                    word.end = self.voiceEnd(envelope, word.start, Math.max(segEnd, word.start + 0.3));
                }
                if (word.word && !/^\[.*\]$/.test(word.word)) words.push(word);
            }
        }
        // Keep words in order even where DTW times jitter across a segment boundary
        for (var i = 1; i < words.length; i++) {
            if (words[i].start < words[i - 1].start) words[i].start = words[i - 1].start;
            if (words[i - 1].end > words[i].start && words[i - 1].end - words[i].start < 1) {
                words[i - 1].end = Math.max(words[i - 1].start + 0.05, words[i].start);
            }
        }
        return words;
    },

    /**
     * Where the voice stops after a word that ends a segment: the first 150 ms of silence, bounded by the segment end.
     */
    voiceEnd: function (envelope, start, limit) {
        if (!envelope) return limit;
        var db = envelope.db;
        var from = Math.floor((start + 0.15) * 100);
        var to = Math.min(db.length, Math.ceil(limit * 100));
        var quiet = 0;
        for (var f = from; f < to; f++) {
            if (db[f] < envelope.threshold) {
                quiet++;
                if (quiet >= 15) return Math.max(start + 0.15, (f - quiet + 1) / 100);
            } else {
                quiet = 0;
            }
        }
        return limit;
    },

    /**
     * Transcribe a 16 kHz WAV. Resolves in the Whisper verbose shape ({ words, segments })
     * that the caption builder expects.
     */
    transcribe: function (audioInfo, onProgress) {
        var self = this;
        var fs = this.node("fs");
        var path = this.node("path");
        var os = this.node("os");
        var cp = this.node("child_process");

        return new Promise(function (resolve, reject) {
            var dir = self.getBaseDir();
            var info = self.getEngineInfo();
            var binPath = path.join(dir, "engine", info.bin);

            // whisper.cpp reads argv as ANSI on Windows, so a Hebrew user name in a path would break it.
            // Running inside the base folder with short relative names avoids passing any full path.
            var jobName = "job_" + Date.now();
            var wavName = jobName + ".wav";
            try {
                fs.copyFileSync(audioInfo.path, path.join(dir, wavName));
            } catch (e) {
                return reject(new Error("העתקת קובץ האודיו לתמלול נכשלה: " + e.message));
            }
            if (audioInfo.isTemp !== false) {
                try { fs.unlinkSync(audioInfo.path); } catch (e) {}
            }

            var cpuCount = (os.cpus() || []).length || 4;
            var threads = Math.max(2, Math.min(8, cpuCount > 4 ? Math.round(cpuCount / 2) + 1 : cpuCount));
            var args = [
                "-m", self.MODEL.file,
                "-f", wavName,
                "-l", "he",
                // Greedy decoding: beam search dropped whole short phrases in tests
                "-bs", "1", "-bo", "1",
                // Word timing from the attention alignment (DTW): the decoder's own timestamps run late and bunch
                // several words onto one moment at the start of a segment. DTW needs flash attention off.
                "-nfa", "-dtw", "large.v3.turbo",
                "-t", String(threads),
                "-oj", "-ojf", "-of", jobName,
                "-np", "-pp"
            ];

            // Adobe apps ship the Visual C++ runtime next to their executables; let the engine find it there too
            var env = Object.assign({}, process.env);
            if (os.platform() === "win32") {
                var extra = [path.join(dir, "engine")];
                var d = path.dirname(process.execPath || "");
                for (var up = 0; up < 5 && d; up++) {
                    extra.push(d);
                    var parent = path.dirname(d);
                    if (parent === d) break;
                    d = parent;
                }
                env.PATH = extra.join(";") + ";" + (env.PATH || env.Path || "");
            }

            var cleanup = function () {
                try { fs.unlinkSync(path.join(dir, wavName)); } catch (e) {}
                try { fs.unlinkSync(path.join(dir, jobName + ".json")); } catch (e) {}
            };

            var errTail = "";
            var child;
            try {
                child = cp.spawn(binPath, args, { cwd: dir, env: env, windowsHide: true });
            } catch (e) {
                cleanup();
                return reject(new Error("הפעלת מנוע התמלול נכשלה: " + e.message));
            }

            child.stderr.on("data", function (chunk) {
                var text = chunk.toString("utf8");
                errTail = (errTail + text).slice(-2000);
                var m = text.match(/progress\s*=\s*(\d+)%/g);
                if (m && onProgress) {
                    var pct = parseInt(m[m.length - 1].replace(/\D+/g, ""), 10);
                    onProgress(pct, "מתמלל במחשב... " + pct + "%");
                }
            });
            child.stdout.on("data", function () {});

            child.on("error", function (e) {
                cleanup();
                reject(new Error("הפעלת מנוע התמלול נכשלה: " + e.message));
            });

            child.on("close", function (code) {
                if (code !== 0) {
                    cleanup();
                    // 0xC0000135: a DLL is missing, almost always the Visual C++ runtime
                    if (code === 3221225781 || code === -1073741515) {
                        return reject(new Error("חסר במחשב רכיב של Windows (Visual C++ Redistributable). התקן אותו מ-https://aka.ms/vs/17/release/vc_redist.x64.exe ונסה שוב."));
                    }
                    return reject(new Error("מנוע התמלול נכשל (קוד " + code + "): " + errTail.trim().split("\n").slice(-3).join(" ")));
                }
                var json, envelope = null;
                try {
                    json = JSON.parse(fs.readFileSync(path.join(dir, jobName + ".json"), "utf8"));
                } catch (e) {
                    cleanup();
                    return reject(new Error("לא ניתן לקרוא את תוצאת התמלול: " + e.message));
                }
                try {
                    envelope = self.loudnessEnvelope(fs.readFileSync(path.join(dir, wavName)));
                } catch (e) {}
                cleanup();

                resolve({ words: self.wordsFromTokens(json.transcription || [], envelope), segments: [] });
            });
        });
    }
};
