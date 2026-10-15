/**
 * CS Trim Audio Analyzer
 * Adaptive silence detection using macOS native afconvert + pure JavaScript.
 *
 * Instead of a fixed dB threshold, the threshold is derived from the file itself:
 * it sits between the measured background-noise level and the measured speech level,
 * so quiet speakers / noisy rooms are handled automatically.
 */

var SILENCE_PROFILES = {
    // minSilence: shortest pause (sec) that may be cut
    // pad:        safety margin (sec) kept before and after every speech part
    // frac:       where the threshold sits between noise floor (0) and speech level (1)
    normal:     { label: "Normal (רגיל)",         minSilence: 0.60, pad: 0.12, frac: 0.18 },
    high:       { label: "High (גבוה)",           minSilence: 0.40, pad: 0.08, frac: 0.22 },
    aggressive: { label: "Aggressive (אגרסיבי)",   minSilence: 0.25, pad: 0.05, frac: 0.26 }
};

var AudioAnalyzer = {
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

        // 1. From window.location (most reliable in CEP since index.html is loaded directly from the extension folder)
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

        // 3. Standard Windows CEP extension directories (User AppData, Home Dir, Common Files x86 & x64)
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

    percentile: function (sortedArr, p) {
        if (!sortedArr.length) return -60;
        var idx = Math.min(sortedArr.length - 1, Math.max(0, Math.floor(p * (sortedArr.length - 1))));
        return sortedArr[idx];
    },

    /**
     * Transcode any media file to WAV on Windows using native WinRT Windows.Media.Transcoding.MediaTranscoder
     * (100% built-in on Windows 10/11, works even if ffmpeg.exe is missing or blocked by Antivirus).
     */
    extractWavViaPowerShell: function (cp, fs, mediaPath, tempWav, callback) {
        var psIn = mediaPath.replace(/'/g, "''");
        var psOut = tempWav.replace(/'/g, "''");
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
            "$profile = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateWav([Windows.Media.MediaProperties.AudioEncodingQuality]::Medium)",
            "$transcoder = New-Object Windows.Media.Transcoding.MediaTranscoder",
            "$prep = Await ($transcoder.PrepareFileTranscodeAsync($sIn, $sOut, $profile)) ([Windows.Media.Transcoding.PrepareTranscodeResult])",
            "if ($prep.CanTranscode) { AwaitAction ($prep.TranscodeAsync()); exit 0 } else { exit 1 }"
        ].join("; ");

        cp.execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript], { windowsHide: true }, function (psErr, psOutStr, psErrStr) {
            if (!psErr && fs.existsSync(tempWav)) {
                return callback(null);
            }
            callback(psErr || new Error(psErrStr || "PowerShell MediaTranscoder failed"));
        });
    },

    /**
     * Decode audio via Chromium/CEF Web Audio API as a final in-memory fallback.
     */
    decodeViaWebAudio: function (fs, mediaPath) {
        return new Promise(function (resolve, reject) {
            try {
                var AudioCtx = (typeof window !== "undefined") && (window.AudioContext || window.webkitAudioContext);
                if (!AudioCtx) return reject(new Error("Web Audio API not available"));
                var fileBuf = fs.readFileSync(mediaPath);
                var arrayBuf = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength);
                var ctx = new AudioCtx();
                ctx.decodeAudioData(arrayBuf, function (audioBuffer) {
                    try { ctx.close(); } catch (e) {}
                    var sampleRate = audioBuffer.sampleRate || 16000;
                    var totalSamples = audioBuffer.length;
                    var totalDuration = audioBuffer.duration || (totalSamples / sampleRate);
                    var numCh = audioBuffer.numberOfChannels || 1;
                    var winSize = Math.round(sampleRate * 0.02);
                    var winDur = winSize / sampleRate;
                    var nWin = Math.floor(totalSamples / winSize);
                    if (nWin < 10) return reject(new Error("האודיו קצר או ריק מדי לניתוח."));

                    var chData = [];
                    for (var c = 0; c < numCh; c++) chData.push(audioBuffer.getChannelData(c));

                    var dbs = new Float32Array(nWin);
                    for (var w = 0; w < nWin; w++) {
                        var sumSq = 0;
                        var baseSample = w * winSize;
                        for (var s = 0; s < winSize; s++) {
                            var v = 0;
                            var idx = baseSample + s;
                            for (var ch = 0; ch < numCh; ch++) v += chData[ch][idx];
                            v /= numCh;
                            sumSq += v * v;
                        }
                        dbs[w] = 20 * Math.log10(Math.sqrt(sumSq / winSize) + 1e-7);
                    }
                    resolve({
                        dbs: dbs,
                        nWin: nWin,
                        winDur: winDur,
                        totalDuration: totalDuration
                    });
                }, function (decodeErr) {
                    try { ctx.close(); } catch (e) {}
                    reject(decodeErr || new Error("WebAudio decodeAudioData failed"));
                });
            } catch (err) {
                reject(err);
            }
        });
    },

    /**
     * Parse WAV buffer (supports 16-bit, 24-bit, 32-bit PCM & 32-bit float) into 20ms loudness windows
     */
    parseWavBuffer: function (buf) {
        var dataOffset = 44, dataSize = buf.length - 44;
        var sampleRate = 16000, channels = 1, bitsPerSample = 16, audioFormat = 1;
        var pos = 12;
        while (pos + 8 <= buf.length) {
            var id = buf.toString("ascii", pos, pos + 4);
            var size = buf.readUInt32LE(pos + 4);
            if (id === "fmt " && pos + 24 <= buf.length) {
                audioFormat = buf.readUInt16LE(pos + 8) || 1;
                channels = buf.readUInt16LE(pos + 10) || 1;
                sampleRate = buf.readUInt32LE(pos + 12) || 16000;
                bitsPerSample = buf.readUInt16LE(pos + 22) || 16;
            } else if (id === "data") {
                dataOffset = pos + 8;
                dataSize = Math.min(size, buf.length - dataOffset);
                break;
            }
            pos += 8 + size + (size % 2);
        }

        var bytesPerSample = Math.max(1, Math.floor(bitsPerSample / 8));
        var bytesPerFrame = bytesPerSample * channels;
        var availableBytes = Math.min(buf.length - dataOffset, dataSize > 0 ? dataSize : (buf.length - dataOffset));
        var totalSamples = Math.floor(availableBytes / bytesPerFrame);
        var totalDuration = totalSamples / sampleRate;

        var winSize = Math.round(sampleRate * 0.02);
        var winDur = winSize / sampleRate;
        var nWin = Math.floor(totalSamples / winSize);
        if (nWin < 10) {
            throw new Error("האודיו קצר או ריק מדי לניתוח.");
        }

        var dbs = new Float32Array(nWin);
        for (var w = 0; w < nWin; w++) {
            var sumSq = 0;
            var base = dataOffset + w * winSize * bytesPerFrame;
            for (var s = 0; s < winSize; s++) {
                var v = 0;
                var o = base + s * bytesPerFrame;
                for (var ch = 0; ch < channels; ch++) {
                    var chOffset = o + ch * bytesPerSample;
                    var sampleNorm = 0;
                    if (audioFormat === 3 && bitsPerSample === 32) {
                        sampleNorm = buf.readFloatLE(chOffset);
                    } else if (bitsPerSample === 16) {
                        sampleNorm = buf.readInt16LE(chOffset) / 32768;
                    } else if (bitsPerSample === 24) {
                        var b0 = buf[chOffset], b1 = buf[chOffset + 1], b2 = buf[chOffset + 2];
                        var i24 = (b2 << 16) | (b1 << 8) | b0;
                        if (i24 & 0x800000) i24 |= ~0xffffff;
                        sampleNorm = i24 / 8388608;
                    } else if (bitsPerSample === 32) {
                        sampleNorm = buf.readInt32LE(chOffset) / 2147483648;
                    } else if (bitsPerSample === 8) {
                        sampleNorm = (buf[chOffset] - 128) / 128;
                    }
                    v += sampleNorm;
                }
                v /= channels;
                sumSq += v * v;
            }
            dbs[w] = 20 * Math.log10(Math.sqrt(sumSq / winSize) + 1e-7);
        }

        return {
            dbs: dbs,
            nWin: nWin,
            winDur: winDur,
            totalDuration: totalDuration
        };
    },

    /**
     * Compute silence cuts and speech segments from 20ms loudness windows
     */
    computeSilenceResult: function (winInfo, mediaPath, profile, onProgress) {
        var self = this;
        var dbs = winInfo.dbs;
        var nWin = winInfo.nWin;
        var winDur = winInfo.winDur;
        var totalDuration = winInfo.totalDuration;

        // Smooth with 5-window max filter (100 ms) so stops/plosives inside words are never read as silence
        var smooth = new Float32Array(nWin);
        for (var i = 0; i < nWin; i++) {
            var mx = dbs[i];
            for (var delta = -2; delta <= 2; delta++) {
                var idx = Math.min(nWin - 1, Math.max(0, i + delta));
                if (dbs[idx] > mx) mx = dbs[idx];
            }
            smooth[i] = mx;
        }

        // --- Adaptive threshold ---
        var sorted = Array.prototype.slice.call(smooth).sort(function (x, y) { return x - y; });
        var noiseFloor = self.percentile(sorted, 0.10);
        var speechLevel = self.percentile(sorted, 0.90);
        if (speechLevel - noiseFloor < 12) {
            // Almost no dynamic range: be conservative, cut almost nothing
            noiseFloor = speechLevel - 12;
        }
        var threshold = noiseFloor + (speechLevel - noiseFloor) * profile.frac;
        threshold = Math.max(-60, Math.min(-28, threshold));

        onProgress(70, "מאתר שתיקות...");

        // --- Silence runs ---
        var minWin = Math.ceil(profile.minSilence / winDur);
        var silences = [];
        var runStart = -1;
        for (var k = 0; k <= nWin; k++) {
            var quiet = (k < nWin) && smooth[k] < threshold;
            if (quiet && runStart < 0) runStart = k;
            if (!quiet && runStart >= 0) {
                if (k - runStart >= minWin) {
                    silences.push({ start: runStart * winDur, end: k * winDur });
                }
                runStart = -1;
            }
        }

        // --- Cuts: shrink each silence by the padding so speech edges are kept ---
        var pad = profile.pad;
        var cuts = [];
        for (var n = 0; n < silences.length; n++) {
            var sl = silences[n];
            var atStart = sl.start <= winDur * 2;
            var atEnd = sl.end >= totalDuration - winDur * 2;
            var cs = atStart ? 0 : sl.start + pad;
            var ce = atEnd ? totalDuration : sl.end - pad;
            if (ce - cs >= 0.04) cuts.push({ start: cs, end: ce });
        }

        // --- Speech segments = everything that is not cut ---
        var speechSegments = [];
        var cur = 0;
        for (var m = 0; m < cuts.length; m++) {
            if (cuts[m].start > cur + 0.05) {
                speechSegments.push({ start: cur, end: cuts[m].start });
            }
            cur = cuts[m].end;
        }
        if (cur < totalDuration - 0.05) {
            speechSegments.push({ start: cur, end: totalDuration });
        }

        var round3 = function (x) { return Number(x.toFixed(3)); };
        cuts = cuts.map(function (x) {
            return { start: round3(x.start), end: round3(x.end), duration: round3(x.end - x.start) };
        });
        speechSegments = speechSegments.map(function (x) {
            return { start: round3(x.start), end: round3(x.end), duration: round3(x.end - x.start) };
        });

        var totalCut = cuts.reduce(function (sum, x) { return sum + x.duration; }, 0);
        var totalSpeech = speechSegments.reduce(function (sum, x) { return sum + x.duration; }, 0);

        onProgress(100, "הניתוח הושלם!");

        return {
            mediaPath: mediaPath,
            profile: profile.label,
            threshold: Number(threshold.toFixed(1)),
            totalDuration: Number(totalDuration.toFixed(2)),
            silenceCount: cuts.length,
            totalSilenceTime: Number(totalCut.toFixed(2)),
            totalSpeechTime: Number(totalSpeech.toFixed(2)),
            silences: cuts,
            speechSegments: speechSegments
        };
    },

    /**
     * @param {string} mediaPath
     * @param {string} profileKey - "normal" | "high" | "aggressive"
     * @param {function} onProgress - (percent, message)
     */
    analyzeFile: function (mediaPath, profileKey, onProgress) {
        var self = this;
        var profile = SILENCE_PROFILES[profileKey] || SILENCE_PROFILES.normal;

        return new Promise(function (resolve, reject) {
            try {
                var nodeReq = self.getNodeRequire();
                if (!nodeReq) {
                    return reject(new Error("Node.js runtime not accessible in CEP panel."));
                }

                var fs = nodeReq("fs");
                var cp = nodeReq("child_process");
                var os = nodeReq("os");
                var path = nodeReq("path");

                if (!fs.existsSync(mediaPath)) {
                    return reject(new Error("File not found on disk: " + mediaPath));
                }

                onProgress(15, "מחלץ אודיו...");

                var tempWav = path.join(os.tmpdir(), "autocut_temp_" + Date.now() + ".wav");
                var isWin = (os.platform() === "win32");
                var ext = path.extname(mediaPath).toLowerCase();

                var runExtraction = function (callback) {
                    if (isWin) {
                        // Fast path: if already a WAV file, read directly without spawning any process
                        if (ext === ".wav") {
                            try {
                                fs.copyFileSync(mediaPath, tempWav);
                                return callback(null, "", "");
                            } catch (copyErr) {}
                        }

                        var ffmpegBin = self.getFfmpegPath();
                        var argsWin = ["-i", mediaPath, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", tempWav, "-y"];
                        cp.execFile(ffmpegBin, argsWin, { windowsHide: true }, function (err, stdout, stderr) {
                            if (!err && fs.existsSync(tempWav)) {
                                return callback(null, stdout, stderr);
                            }
                            // Fallback 1: Native Windows 10/11 MediaTranscoder via PowerShell (zero external dependencies)
                            self.extractWavViaPowerShell(cp, fs, mediaPath, tempWav, function (psErr) {
                                if (!psErr && fs.existsSync(tempWav)) {
                                    return callback(null, "", "");
                                }
                                callback(err || psErr, stdout, stderr);
                            });
                        });
                    } else {
                        // -c 1 = mono, so interleaved stereo never doubles the timestamps
                        var argsMac = ["-f", "WAVE", "-d", "LEI16@16000", "-c", "1", mediaPath, tempWav];
                        cp.execFile("/usr/bin/afconvert", argsMac, callback);
                    }
                };

                runExtraction(function (err, stdout, stderr) {
                    if (err) {
                        // Final Fallback: decode directly in memory via Web Audio API
                        self.decodeViaWebAudio(fs, mediaPath)
                            .then(function (winInfo) {
                                onProgress(45, "מנתח את הקול...");
                                var result = self.computeSilenceResult(winInfo, mediaPath, profile, onProgress);
                                resolve(result);
                            })
                            .catch(function () {
                                reject(new Error("חילוץ אודיו נכשל: " + (stderr || err.message)));
                            });
                        return;
                    }

                    onProgress(45, "מנתח את הקול...");

                    try {
                        var buf = fs.readFileSync(tempWav);
                        try { fs.unlinkSync(tempWav); } catch (e) {}

                        var winInfo = self.parseWavBuffer(buf);
                        var result = self.computeSilenceResult(winInfo, mediaPath, profile, onProgress);
                        resolve(result);
                    } catch (parseErr) {
                        try { fs.unlinkSync(tempWav); } catch (e) {}
                        reject(parseErr);
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    }
};
