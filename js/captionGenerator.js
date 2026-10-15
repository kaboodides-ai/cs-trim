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
        "טיק טוק": "טיקטוק",
        "יו טיוב": "יוטיוב",
        "פייס בוק": "פייסבוק",
        "וואטס אפ": "וואטסאפ",
        "ווטסאפ": "וואטסאפ",
        "פריימיר": "פרמייר",
        "פרימייר": "פרמייר",
        "אינסטה": "אינסטגרם",
        "אינסטה גרם": "אינסטגרם"
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

        var allMaps = [this.HEBREW_CORRECTIONS, custom];
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
     * - Windows: uses ffmpeg (checks bundled bin or PATH)
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

            var isWin = (os.platform() === "win32");

            if (isWin) {
                // Windows extraction via ffmpeg
                var tempWav = path.join(os.tmpdir(), "autocut_caption_" + Date.now() + ".wav");
                var extDir = "";
                try {
                    if (typeof window !== "undefined" && window.csInterface) {
                        extDir = window.csInterface.getSystemPath("extension");
                    }
                } catch (e) {}

                var ffmpegBin = "ffmpeg";
                var bundledFfmpeg = path.join(extDir || "", "bin", "win", "ffmpeg.exe");
                if (fs.existsSync(bundledFfmpeg)) {
                    ffmpegBin = bundledFfmpeg;
                }

                var argsWin = ["-i", mediaPath, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", tempWav, "-y"];
                cp.execFile(ffmpegBin, argsWin, function (err, stdout, stderr) {
                    if (err) {
                        return reject(new Error("חילוץ אודיו נכשל ב-Windows. ודא ש-ffmpeg מותקן או נמצא בתיקיית הפלאגין. שגיאה: " + (stderr || err.message)));
                    }
                    resolve({ path: tempWav, type: "audio/wav", filename: "audio.wav" });
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
                            resolve({ path: tempWav, type: "audio/wav", filename: "audio.wav" });
                        });
                        return;
                    }
                    resolve({ path: tempAudio, type: "audio/m4a", filename: "audio.m4a" });
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
            var hebrewPrompt = "כתוביות בעברית תקנית, כתיב מלא, פיסוק נכון, מכבי, עריכת וידאו, פרמייר פרו, טיקטוק, אינסטגרם, יוטיוב, רילס, פודקאסט.";
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
                try { fs.unlinkSync(audioPath); } catch (e) {}
                resolve(data);
            })
            .catch(function (err) {
                try { fs.unlinkSync(audioPath); } catch (e) {}
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

            processNextPath();
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
