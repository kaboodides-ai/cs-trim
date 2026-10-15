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

    percentile: function (sortedArr, p) {
        if (!sortedArr.length) return -60;
        var idx = Math.min(sortedArr.length - 1, Math.max(0, Math.floor(p * (sortedArr.length - 1))));
        return sortedArr[idx];
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

                var runExtraction = function (callback) {
                    if (isWin) {
                        var extDir = "";
                        try {
                            if (typeof window !== "undefined" && window.csInterface) {
                                extDir = window.csInterface.getSystemPath("extension");
                            }
                        } catch (e) {}
                        var ffmpegBin = "ffmpeg";
                        var bundledFfmpeg = path.join(extDir || "", "bin", "win", "ffmpeg.exe");
                        if (fs.existsSync(bundledFfmpeg)) ffmpegBin = bundledFfmpeg;
                        var argsWin = ["-i", mediaPath, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", tempWav, "-y"];
                        cp.execFile(ffmpegBin, argsWin, callback);
                    } else {
                        // -c 1 = mono, so interleaved stereo never doubles the timestamps
                        var argsMac = ["-f", "WAVE", "-d", "LEI16@16000", "-c", "1", mediaPath, tempWav];
                        cp.execFile("/usr/bin/afconvert", argsMac, callback);
                    }
                };

                runExtraction(function (err, stdout, stderr) {
                    if (err) {
                        return reject(new Error("חילוץ אודיו נכשל: " + (stderr || err.message)));
                    }

                    onProgress(45, "מנתח את הקול...");

                    try {
                        var buf = fs.readFileSync(tempWav);
                        try { fs.unlinkSync(tempWav); } catch (e) {}

                        // --- Parse WAV header ---
                        var dataOffset = 44, sampleRate = 16000, channels = 1, pos = 12;
                        while (pos + 8 <= buf.length) {
                            var id = buf.toString("ascii", pos, pos + 4);
                            var size = buf.readUInt32LE(pos + 4);
                            if (id === "fmt ") {
                                channels = buf.readUInt16LE(pos + 10) || 1;
                                sampleRate = buf.readUInt32LE(pos + 12) || 16000;
                            } else if (id === "data") {
                                dataOffset = pos + 8;
                                break;
                            }
                            pos += 8 + size + (size % 2);
                        }

                        var bytesPerFrame = 2 * channels;
                        var totalSamples = Math.floor((buf.length - dataOffset) / bytesPerFrame);
                        var totalDuration = totalSamples / sampleRate;

                        // --- Loudness per 20 ms window ---
                        var winSize = Math.round(sampleRate * 0.02);
                        var winDur = winSize / sampleRate;
                        var nWin = Math.floor(totalSamples / winSize);
                        if (nWin < 10) {
                            return reject(new Error("האודיו קצר או ריק מדי לניתוח."));
                        }

                        var dbs = new Float32Array(nWin);
                        for (var w = 0; w < nWin; w++) {
                            var sumSq = 0;
                            var base = dataOffset + w * winSize * bytesPerFrame;
                            for (var s = 0; s < winSize; s++) {
                                var v = 0;
                                var o = base + s * bytesPerFrame;
                                for (var ch = 0; ch < channels; ch++) v += buf.readInt16LE(o + ch * 2);
                                v /= channels;
                                sumSq += v * v;
                            }
                            dbs[w] = 20 * Math.log10(Math.sqrt(sumSq / winSize) / 32768 + 1e-7);
                        }

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

                        resolve({
                            mediaPath: mediaPath,
                            profile: profile.label,
                            threshold: Number(threshold.toFixed(1)),
                            totalDuration: Number(totalDuration.toFixed(2)),
                            silenceCount: cuts.length,
                            totalSilenceTime: Number(totalCut.toFixed(2)),
                            totalSpeechTime: Number(totalSpeech.toFixed(2)),
                            silences: cuts,
                            speechSegments: speechSegments
                        });
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
