/**
 * CS Trim Host Script (ExtendScript for Adobe Premiere Pro)
 */

// JSON Polyfill for ExtendScript (ES3)
if (typeof JSON !== "object") {
    JSON = {};
}
(function () {
    "use strict";
    var meta = { "\b": "\\b", "\t": "\\t", "\n": "\\n", "\f": "\\f", "\r": "\\r", "\"": "\\\"", "\\": "\\\\" };
    function quote(string) {
        return '"' + string.replace(/[\\"\u0000-\u001f\u007f-\uffff]/g, function (a) {
            var c = meta[a];
            return typeof c === "string" ? c : "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"';
    }
    function str(key, holder) {
        var value = holder[key];
        switch (typeof value) {
            case "string": return quote(value);
            case "number": return isFinite(value) ? String(value) : "null";
            case "boolean":
            case "null": return String(value);
            case "object":
                if (!value) return "null";
                var partial = [];
                if (Object.prototype.toString.apply(value) === "[object Array]") {
                    for (var i = 0; i < value.length; i++) {
                        partial[i] = str(i, value) || "null";
                    }
                    return "[" + partial.join(",") + "]";
                }
                for (var k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        var v = str(k, value);
                        if (v) partial.push(quote(k) + ":" + v);
                    }
                }
                return "{" + partial.join(",") + "}";
        }
        return "null";
    }
    if (typeof JSON.stringify !== "function") {
        JSON.stringify = function (value) { return str("", { "": value }); };
    }
    if (typeof JSON.parse !== "function") {
        JSON.parse = function (text) { return eval("(" + text + ")"); };
    }
}());

var TICKS_PER_SECOND = 254016000000;

var AutoCutHost = {
    /**
     * Normalize file paths for cross-platform comparison
     */
    normalizePath: function(p) {
        if (!p || typeof p !== "string") return "";
        return p.replace(/\\/g, "/").toLowerCase();
    },

    /**
     * Test connection between Panel (HTML/JS) and Premiere Pro
     */
    ping: function() {
        return "Connected to Adobe Premiere Pro successfully!";
    },

    /**
     * Internal helper to extract In/Out points and duration of a sequence
     */
    extractSequenceBounds: function(seq) {
        var seqDuration = 0;
        if (seq && seq.end) {
            seqDuration = (typeof seq.end.seconds !== "undefined") ? seq.end.seconds : (Number(seq.end) / TICKS_PER_SECOND);
        }

        var inPointSec = 0;
        var outPointSec = seqDuration;
        var hasCustomInOut = false;

        if (seq) {
            try {
                if (typeof seq.getInPointAsTime === "function") {
                    var tIn = seq.getInPointAsTime();
                    if (tIn && typeof tIn.seconds === "number") inPointSec = tIn.seconds;
                }
            } catch (e1) {}

            if (inPointSec === 0) {
                try {
                    if (typeof seq.getInPoint === "function") {
                        var rawIn = seq.getInPoint();
                        if (rawIn !== null && rawIn !== undefined && rawIn !== "") {
                            var pIn = parseFloat(rawIn);
                            if (!isNaN(pIn)) inPointSec = pIn;
                        }
                    }
                } catch (e2) {}
            }

            try {
                if (typeof seq.getOutPointAsTime === "function") {
                    var tOut = seq.getOutPointAsTime();
                    if (tOut && typeof tOut.seconds === "number") outPointSec = tOut.seconds;
                }
            } catch (e3) {}

            if (outPointSec === seqDuration || outPointSec === 0) {
                try {
                    if (typeof seq.getOutPoint === "function") {
                        var rawOut = seq.getOutPoint();
                        if (rawOut !== null && rawOut !== undefined && rawOut !== "") {
                            var pOut = parseFloat(rawOut);
                            if (!isNaN(pOut) && pOut > 0) outPointSec = pOut;
                        }
                    }
                } catch (e4) {}
            }

            if (outPointSec <= 0 || isNaN(outPointSec)) {
                outPointSec = seqDuration;
            }

            if (inPointSec > 0.05 || (outPointSec > 0 && Math.abs(outPointSec - seqDuration) > 0.1)) {
                hasCustomInOut = true;
            }
        }

        return {
            duration: seqDuration,
            inPoint: inPointSec,
            outPoint: outPointSec,
            hasCustomInOut: hasCustomInOut
        };
    },

    /**
     * Get In/Out points and duration of active sequence
     */
    getSequenceInOut: function() {
        try {
            if (!app.project || !app.project.activeSequence) {
                return JSON.stringify({ error: "No active sequence found" });
            }
            var seq = app.project.activeSequence;
            var bounds = AutoCutHost.extractSequenceBounds(seq);
            return JSON.stringify({
                name: seq.name,
                duration: bounds.duration,
                inPoint: bounds.inPoint,
                outPoint: bounds.outPoint,
                hasCustomInOut: bounds.hasCustomInOut
            });
        } catch (e) {
            return JSON.stringify({ error: "getSequenceInOut error: " + e.toString() });
        }
    },

    /**
     * Check if a project and active sequence exist
     */
    getActiveSequenceInfo: function() {
        try {
            if (!app.project) {
                return JSON.stringify({ error: "No project open" });
            }
            var seq = app.project.activeSequence;
            if (!seq) {
                return JSON.stringify({ error: "No active sequence found. Please open a sequence." });
            }

            var bounds = AutoCutHost.extractSequenceBounds(seq);

            return JSON.stringify({
                name: seq.name,
                id: seq.sequenceID,
                timebase: seq.timebase,
                duration: bounds.duration,
                inPoint: bounds.inPoint,
                outPoint: bounds.outPoint,
                hasCustomInOut: bounds.hasCustomInOut,
                zeroPoint: seq.zeroPoint
            });
        } catch (e) {
            return JSON.stringify({ error: "getActiveSequenceInfo error: " + e.toString() });
        }
    },

    /**
     * Get clips and media file paths from the active sequence
     */
    getSequenceClips: function() {
        try {
            if (!app.project || !app.project.activeSequence) {
                return JSON.stringify({ error: "No active sequence found. Please open a sequence." });
            }
            var seq = app.project.activeSequence;
            var allClips = [];

            // 1. Look through audio tracks first
            if (seq.audioTracks) {
                for (var a = 0; a < seq.audioTracks.numTracks; a++) {
                    var aTrack = seq.audioTracks[a];
                    if (!aTrack || !aTrack.clips) continue;
                    for (var ac = 0; ac < aTrack.clips.numItems; ac++) {
                        var aClip = aTrack.clips[ac];
                        if (aClip && aClip.projectItem) {
                            try {
                                var aPath = aClip.projectItem.getMediaPath();
                                if (aPath) {
                                    var aStartSec = aClip.start ? (aClip.start.seconds || (Number(aClip.start.ticks) / TICKS_PER_SECOND)) : 0;
                                    var aEndSec = aClip.end ? (aClip.end.seconds || (Number(aClip.end.ticks) / TICKS_PER_SECOND)) : 0;
                                    var aInPointSec = aClip.inPoint ? (aClip.inPoint.seconds || (Number(aClip.inPoint.ticks) / TICKS_PER_SECOND)) : 0;
                                    var aOutPointSec = aClip.outPoint ? (aClip.outPoint.seconds || (Number(aClip.outPoint.ticks) / TICKS_PER_SECOND)) : 0;
                                    allClips.push({
                                        name: aClip.name || "Audio Clip",
                                        path: aPath,
                                        start: aStartSec,
                                        end: aEndSec,
                                        inPoint: aInPointSec,
                                        outPoint: aOutPointSec,
                                        type: "audio"
                                    });
                                }
                            } catch (audioClipErr) {}
                        }
                    }
                }
            }

            // 2. If no audio tracks or need video tracks as well
            if (seq.videoTracks) {
                for (var v = 0; v < seq.videoTracks.numTracks; v++) {
                    var vTrack = seq.videoTracks[v];
                    if (!vTrack || !vTrack.clips) continue;
                    for (var c = 0; c < vTrack.clips.numItems; c++) {
                        var clip = vTrack.clips[c];
                        if (clip && clip.projectItem) {
                            try {
                                var vPath = clip.projectItem.getMediaPath();
                                if (vPath) {
                                    var vStartSec = clip.start ? (clip.start.seconds || (Number(clip.start.ticks) / TICKS_PER_SECOND)) : 0;
                                    var vEndSec = clip.end ? (clip.end.seconds || (Number(clip.end.ticks) / TICKS_PER_SECOND)) : 0;
                                    var vInPointSec = clip.inPoint ? (clip.inPoint.seconds || (Number(clip.inPoint.ticks) / TICKS_PER_SECOND)) : 0;
                                    var vOutPointSec = clip.outPoint ? (clip.outPoint.seconds || (Number(clip.outPoint.ticks) / TICKS_PER_SECOND)) : 0;
                                    // Only add if not already covered in audio at the exact same start
                                    var alreadyInAudio = false;
                                    for (var chk = 0; chk < allClips.length; chk++) {
                                        if (Math.abs(allClips[chk].start - vStartSec) < 0.05 && allClips[chk].path === vPath) {
                                            alreadyInAudio = true;
                                            break;
                                        }
                                    }
                                    if (!alreadyInAudio) {
                                        allClips.push({
                                            name: clip.name || "Video Clip",
                                            path: vPath,
                                            start: vStartSec,
                                            end: vEndSec,
                                            inPoint: vInPointSec,
                                            outPoint: vOutPointSec,
                                            type: "video"
                                        });
                                    }
                                }
                            } catch (clipErr) {}
                        }
                    }
                }
            }

            // Sort all clips chronologically by their start on the timeline
            allClips.sort(function(x, y) { return x.start - y.start; });

            // Distinct source media files
            var mediaFiles = [];
            var seenPaths = {};
            for (var m = 0; m < allClips.length; m++) {
                if (!seenPaths[allClips[m].path]) {
                    seenPaths[allClips[m].path] = true;
                    mediaFiles.push(allClips[m]);
                }
            }

            var bounds = AutoCutHost.extractSequenceBounds(seq);

            var frameW = 1080;
            var frameH = 1920;
            try {
                if (seq.frameSizeHorizontal && seq.frameSizeVertical) {
                    frameW = Number(seq.frameSizeHorizontal) || 1080;
                    frameH = Number(seq.frameSizeVertical) || 1920;
                } else if (typeof seq.getSettings === "function") {
                    var s = seq.getSettings();
                    if (s && s.videoFrameWidth && s.videoFrameHeight) {
                        frameW = Number(s.videoFrameWidth) || 1080;
                        frameH = Number(s.videoFrameHeight) || 1920;
                    }
                }
            } catch (dimErr) {}

            return JSON.stringify({
                sequenceName: seq.name,
                duration: bounds.duration,
                inPoint: bounds.inPoint,
                outPoint: bounds.outPoint,
                hasCustomInOut: bounds.hasCustomInOut,
                frameWidth: frameW,
                frameHeight: frameH,
                timebase: seq.timebase,
                mediaFiles: mediaFiles,
                allClips: allClips
            });
        } catch (e) {
            return JSON.stringify({ error: "getSequenceClips error: " + e.toString() });
        }
    },

    /**
     * Export active sequence to Final Cut Pro XML
     */
    exportSequenceXML: function(outputPath) {
        try {
            if (!app.project || !app.project.activeSequence) {
                return "ERROR: No active sequence";
            }
            var seq = app.project.activeSequence;
            var success = seq.exportAsFinalCutProXML(outputPath, 1);
            return success ? "SUCCESS" : "FAILED";
        } catch (e) {
            return "ERROR: " + e.toString();
        }
    },

    /**
     * Import a generated XML or SRT file into the project
     */
    importFile: function(filePath) {
        try {
            if (!app.project) {
                return "ERROR: No project open";
            }
            var success = app.project.importFiles([filePath], true, app.project.getInsertionBin(), false);
            return success ? "SUCCESS" : "FAILED";
        } catch (e) {
            return "ERROR: " + e.toString();
        }
    },

    /**
     * Add markers for detected silences so user can visualize them
     */
    addSilenceMarkers: function(silencesJson) {
        try {
            if (!app.project || !app.project.activeSequence) {
                return "ERROR: No active sequence";
            }
            var seq = app.project.activeSequence;
            var markers = seq.markers;
            var silences = JSON.parse(silencesJson);

            for (var i = 0; i < silences.length; i++) {
                var s = silences[i];
                var m = markers.createMarker(s.start);
                m.end = s.end;
                m.name = "Silence #" + (i + 1);
                m.comments = "Duration: " + (s.end - s.start).toFixed(2) + "s";
                m.setColorByIndex(0);
            }

            return JSON.stringify({ success: true, count: silences.length });
        } catch (e) {
            return JSON.stringify({ error: e.toString() });
        }
    },

    /**
     * Build a new sequence made only of the speech segments (silence removed).
     * Uses the native API (no XML import).
     */
    buildCutSequence: function(mediaPath, segmentsJson) {
        try {
            var segments = JSON.parse(segmentsJson);
            var srcSeq = app.project.activeSequence;
            if (!srcSeq) return "ERROR: No active sequence";

            // Find the project item AND the ranges of the source media actually used on the timeline
            var item = null;
            var used = [];
            var tracks = [srcSeq.videoTracks, srcSeq.audioTracks];
            var normTargetMedia = AutoCutHost.normalizePath(mediaPath);
            for (var t = 0; t < tracks.length; t++) {
                for (var i = 0; i < tracks[t].numTracks; i++) {
                    var clips = tracks[t][i].clips;
                    for (var c = 0; c < clips.numItems; c++) {
                        var pi = clips[c].projectItem;
                        if (pi && AutoCutHost.normalizePath(pi.getMediaPath()) === normTargetMedia) {
                            if (!item) item = pi;
                            used.push({ s: clips[c].inPoint.seconds, e: clips[c].outPoint.seconds });
                        }
                    }
                }
            }
            if (!item) return "ERROR: Source clip not found in sequence";

            // Merge the used ranges (video + audio of the same clip give identical ranges)
            used.sort(function(a, b) { return a.s - b.s; });
            var ranges = [];
            for (var u = 0; u < used.length; u++) {
                var last = ranges.length ? ranges[ranges.length - 1] : null;
                if (last && used[u].s <= last.e + 0.001) {
                    if (used[u].e > last.e) last.e = used[u].e;
                } else {
                    ranges.push({ s: used[u].s, e: used[u].e });
                }
            }

            // Keep only the parts of the speech segments that are inside the used ranges
            var finalSegs = [];
            for (var q = 0; q < segments.length; q++) {
                for (var rr = 0; rr < ranges.length; rr++) {
                    var a0 = Math.max(segments[q].start, ranges[rr].s);
                    var b0 = Math.min(segments[q].end, ranges[rr].e);
                    if (b0 - a0 > 0.05) finalSegs.push({ start: a0, end: b0 });
                }
            }
            if (finalSegs.length === 0) return "ERROR: No speech segments inside the timeline clip";

            // Record timeline start position of the clip being cut
            var startOffset = 0;
            var foundStart = false;
            for (var st = 0; st < tracks.length && !foundStart; st++) {
                for (var si = 0; si < tracks[st].numTracks && !foundStart; si++) {
                    var sClips = tracks[st][si].clips;
                    for (var sc = 0; sc < sClips.numItems; sc++) {
                        var spi = sClips[sc].projectItem;
                        if (spi && AutoCutHost.normalizePath(spi.getMediaPath()) === normTargetMedia) {
                            startOffset = sClips[sc].start.seconds;
                            foundStart = true;
                            break;
                        }
                    }
                }
            }

            var origIn = null, origOut = null;
            try { origIn = item.getInPoint(); origOut = item.getOutPoint(); } catch (ioErr) {}

            // Sets in/out and verifies Premiere really applied them
            var setRange = function(a, b) {
                for (var attempt = 0; attempt < 2; attempt++) {
                    var vIn = (attempt === 0) ? a : String(Math.round(a * TICKS_PER_SECOND));
                    var vOut = (attempt === 0) ? b : String(Math.round(b * TICKS_PER_SECOND));
                    item.setInPoint(0, 4);          // widen first so the new out is never before the old in
                    item.setOutPoint(vOut, 4);
                    item.setInPoint(vIn, 4);
                    var gi = item.getInPoint().seconds;
                    var go = item.getOutPoint().seconds;
                    if (Math.abs(gi - a) < 0.1 && Math.abs(go - b) < 0.1) return true;
                }
                return false;
            };

            // 1. Create duplicate backup sequence (e.g. MySequence_\u05d2\u05d9\u05d1\u05d5\u05d9)
            var backupName = srcSeq.name + "_\u05d2\u05d9\u05d1\u05d5\u05d9";
            var backupCreated = false;
            if (typeof srcSeq.clone === "function") {
                try {
                    var cloneSuccess = srcSeq.clone();
                    if (cloneSuccess) {
                        var allSeqs = app.project.sequences;
                        var backupSeq = allSeqs[allSeqs.length - 1];
                        if (backupSeq) {
                            backupSeq.name = backupName;
                            backupCreated = true;
                        }
                    }
                } catch (cloneErr) {}
            }

            // Ensure the original sequence remains active and in focus
            app.project.openSequence(srcSeq.sequenceID);

            // 2. Remove the uncut clips of this media from the active sequence
            var all = [srcSeq.videoTracks, srcSeq.audioTracks];
            for (var a = 0; a < all.length; a++) {
                for (var k = 0; k < all[a].numTracks; k++) {
                    var tc = all[a][k].clips;
                    for (var r = tc.numItems - 1; r >= 0; r--) {
                        var pi = tc[r].projectItem;
                        if (pi && AutoCutHost.normalizePath(pi.getMediaPath()) === normTargetMedia) {
                            tc[r].remove(false, false);
                        }
                    }
                }
            }

            // 3. Insert each speech segment back-to-back directly in the active sequence (In-place)
            var position = startOffset;
            var inserted = 0;
            for (var n = 0; n < finalSegs.length; n++) {
                var seg = finalSegs[n];
                var dur = seg.end - seg.start;
                if (!setRange(seg.start, seg.end)) {
                    try {
                        if (origIn) item.setInPoint(origIn.seconds, 4);
                        if (origOut) item.setOutPoint(origOut.seconds, 4);
                    } catch (e1) {}
                    return "ERROR: Premiere did not apply in/out points (segment " + (n + 1) + ")";
                }
                var tm = new Time();
                tm.seconds = position;
                srcSeq.insertClip(item, tm, 0, 0);
                position += dur;
                inserted++;
            }

            // Reset the source item's in/out so it is not left trimmed
            try {
                if (origIn) item.setInPoint(origIn.seconds, 4);
                if (origOut) item.setOutPoint(origOut.seconds, 4);
            } catch (resetErr) {}

            var totalCutSec = (position - startOffset).toFixed(1);
            return JSON.stringify({
                success: true,
                inserted: inserted,
                totalCutSec: totalCutSec,
                backupCreated: backupCreated,
                backupName: backupName || ""
            });
        } catch (e) {
            return JSON.stringify({ error: e.toString() });
        }
    },

    /**
     * Add a marker to the active sequence (test function)
     */
    addTestMarker: function() {
        try {
            if (!app.project || !app.project.activeSequence) {
                return "Error: No active sequence";
            }
            var seq = app.project.activeSequence;
            var markers = seq.markers;
            var pos = seq.getPlayerPosition();
            var posSec = (pos && typeof pos.seconds !== "undefined") ? pos.seconds : 0;
            var newMarker = markers.createMarker(posSec);
            newMarker.name = "CS Trim Test Marker";
            newMarker.comments = "Created by CS Trim Plugin";
            newMarker.setColorByIndex(1);
            return "Marker added at current playhead position!";
        } catch (e) {
            return "Error: " + e.toString();
        }
    },

    /**
     * Import an SRT subtitle file into Premiere Pro and place it directly on the active sequence
     */
    importSubtitles: function(srtPath, startOffset) {
        try {
            if (!app.project) {
                return JSON.stringify({ error: "No project open" });
            }
            var cleanSrt = (srtPath || "").replace(/\\/g, "/");
            var srtFile = new File(cleanSrt);
            if (!srtFile.exists) {
                srtFile = new File(srtPath);
            }
            if (!srtFile.exists) {
                return JSON.stringify({ error: "SRT file not found: " + srtPath });
            }

            var offsetSec = 0;
            if (typeof startOffset !== "undefined" && startOffset !== null) {
                offsetSec = Math.max(0, Number(startOffset) || 0);
            }

            var targetBin = app.project.getInsertionBin ? app.project.getInsertionBin() : app.project.rootItem;
            var importTarget = (srtFile.fsName) ? srtFile.fsName : cleanSrt;
            var success = app.project.importFiles([importTarget], true, targetBin, false);
            if (!success) {
                // Retry with raw path if needed
                success = app.project.importFiles([srtPath], true, targetBin, false);
            }
            if (!success) {
                return JSON.stringify({ error: "Failed to import SRT into project" });
            }

            // Find the imported project item recursively across project bins
            var srtName = srtFile.name;
            var cleanName = srtName.replace(/\.srt$/i, "");
            var findItem = function(bin) {
                if (!bin || !bin.children) return null;
                for (var i = 0; i < bin.children.numItems; i++) {
                    var child = bin.children[i];
                    if (!child) continue;
                    try {
                        if (child.name === srtName || child.name === cleanName) return child;
                    } catch (e1) {}
                    try {
                        var mp = child.getMediaPath();
                        if (mp && (mp === srtPath || mp.indexOf(srtName) !== -1)) return child;
                    } catch (e2) {}
                    if (child.children && child.children.numItems > 0) {
                        var sub = findItem(child);
                        if (sub) return sub;
                    }
                }
                return null;
            };

            var importedItem = findItem(app.project.rootItem);
            if (!importedItem && app.project.getInsertionBin) {
                importedItem = findItem(app.project.getInsertionBin());
            }

            if (!importedItem) {
                return JSON.stringify({
                    success: true,
                    inTimeline: false,
                    message: "\u05d4\u05db\u05ea\u05d5\u05d1\u05d9\u05d5\u05ea \u05d9\u05d5\u05d1\u05d0\u05d5 \u05dc-Project Bin. \u05dc\u05d0 \u05d6\u05d5\u05d4\u05d4 \u05e4\u05e8\u05d9\u05d8 \u05d4\u05db\u05ea\u05d5\u05d1\u05d9\u05d5\u05ea \u05dc\u05d4\u05d5\u05e1\u05e4\u05d4 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea."
                });
            }

            var inTimeline = false;
            var seq = app.project.activeSequence;
            if (seq) {
                var format = (typeof Sequence !== "undefined" && Sequence.CAPTION_FORMAT_SUBTITLE) ? Sequence.CAPTION_FORMAT_SUBTITLE : "Subtitle";
                // 1. Try createCaptionTrack with seconds number
                try {
                    var r1 = seq.createCaptionTrack(importedItem, offsetSec, format);
                    if (r1 !== false) inTimeline = true;
                } catch (e1) {}

                // 2. Try createCaptionTrack without format
                if (!inTimeline) {
                    try {
                        var r2 = seq.createCaptionTrack(importedItem, offsetSec);
                        if (r2 !== false) inTimeline = true;
                    } catch (e2) {}
                }

                // 3. Try createCaptionTrack with Time object
                if (!inTimeline) {
                    try {
                        var t0 = new Time();
                        t0.seconds = offsetSec;
                        var r3 = seq.createCaptionTrack(importedItem, t0);
                        if (r3 !== false) inTimeline = true;
                    } catch (e3) {}
                }

                // 4. Fallback for older versions: overwrite onto top video track
                if (!inTimeline && seq.videoTracks && seq.videoTracks.numTracks > 0) {
                    try {
                        var targetTrack = seq.videoTracks[seq.videoTracks.numTracks - 1];
                        var tFallback = new Time();
                        tFallback.seconds = offsetSec;
                        targetTrack.overwriteClip(importedItem, tFallback);
                        inTimeline = true;
                    } catch (e4) {}
                }
            }

            return JSON.stringify({
                success: true,
                inTimeline: inTimeline,
                message: inTimeline ? "\u05d4\u05db\u05ea\u05d5\u05d1\u05d9\u05d5\u05ea \u05e0\u05d5\u05e6\u05e8\u05d5 \u05d5\u05d4\u05d5\u05e0\u05d7\u05d5 \u05d9\u05e9\u05d9\u05e8\u05d5\u05ea \u05d1\u05e1\u05d9\u05e7\u05d5\u05d5\u05e0\u05e1 \u05d1\u05d8\u05d9\u05d9\u05dd-\u05dc\u05d9\u05d9\u05df!" : "\u05d4\u05db\u05ea\u05d5\u05d1\u05d9\u05d5\u05ea \u05d9\u05d5\u05d1\u05d0\u05d5 \u05dc-Project Bin. \u05d2\u05e8\u05d5\u05e8 \u05d0\u05d5\u05ea\u05df \u05dc\u05d8\u05d9\u05d9\u05dd-\u05dc\u05d9\u05d9\u05df."
            });
        } catch (e) {
            return JSON.stringify({ error: "importSubtitles error: " + e.toString() });
        }
    },

    /**
     * Import rendered word-highlight marker PNG clips and place them on a dedicated top Video Track
     */
    importHighlightedSubtitles: function(manifestPath) {
        try {
            if (!app.project || !app.project.activeSequence) {
                return JSON.stringify({ error: "No active sequence open" });
            }
            var seq = app.project.activeSequence;
            var cleanManifest = (manifestPath || "").replace(/\\/g, "/");
            var mFile = new File(cleanManifest);
            if (!mFile.exists) {
                mFile = new File(manifestPath);
            }
            if (!mFile.exists) {
                return JSON.stringify({ error: "Manifest file not found: " + manifestPath });
            }

            mFile.encoding = "UTF-8";
            mFile.open("r");
            var rawJson = mFile.read();
            mFile.close();

            var manifest = JSON.parse(rawJson);
            var items = (manifest && manifest.items) ? manifest.items : [];
            if (!items || items.length === 0) {
                return JSON.stringify({ error: "No highlight items found in manifest" });
            }

            // Create a dedicated bin in the project root to keep the user's project tidy
            var rootBin = app.project.rootItem;
            var hlBin = null;
            try {
                hlBin = rootBin.createBin("CS Trim - \u05de\u05e8\u05e7\u05e8 \u05de\u05d9\u05dc\u05d9\u05dd");
            } catch (binErr) {
                hlBin = app.project.getInsertionBin ? app.project.getInsertionBin() : rootBin;
            }
            if (!hlBin) hlBin = rootBin;

            // Collect all PNG file paths for a single fast batch import
            var importPaths = [];
            for (var i = 0; i < items.length; i++) {
                var f = new File(items[i].pngPath);
                importPaths.push(f.fsName ? f.fsName : items[i].pngPath);
            }

            var importedOk = app.project.importFiles(importPaths, true, hlBin, false);
            if (!importedOk) {
                return JSON.stringify({ error: "Failed to import highlight PNG files into Premiere Pro" });
            }

            // Map imported ProjectItems by name for instant lookup
            var itemMap = {};
            var mapBinChildren = function(bin) {
                if (!bin || !bin.children) return;
                for (var c = 0; c < bin.children.numItems; c++) {
                    var child = bin.children[c];
                    if (!child) continue;
                    try {
                        var nm = child.name;
                        if (nm) {
                            itemMap[nm] = child;
                            itemMap[nm.replace(/\.png$/i, "")] = child;
                        }
                    } catch (e1) {}
                }
            };
            mapBinChildren(hlBin);
            if (hlBin !== rootBin) {
                mapBinChildren(rootBin);
            }

            // Check if a Video Track already has previous CS Trim highlight clips (hl_*) and clean them up for seamless re-apply
            var targetTrack = null;
            if (seq.videoTracks && seq.videoTracks.numTracks > 1) {
                for (var checkVt = seq.videoTracks.numTracks - 1; checkVt >= 1; checkVt--) {
                    var trk = seq.videoTracks[checkVt];
                    if (!trk || !trk.clips || trk.clips.numItems === 0) continue;
                    var hasHlClips = false;
                    for (var hc = trk.clips.numItems - 1; hc >= 0; hc--) {
                        var clipName = trk.clips[hc].name || "";
                        if (clipName.indexOf("hl_") === 0) {
                            hasHlClips = true;
                            try { trk.clips[hc].remove(false, false); } catch (remErr) {}
                        }
                    }
                    if (hasHlClips && !targetTrack) {
                        targetTrack = trk;
                    }
                }
            }

            // Otherwise find an empty top Video Track (above V1), or add a new Video Track via QE if all tracks have clips
            if (!targetTrack && seq.videoTracks && seq.videoTracks.numTracks > 1) {
                for (var vt = seq.videoTracks.numTracks - 1; vt >= 1; vt--) {
                    var candidate = seq.videoTracks[vt];
                    if (candidate && candidate.clips && candidate.clips.numItems === 0) {
                        targetTrack = candidate;
                        break;
                    }
                }
            }

            if (!targetTrack) {
                try {
                    app.enableQE();
                    var qeSeq = qe.project.getActiveSequence();
                    if (qeSeq && typeof qeSeq.addTracks === "function") {
                        qeSeq.addTracks(1, seq.videoTracks.numTracks, 0, 0);
                    }
                } catch (qeErr) {}

                if (seq.videoTracks && seq.videoTracks.numTracks > 0) {
                    targetTrack = seq.videoTracks[seq.videoTracks.numTracks - 1];
                }
            }

            if (!targetTrack) {
                return JSON.stringify({ error: "No video track available for highlight overlays" });
            }

            var placedCount = 0;
            for (var k = 0; k < items.length; k++) {
                var entry = items[k];
                var baseNoExt = (entry.pngName || "").replace(/\.png$/i, "");
                var projItem = itemMap[entry.pngName] || itemMap[baseNoExt];
                if (!projItem) continue;

                var startSec = Math.max(0, Number(entry.start) || 0);
                var endSec = Math.max(startSec + 0.05, Number(entry.end) || (startSec + 0.25));

                var startTime = new Time();
                startTime.seconds = startSec;

                var endTime = new Time();
                endTime.seconds = endSec;

                try {
                    targetTrack.overwriteClip(projItem, startTime);
                    placedCount++;

                    // Trim the newly placed clip on the timeline to match endSec
                    var clipsCol = targetTrack.clips;
                    for (var tc = clipsCol.numItems - 1; tc >= 0; tc--) {
                        var trkClip = clipsCol[tc];
                        if (trkClip && trkClip.start && Math.abs(trkClip.start.seconds - startSec) < 0.15) {
                            trkClip.end = endTime;
                            break;
                        }
                    }
                } catch (placeErr) {}
            }

            return JSON.stringify({
                success: true,
                inTimeline: placedCount > 0,
                placedCount: placedCount
            });
        } catch (e) {
            return JSON.stringify({ error: "importHighlightedSubtitles error: " + e.toString() });
        }
    },

    /**
     * Move the active sequence playhead to a specific timestamp (in seconds)
     */
    setPlayheadPosition: function(seconds) {
        try {
            if (!app.project || !app.project.activeSequence) {
                return JSON.stringify({ error: "No active sequence" });
            }
            var seq = app.project.activeSequence;
            var sec = Math.max(0, Number(seconds) || 0);
            var ticksStr = String(Math.round(sec * TICKS_PER_SECOND));
            seq.setPlayerPosition(ticksStr);
            return JSON.stringify({ success: true, seconds: sec });
        } catch (e) {
            return JSON.stringify({ error: e.toString() });
        }
    },

    /**
     * Undo the last AutoCut and restore the original sequence from its backup
     */
    undoLastCut: function() {
        try {
            if (!app.project) return JSON.stringify({ error: "No project open" });
            var curSeq = app.project.activeSequence;
            if (!curSeq) return JSON.stringify({ error: "No active sequence found" });

            var curName = curSeq.name;
            var targetBackupName = curName + "_\u05d2\u05d9\u05d1\u05d5\u05d9";
            var allSeqs = app.project.sequences;
            var backupSeq = null;

            // 1. Look for curName + "_\u05d2\u05d9\u05d1\u05d5\u05d9"
            for (var i = 0; i < allSeqs.length; i++) {
                if (allSeqs[i].name === targetBackupName) {
                    backupSeq = allSeqs[i];
                    break;
                }
            }

            // 2. If not found, look for any sequence containing "_\u05d2\u05d9\u05d1\u05d5\u05d9"
            if (!backupSeq) {
                for (var j = allSeqs.length - 1; j >= 0; j--) {
                    if (allSeqs[j].sequenceID !== curSeq.sequenceID) {
                        if (allSeqs[j].name.indexOf(curName) !== -1 || allSeqs[j].name.indexOf("_\u05d2\u05d9\u05d1\u05d5\u05d9") !== -1) {
                            backupSeq = allSeqs[j];
                            break;
                        }
                    }
                }
            }

            if (!backupSeq) {
                return JSON.stringify({ error: "\u05dc\u05d0 \u05e0\u05de\u05e6\u05d0 \u05e1\u05d9\u05e7\u05d5\u05d5\u05e0\u05e1 \u05d2\u05d9\u05d1\u05d5\u05d9 \u05e2\u05d1\u05d5\u05e8 \u05e1\u05d9\u05e7\u05d5\u05d5\u05e0\u05e1 \u05d6\u05d4 (\u05d5\u05d3\u05d0 \u05e9\u05d1\u05d5\u05e6\u05e2 \u05d7\u05d9\u05ea\u05d5\u05da \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9 \u05e9\u05d9\u05e6\u05e8 \u05d2\u05d9\u05d1\u05d5\u05d9)." });
            }

            var origName = curName;
            // Rename backup sequence back to original name
            backupSeq.name = origName;

            // Delete or rename the cut sequence
            try {
                if (curSeq.projectItem && curSeq.projectItem.deleteAsset) {
                    curSeq.projectItem.deleteAsset();
                } else {
                    curSeq.name = origName + "_\u05d7\u05d9\u05ea\u05d5\u05da_\u05de\u05d1\u05d5\u05d8\u05dc";
                }
            } catch (delErr) {
                curSeq.name = origName + "_\u05d7\u05d9\u05ea\u05d5\u05da_\u05de\u05d1\u05d5\u05d8\u05dc";
            }

            // Open the restored backup sequence
            app.project.openSequence(backupSeq.sequenceID);

            return JSON.stringify({
                success: true,
                restoredName: origName,
                message: "\u05d4\u05d7\u05d9\u05ea\u05d5\u05da \u05d1\u05d5\u05d8\u05dc \u05d1\u05d4\u05e6\u05dc\u05d7\u05d4! \u05d4\u05e1\u05d9\u05e7\u05d5\u05d5\u05e0\u05e1 \u05d4\u05de\u05e7\u05d5\u05e8\u05d9 \u05e9\u05d5\u05d7\u05d6\u05e8 \u05d1\u05de\u05dc\u05d5\u05d0\u05d5."
            });
        } catch (e) {
            return JSON.stringify({ error: "undoLastCut error: " + e.toString() });
        }
    }
};

// Safe UTF-8 Bridge Helper: guarantees 100% safe ASCII-only transfer across ExtendScript IPC
function safeBridgeEncode(val) {
    if (val === null || val === undefined) return "";
    var s = (typeof val === "string") ? val : String(val);
    try {
        return encodeURIComponent(s);
    } catch (e) {
        return escape(s);
    }
}

// Global helper wrappers for CSInterface.evalScript
function pingHost() {
    return safeBridgeEncode(AutoCutHost.ping());
}

function getSequenceInfo() {
    return safeBridgeEncode(AutoCutHost.getActiveSequenceInfo());
}

function getSequenceClips() {
    return safeBridgeEncode(AutoCutHost.getSequenceClips());
}

function exportSequenceXML(outputPath) {
    return safeBridgeEncode(AutoCutHost.exportSequenceXML(outputPath));
}

function importProjectFile(filePath) {
    return safeBridgeEncode(AutoCutHost.importFile(filePath));
}

function addSilenceMarkers(silencesJson) {
    return safeBridgeEncode(AutoCutHost.addSilenceMarkers(silencesJson));
}

function addMarker() {
    return safeBridgeEncode(AutoCutHost.addTestMarker());
}

function buildCutSequence(mediaPath, segmentsJson) {
    return safeBridgeEncode(AutoCutHost.buildCutSequence(mediaPath, segmentsJson));
}

function importSubtitles(srtPath, startOffset) {
    return safeBridgeEncode(AutoCutHost.importSubtitles(srtPath, startOffset));
}

function importHighlightedSubtitles(manifestPath) {
    return safeBridgeEncode(AutoCutHost.importHighlightedSubtitles(manifestPath));
}

function undoLastCut() {
    return safeBridgeEncode(AutoCutHost.undoLastCut());
}

function getSequenceInOut() {
    return safeBridgeEncode(AutoCutHost.getSequenceInOut());
}

function setPlayheadPosition(seconds) {
    return safeBridgeEncode(AutoCutHost.setPlayheadPosition(seconds));
}


