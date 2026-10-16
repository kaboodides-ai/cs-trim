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
    },

    /**
     * Helper to search for animatable transform properties on a clip (checking both standard Motion and Vector Motion)
     */
    findClipTransform: function(clip) {
        if (!clip || !clip.components) return { scale: null, position: null, opacity: null };

        var canKeyframe = function(prop) {
            if (!prop) return false;
            try {
                if (typeof prop.areKeyframesSupported === "function") {
                    return prop.areKeyframesSupported();
                }
                return true;
            } catch (e) {
                return true;
            }
        };

        var scaleProp = null;
        var posProp = null;
        var opacityProp = null;

        // PASS 1: Prioritize standard "ADBE Motion" (solid, reliable native motion in Premiere Pro)
        for (var i = 0; i < clip.components.numItems; i++) {
            var comp = clip.components[i];
            if (!comp || !comp.properties) continue;
            var mn = (comp.matchName || "").toLowerCase();
            var dn = (comp.displayName || "").toLowerCase();

            // Opacity component
            if (!opacityProp && (mn === "adbe opacity" || mn.indexOf("opacity") !== -1 || dn.indexOf("opacity") !== -1 || dn.indexOf("\u05d0\u05d8\u05d9\u05de\u05d5\u05ea") !== -1)) {
                for (var opIdx = 0; opIdx < comp.properties.numItems; opIdx++) {
                    var pOp = comp.properties[opIdx];
                    if (!pOp) continue;
                    var pOpName = (pOp.displayName || pOp.name || "").toLowerCase();
                    var pOpMatch = (pOp.matchName || "").toLowerCase();
                    if ((pOpMatch.indexOf("opacity") !== -1 || pOpName.indexOf("opacity") !== -1 || pOpName.indexOf("\u05d0\u05d8\u05d9\u05de\u05d5\u05ea") !== -1) && canKeyframe(pOp)) {
                        opacityProp = pOp;
                        break;
                    }
                }
            }

            // Standard Motion component (strictly avoid "vector motion" in pass 1)
            var isStandardMotion = (mn === "adbe motion" || (dn === "motion" && mn.indexOf("vector") === -1));
            if (isStandardMotion) {
                for (var pIdx = 0; pIdx < comp.properties.numItems; pIdx++) {
                    var prop = comp.properties[pIdx];
                    if (!prop) continue;
                    var pName = (prop.displayName || prop.name || "").toLowerCase();
                    var pMatch = (prop.matchName || "").toLowerCase();

                    // Match "Scale", avoiding "Scale Width" or "Scale Height"
                    if (!scaleProp && (pMatch === "adbe scale" || pName === "scale" || pName.indexOf("\u05e7\u05e0\u05d4 \u05de\u05d9\u05d3\u05d4") !== -1 || (pName.indexOf("scale") !== -1 && pName.indexOf("width") === -1 && pName.indexOf("height") === -1))) {
                        if (canKeyframe(prop)) {
                            scaleProp = prop;
                        }
                    }

                    // Match "Position"
                    if (!posProp && (pMatch === "adbe position" || pName === "position" || pName.indexOf("position") !== -1 || pName.indexOf("\u05de\u05d9\u05e7\u05d5\u05dd") !== -1)) {
                        if (canKeyframe(prop)) {
                            posProp = prop;
                        }
                    }
                }
            }
        }

        // PASS 2: Fallback to Vector Motion only if standard Motion was not found
        if (!scaleProp || !posProp) {
            for (var j = 0; j < clip.components.numItems; j++) {
                var c = clip.components[j];
                if (!c || !c.properties) continue;
                var cmn = (c.matchName || "").toLowerCase();
                var cdn = (c.displayName || "").toLowerCase();
                if (cmn.indexOf("motion") !== -1 || cdn.indexOf("motion") !== -1 || cdn.indexOf("\u05ea\u05e0\u05d5\u05e2\u05d4") !== -1) {
                    for (var k = 0; k < c.properties.numItems; k++) {
                        var pr = c.properties[k];
                        if (!pr) continue;
                        var prName = (pr.displayName || pr.name || "").toLowerCase();
                        var prMatch = (pr.matchName || "").toLowerCase();

                        if (!scaleProp && (prMatch === "adbe scale" || prName === "scale" || prName.indexOf("\u05e7\u05e0\u05d4 \u05de\u05d9\u05d3\u05d4") !== -1 || (prName.indexOf("scale") !== -1 && prName.indexOf("width") === -1 && prName.indexOf("height") === -1))) {
                            if (canKeyframe(pr)) scaleProp = pr;
                        }
                        if (!posProp && (prMatch === "adbe position" || prName === "position" || prName.indexOf("position") !== -1 || prName.indexOf("\u05de\u05d9\u05e7\u05d5\u05dd") !== -1)) {
                            if (canKeyframe(pr)) posProp = pr;
                        }
                    }
                }
            }
        }

        return {
            scale: scaleProp,
            position: posProp,
            opacity: opacityProp
        };
    },

    /**
     * Find Directional Blur or Gaussian Blur component on a clip
     */
    findBlurComponent: function(clip) {
        if (!clip || !clip.components) return null;
        for (var i = 0; i < clip.components.numItems; i++) {
            var comp = clip.components[i];
            if (!comp || !comp.properties) continue;
            var mn = (comp.matchName || "").toLowerCase();
            var dn = (comp.displayName || "").toLowerCase();
            if (mn.indexOf("directional blur") !== -1 || mn.indexOf("adbe directional blur") !== -1 ||
                dn.indexOf("directional blur") !== -1 || dn.indexOf("כיווני") !== -1 ||
                mn.indexOf("gaussian blur") !== -1 || dn.indexOf("gaussian blur") !== -1) {
                return comp;
            }
        }
        return null;
    },

    /**
     * Extract amount and direction properties from a blur component
     */
    getBlurProperties: function(comp) {
        if (!comp || !comp.properties) return { amount: null, direction: null };
        var amountProp = null;
        var dirProp = null;
        for (var p = 0; p < comp.properties.numItems; p++) {
            var prop = comp.properties[p];
            if (!prop) continue;
            var pName = (prop.displayName || prop.name || "").toLowerCase();
            var pMatch = (prop.matchName || "").toLowerCase();

            if (!dirProp && (pMatch.indexOf("direction") !== -1 || pName.indexOf("direction") !== -1 || pName.indexOf("כיוון") !== -1)) {
                dirProp = prop;
            }
            if (!amountProp && (pMatch.indexOf("length") !== -1 || pMatch.indexOf("blur") !== -1 || pName.indexOf("length") !== -1 || pName.indexOf("אורך") !== -1 || pName.indexOf("blur") !== -1 || pName.indexOf("טשטוש") !== -1)) {
                amountProp = prop;
            }
        }
        if (!amountProp && comp.properties.numItems > 1) {
            amountProp = comp.properties[1];
        } else if (!amountProp && comp.properties.numItems > 0) {
            amountProp = comp.properties[0];
        }
        if (!dirProp && comp.properties.numItems > 1 && amountProp !== comp.properties[0]) {
            dirProp = comp.properties[0];
        }
        return { amount: amountProp, direction: dirProp };
    },

    /**
     * Find and cache QE video effect object for Directional or Gaussian Blur
     */
    getQeBlurEffect: function() {
        if (typeof qe === "undefined" || !qe.project) return null;
        var candidateNames = [
            "AE.ADBE Directional Blur",
            "Directional Blur",
            "AE.ADBE Gaussian Blur 2",
            "Gaussian Blur"
        ];
        for (var n = 0; n < candidateNames.length; n++) {
            try {
                var eff = qe.project.getVideoEffectByName(candidateNames[n], true);
                if (eff) return eff;
            } catch (eEff) {}
        }
        try {
            var allEffects = qe.project.getVideoEffectList();
            if (allEffects && allEffects.length) {
                for (var e = 0; e < allEffects.length; e++) {
                    if (/directional.*blur/i.test(allEffects[e])) {
                        var eff2 = qe.project.getVideoEffectByName(allEffects[e], true);
                        if (eff2) return eff2;
                    }
                }
                for (var g = 0; g < allEffects.length; g++) {
                    if (/gaussian.*blur/i.test(allEffects[g])) {
                        var eff3 = qe.project.getVideoEffectByName(allEffects[g], true);
                        if (eff3) return eff3;
                    }
                }
            }
        } catch (eList) {}
        return null;
    },

    /**
     * Match a TrackItem to its corresponding QE clip item
     */
    findQEClip: function(qeSeq, clip, preferredTrackIdx) {
        if (!qeSeq) return null;
        try {
            var cs = (clip.start && typeof clip.start.seconds === "number") ? clip.start.seconds : (Number(clip.start) / TICKS_PER_SECOND);
            var numTracks = (typeof qeSeq.numVideoTracks === "number") ? qeSeq.numVideoTracks : (qeSeq.videoTracks ? qeSeq.videoTracks.length : 0);
            
            if (preferredTrackIdx >= 0 && preferredTrackIdx < numTracks) {
                var trk = qeSeq.getVideoTrackAt(preferredTrackIdx);
                if (trk) {
                    var nItems = (typeof trk.numItems === "number") ? trk.numItems : 0;
                    for (var q = 0; q < nItems; q++) {
                        var item = trk.getItemAt(q);
                        if (item && item.start && Math.abs(item.start.seconds - cs) < 0.05) {
                            return item;
                        }
                    }
                }
            }
            for (var v = 0; v < numTracks; v++) {
                var trk2 = qeSeq.getVideoTrackAt(v);
                if (!trk2) continue;
                var nItems2 = (typeof trk2.numItems === "number") ? trk2.numItems : 0;
                for (var q2 = 0; q2 < nItems2; q2++) {
                    var it = trk2.getItemAt(q2);
                    if (it && it.start && Math.abs(it.start.seconds - cs) < 0.05) {
                        return it;
                    }
                }
            }
        } catch (eFindQe) {}
        return null;
    },

    /**
     * Retrieve array of currently selected clips in the active sequence (with CTI playhead fallback)
     */
    getSelectedClipsList: function(seq) {
        if (!seq) return [];
        var selected = [];

        // 1. Try sequence.getSelection()
        if (typeof seq.getSelection === "function") {
            try {
                var sel = seq.getSelection();
                if (sel && sel.length > 0) {
                    for (var s = 0; s < sel.length; s++) {
                        if (sel[s]) selected.push(sel[s]);
                    }
                    if (selected.length > 0) return selected;
                }
            } catch (e1) {}
        }

        // 2. Iterate video tracks and check isSelected()
        if (seq.videoTracks) {
            for (var t = 0; t < seq.videoTracks.numTracks; t++) {
                var vt = seq.videoTracks[t];
                if (!vt || !vt.clips) continue;
                for (var c = 0; c < vt.clips.numItems; c++) {
                    var clp = vt.clips[c];
                    if (!clp) continue;
                    var isSel = false;
                    try {
                        if (typeof clp.isSelected === "function") isSel = clp.isSelected();
                        else if (typeof clp.isSelected === "boolean") isSel = clp.isSelected;
                    } catch (eSel) {}
                    if (isSel) selected.push(clp);
                }
            }
        }

        if (selected.length > 0) return selected;

        // 3. Fallback: Find clip directly under the playhead (CTI) on topmost video track
        try {
            var ctiSec = 0;
            var cti = seq.getPlayerPosition();
            if (cti && typeof cti.seconds === "number") ctiSec = cti.seconds;
            else if (cti) ctiSec = Number(cti) / TICKS_PER_SECOND;

            for (var vtIdx = seq.videoTracks.numTracks - 1; vtIdx >= 0; vtIdx--) {
                var trk = seq.videoTracks[vtIdx];
                if (!trk || !trk.clips) continue;
                for (var ci = 0; ci < trk.clips.numItems; ci++) {
                    var candidate = trk.clips[ci];
                    if (!candidate) continue;
                    var cStart = (candidate.start && typeof candidate.start.seconds === "number") ? candidate.start.seconds : (Number(candidate.start) / TICKS_PER_SECOND);
                    var cEnd = (candidate.end && typeof candidate.end.seconds === "number") ? candidate.end.seconds : (Number(candidate.end) / TICKS_PER_SECOND);
                    if (ctiSec >= (cStart - 0.05) && ctiSec <= (cEnd + 0.05)) {
                        selected.push(candidate);
                        return selected;
                    }
                }
            }
        } catch (eCti) {}

        return selected;
    },

    /**
     * Get count and summary of currently selected clips
     */
    getSelectedClipsInfo: function() {
        try {
            if (!app.project || !app.project.activeSequence) {
                return JSON.stringify({ count: 0, hasActiveSeq: false });
            }
            var seq = app.project.activeSequence;
            var selected = this.getSelectedClipsList(seq);
            return JSON.stringify({
                count: selected ? selected.length : 0,
                hasActiveSeq: true,
                seqName: seq.name || ""
            });
        } catch (e) {
            return JSON.stringify({ count: 0, error: e.toString() });
        }
    },

    /**
     * Automatically select all clips on the topmost video track containing clips
     */
    selectAllTopTrackClips: function() {
        try {
            if (!app.project || !app.project.activeSequence) {
                return JSON.stringify({ error: "No active sequence" });
            }
            var seq = app.project.activeSequence;
            if (!seq.videoTracks || seq.videoTracks.numTracks === 0) {
                return JSON.stringify({ error: "No video tracks found" });
            }
            var targetTrack = null;
            for (var t = seq.videoTracks.numTracks - 1; t >= 0; t--) {
                var vt = seq.videoTracks[t];
                if (vt && vt.clips && vt.clips.numItems > 0) {
                    targetTrack = vt;
                    break;
                }
            }
            if (!targetTrack) {
                return JSON.stringify({ error: "No clips found on any video track" });
            }
            var count = 0;
            for (var c = 0; c < targetTrack.clips.numItems; c++) {
                var clip = targetTrack.clips[c];
                if (clip && typeof clip.setSelected === "function") {
                    clip.setSelected(1, 1);
                    count++;
                }
            }
            return JSON.stringify({
                success: true,
                count: count,
                trackName: targetTrack.name || ""
            });
        } catch (e) {
            return JSON.stringify({ error: "selectAllTopTrackClips error: " + e.toString() });
        }
    },

    /**
     * Apply native Keyframe Animations (Pop, Slide, Zoom, Fade) to clips on targeted track (V1-V4)
     */
    applyTextAnimation: function(paramsJson) {
        try {
            if (!app.project || !app.project.activeSequence) {
                return JSON.stringify({ error: "No active sequence" });
            }
            var seq = app.project.activeSequence;
            var params = (typeof paramsJson === "string") ? JSON.parse(paramsJson) : (paramsJson || {});

            var preset = params.preset || "pop";
            var scope = params.scope || "in_out";
            var durationParam = Number(params.duration) || 0.35;
            var intensity = params.intensity || "standard";
            var targetTrack = params.targetTrack || "V2";
            var motionBlur = !!params.motionBlur;

            var clips = [];

            // 1. Target specific video track (V1, V2, V3, V4)
            var trackIdx = -1;
            if (typeof targetTrack === "string") {
                var m = targetTrack.match(/(\d+)/);
                if (m) trackIdx = parseInt(m[1], 10) - 1;
            }

            if (trackIdx >= 0 && trackIdx < seq.videoTracks.numTracks) {
                var vt = seq.videoTracks[trackIdx];
                if (vt && vt.clips && vt.clips.numItems > 0) {
                    var selectedOnTrack = [];
                    for (var c = 0; c < vt.clips.numItems; c++) {
                        var clp = vt.clips[c];
                        if (!clp) continue;
                        var isSel = false;
                        try {
                            if (typeof clp.isSelected === "function") isSel = clp.isSelected();
                            else if (typeof clp.isSelected === "boolean") isSel = clp.isSelected;
                        } catch (eSel) {}
                        if (isSel) selectedOnTrack.push(clp);
                    }
                    if (selectedOnTrack.length > 0) {
                        clips = selectedOnTrack;
                    } else {
                        for (var a = 0; a < vt.clips.numItems; a++) {
                            if (vt.clips[a]) clips.push(vt.clips[a]);
                        }
                    }
                }
            }

            // 2. Fallback: If no clips on target track, check if user explicitly selected clips elsewhere
            if (clips.length === 0) {
                clips = this.getSelectedClipsList(seq);
            }

            if (!clips || clips.length === 0) {
                return JSON.stringify({
                    error: "no_clips_found",
                    message: "\u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05d5 \u05e9\u05db\u05d1\u05d5\u05ea \u05d0\u05d5 \u05e7\u05dc\u05d9\u05e4\u05d9\u05dd \u05d1\u05e8\u05e6\u05d5\u05e2\u05d4 " + targetTrack + ". \u05d1\u05d7\u05e8 \u05e9\u05db\u05d1\u05d4 \u05d0\u05d7\u05e8\u05ea (V1-V4) \u05d0\u05d5 \u05e1\u05de\u05df \u05e9\u05db\u05d1\u05d4 \u05d1\u05d8\u05d9\u05d9\u05dd-\u05dc\u05d9\u05d9\u05df."
                });
            }

            var isScopeIn = (scope === "in" || scope === "in_out");
            var isScopeOut = (scope === "out" || scope === "in_out");

            // Initialize QE DOM if Motion Blur requested
            var qeSeq = null;
            if (motionBlur) {
                try {
                    if (typeof app.enableQE === "function") {
                        app.enableQE();
                    }
                    if (typeof qe !== "undefined" && qe.project) {
                        qeSeq = qe.project.getActiveSequence();
                    }
                } catch (eQeInit) {}
            }

            // Safe Keyframe placement helper
            var addAndSetKey = function(prop, sec, val) {
                var safeSec = Math.max(0, Number(sec) || 0);
                var t = new Time();
                t.seconds = safeSec;
                try {
                    t.ticks = Math.round(safeSec * TICKS_PER_SECOND).toString();
                } catch (eTk) {}

                // Ensure stopwatch / timeVarying is active
                try {
                    if (typeof prop.isTimeVarying === "function" && !prop.isTimeVarying()) {
                        prop.setTimeVarying(true);
                    }
                } catch (eTv) {}

                try {
                    prop.addKey(t);
                } catch (e1) {
                    try { prop.addKey(safeSec); } catch (e1b) {}
                }

                try {
                    prop.setValueAtKey(t, val, true);
                } catch (e2) {
                    try {
                        prop.setValueAtKey(t, val, 1);
                    } catch (e2b) {
                        try {
                            if (typeof val === "number") {
                                prop.setValueAtKey(t, [val, val], 1);
                            } else if (val instanceof Array && val.length > 0) {
                                prop.setValueAtKey(t, val[0], 1);
                            }
                        } catch (e2c) {
                            try {
                                prop.setValueAtKey(safeSec, val, 1);
                            } catch (e2d) {}
                        }
                    }
                }
                return t;
            };

            var tryInterpolation = function(prop, timeObj, type) {
                try {
                    if (prop && typeof prop.setInterpolationTypeAtKey === "function") {
                        prop.setInterpolationTypeAtKey(timeObj, (typeof type === "number" ? type : 5), 1);
                    }
                } catch (e) {}
            };

            var animatedCount = 0;

            for (var i = 0; i < clips.length; i++) {
                var clip = clips[i];
                if (!clip) continue;

                var tf = this.findClipTransform(clip);
                var scaleProp = tf.scale;
                var posProp = tf.position;
                var opacityProp = tf.opacity;

                if (!scaleProp && !posProp && !opacityProp) {
                    continue;
                }

                // Calculate LOCAL clip time boundaries (where Effect Controls keyframes live)
                var inSec = 0.0;
                if (clip.inPoint && typeof clip.inPoint.seconds === "number") {
                    inSec = clip.inPoint.seconds;
                }

                var clipDur = 3.0;
                if (clip.duration && typeof clip.duration.seconds === "number" && clip.duration.seconds > 0.05) {
                    clipDur = clip.duration.seconds;
                } else if (clip.outPoint && typeof clip.outPoint.seconds === "number") {
                    clipDur = Math.max(0.1, clip.outPoint.seconds - inSec);
                } else if (clip.end && clip.start) {
                    var cs = (typeof clip.start.seconds === "number") ? clip.start.seconds : (Number(clip.start) / TICKS_PER_SECOND);
                    var ce = (typeof clip.end.seconds === "number") ? clip.end.seconds : (Number(clip.end) / TICKS_PER_SECOND);
                    clipDur = Math.max(0.1, ce - cs);
                }

                var outSec = inSec + clipDur;
                var maxDurForClip = (isScopeIn && isScopeOut) ? (clipDur * 0.40) : (clipDur * 0.80);
                var safeDur = Math.min(durationParam, maxDurForClip);
                if (safeDur < 0.05) safeDur = 0.05;

                var didAnimate = false;

                // 1. POP / BOUNCE ANIMATION
                if (preset === "pop" && scaleProp) {
                    var overshoot = (intensity === "soft" ? 1.09 : (intensity === "punchy" ? 1.26 : 1.18));
                    var settle = (intensity === "soft" ? 0.98 : (intensity === "punchy" ? 0.94 : 0.96));

                    try {
                        scaleProp.setTimeVarying(false);
                        scaleProp.setValue(100, 1);
                        scaleProp.setTimeVarying(true);
                    } catch (ePopScale) {}

                    if (isScopeIn) {
                        addAndSetKey(scaleProp, inSec, 0);
                        var tPop = addAndSetKey(scaleProp, inSec + safeDur * 0.55, 100 * overshoot);
                        tryInterpolation(scaleProp, tPop, 5);
                        addAndSetKey(scaleProp, inSec + safeDur * 0.80, 100 * settle);
                        var tInEnd = addAndSetKey(scaleProp, inSec + safeDur, 100);
                        tryInterpolation(scaleProp, tInEnd, 5);
                    }

                    if (isScopeOut) {
                        var tOutStart = addAndSetKey(scaleProp, outSec - safeDur, 100);
                        tryInterpolation(scaleProp, tOutStart, 5);
                        var tAntic = addAndSetKey(scaleProp, outSec - safeDur * 0.25, 100 * 1.06);
                        tryInterpolation(scaleProp, tAntic, 5);
                        addAndSetKey(scaleProp, outSec, 0);
                    }

                    didAnimate = true;
                }

                // 2. SLIDE ANIMATIONS (Up, Down, Side)
                else if ((preset === "slide_up" || preset === "slide_down" || preset === "slide_side") && posProp) {
                    var curPos = posProp.getValue();
                    var baseX = 0.5;
                    var baseY = 0.5;
                    if (curPos) {
                        if (typeof curPos === "string") {
                            try { curPos = JSON.parse(curPos); } catch (e) {
                                var parts = curPos.split(",");
                                if (parts.length >= 2) {
                                    baseX = parseFloat(parts[0]);
                                    baseY = parseFloat(parts[1]);
                                }
                            }
                        }
                        if (typeof curPos === "object") {
                            if (typeof curPos.length === "number" && curPos.length >= 2) {
                                baseX = Number(curPos[0]);
                                baseY = Number(curPos[1]);
                            } else if (typeof curPos.x !== "undefined") {
                                baseX = Number(curPos.x);
                                baseY = Number(curPos.y);
                            }
                        }
                    }

                    var isPixel = (baseY > 10);
                    var offY = isPixel ? 140 : 0.12;
                    var startPos = [baseX, baseY + offY];
                    var endPos = [baseX, baseY - offY * 0.6];

                    if (preset === "slide_down") {
                        startPos = [baseX, baseY - offY];
                        endPos = [baseX, baseY + offY * 0.6];
                    }

                    try {
                        posProp.setTimeVarying(false);
                        posProp.setValue([baseX, baseY], 1);
                        posProp.setTimeVarying(true);
                    } catch (eSlidePos) {}

                    if (isScopeIn) {
                        addAndSetKey(posProp, inSec, startPos);
                        var tInPos = addAndSetKey(posProp, inSec + safeDur, [baseX, baseY]);
                        tryInterpolation(posProp, tInPos, 5);
                    }
                    if (isScopeOut) {
                        var tOutPosStart = addAndSetKey(posProp, outSec - safeDur, [baseX, baseY]);
                        tryInterpolation(posProp, tOutPosStart, 5);
                        addAndSetKey(posProp, outSec, endPos);
                    }

                    didAnimate = true;
                }

                // 3. ZOOM IN / ZOOM OUT ANIMATION
                else if ((preset === "zoom_in" || preset === "zoom_out") && scaleProp) {
                    var isZoomIn = (preset === "zoom_in");
                    var startScale = isZoomIn ? 35 : 175;
                    var outScale = isZoomIn ? 145 : 35;

                    try {
                        scaleProp.setTimeVarying(false);
                        scaleProp.setValue(100, 1);
                        scaleProp.setTimeVarying(true);
                    } catch (eZoomScale) {}

                    if (isScopeIn) {
                        addAndSetKey(scaleProp, inSec, startScale);
                        var tInZoom = addAndSetKey(scaleProp, inSec + safeDur, 100);
                        tryInterpolation(scaleProp, tInZoom, 5);
                    }
                    if (isScopeOut) {
                        var tOutZoom = addAndSetKey(scaleProp, outSec - safeDur, 100);
                        tryInterpolation(scaleProp, tOutZoom, 5);
                        addAndSetKey(scaleProp, outSec, outScale);
                    }

                    didAnimate = true;
                }

                // 4. SMOOTH FADE ANIMATION
                else if (preset === "fade" && opacityProp) {
                    try {
                        opacityProp.setTimeVarying(false);
                        opacityProp.setValue(100, 1);
                        opacityProp.setTimeVarying(true);
                    } catch (eFadeOp) {}

                    if (isScopeIn) {
                        addAndSetKey(opacityProp, inSec, 0);
                        var tInFade = addAndSetKey(opacityProp, inSec + safeDur, 100);
                        tryInterpolation(opacityProp, tInFade, 5);
                    }
                    if (isScopeOut) {
                        var tOutFade = addAndSetKey(opacityProp, outSec - safeDur, 100);
                        tryInterpolation(opacityProp, tOutFade, 5);
                        addAndSetKey(opacityProp, outSec, 0);
                    }
                    didAnimate = true;
                }

                // 5. DYNAMIC MOTION BLUR KEYFRAMING
                var blurComp = this.findBlurComponent(clip);
                if (!blurComp && motionBlur && qeSeq) {
                    var qeClip = this.findQEClip(qeSeq, clip, trackIdx);
                    if (qeClip) {
                        var eff = this.getQeBlurEffect();
                        if (eff) {
                            try {
                                qeClip.addVideoEffect(eff);
                            } catch (eAddFx) {}
                            blurComp = this.findBlurComponent(clip);
                        }
                    }
                }

                if (blurComp) {
                    var bp = this.getBlurProperties(blurComp);
                    if (bp.amount) {
                        if (motionBlur) {
                            if (bp.direction) {
                                var blurAngle = 0.0;
                                if (preset === "slide_side") {
                                    blurAngle = 90.0;
                                }
                                try {
                                    bp.direction.setTimeVarying(false);
                                    bp.direction.setValue(blurAngle, 1);
                                } catch (eBDir) {}
                            }

                            try {
                                bp.amount.setTimeVarying(false);
                                bp.amount.setValue(0, 1);
                                bp.amount.setTimeVarying(true);
                            } catch (eBAmtTv) {}

                            var peakBlur = (intensity === "punchy" ? 30 : (intensity === "soft" ? 16 : 24));

                            if (isScopeIn) {
                                addAndSetKey(bp.amount, inSec, peakBlur);
                                var tMidBlur = addAndSetKey(bp.amount, inSec + safeDur * 0.50, peakBlur * 0.35);
                                tryInterpolation(bp.amount, tMidBlur, 5);
                                var tEndBlur = addAndSetKey(bp.amount, inSec + safeDur, 0);
                                tryInterpolation(bp.amount, tEndBlur, 5);
                            }

                            if (isScopeOut) {
                                var tOutBlurStart = addAndSetKey(bp.amount, outSec - safeDur, 0);
                                tryInterpolation(bp.amount, tOutBlurStart, 5);
                                var tOutBlurMid = addAndSetKey(bp.amount, outSec - safeDur * 0.40, peakBlur * 0.45);
                                tryInterpolation(bp.amount, tOutBlurMid, 5);
                                addAndSetKey(bp.amount, outSec, peakBlur);
                            }
                        } else {
                            try {
                                bp.amount.setTimeVarying(false);
                                bp.amount.setValue(0, 1);
                            } catch (eBOff) {}
                        }
                    }
                }

                if (didAnimate) animatedCount++;
            }

            return JSON.stringify({
                success: true,
                count: animatedCount,
                track: targetTrack,
                preset: preset,
                message: "\u05d4\u05d0\u05e0\u05d9\u05de\u05e6\u05d9\u05d4 \u05d4\u05d5\u05d7\u05dc\u05d4 \u05d1\u05d4\u05e6\u05dc\u05d7\u05d4 \u05e2\u05dc " + animatedCount + " \u05e9\u05db\u05d1\u05d5\u05ea \u05d1\u05e8\u05e6\u05d5\u05e2\u05d4 " + targetTrack + "!"
            });
        } catch (e) {
            return JSON.stringify({ error: "applyTextAnimation error: " + e.toString() });
        }
    },

    /**
     * Clear and reset all keyframe animations from targeted track (V1-V4)
     */
    resetTextAnimation: function(paramsJson) {
        try {
            if (!app.project || !app.project.activeSequence) {
                return JSON.stringify({ error: "No active sequence" });
            }
            var seq = app.project.activeSequence;
            var params = (typeof paramsJson === "string") ? JSON.parse(paramsJson) : (paramsJson || {});
            var targetTrack = params.targetTrack || "V2";

            var clips = [];
            var trackIdx = -1;
            if (typeof targetTrack === "string") {
                var m = targetTrack.match(/(\d+)/);
                if (m) trackIdx = parseInt(m[1], 10) - 1;
            }

            if (trackIdx >= 0 && trackIdx < seq.videoTracks.numTracks) {
                var vt = seq.videoTracks[trackIdx];
                if (vt && vt.clips) {
                    for (var a = 0; a < vt.clips.numItems; a++) {
                        if (vt.clips[a]) clips.push(vt.clips[a]);
                    }
                }
            }

            if (clips.length === 0) {
                clips = this.getSelectedClipsList(seq);
            }

            if (!clips || clips.length === 0) {
                return JSON.stringify({
                    error: "no_clips_found",
                    message: "לא נמצאו שכבות לאיפוס ברצועה " + targetTrack
                });
            }

            var resetCount = 0;
            for (var i = 0; i < clips.length; i++) {
                var clip = clips[i];
                if (!clip) continue;

                var tf = this.findClipTransform(clip);
                if (tf.scale) {
                    try {
                        tf.scale.setTimeVarying(false);
                        tf.scale.setValue(100, 1);
                    } catch (e1) {}
                }
                if (tf.position) {
                    try {
                        var cp = tf.position.getValue();
                        tf.position.setTimeVarying(false);
                        if (cp) tf.position.setValue(cp, 1);
                    } catch (e2) {}
                }
                if (tf.opacity) {
                    try {
                        tf.opacity.setTimeVarying(false);
                        tf.opacity.setValue(100, 1);
                    } catch (e3) {}
                }

                var blurComp = this.findBlurComponent(clip);
                if (blurComp) {
                    var bp = this.getBlurProperties(blurComp);
                    if (bp.amount) {
                        try {
                            bp.amount.setTimeVarying(false);
                            bp.amount.setValue(0, 1);
                        } catch (eBReset) {}
                    }
                }

                resetCount++;
            }

            return JSON.stringify({
                success: true,
                count: resetCount,
                message: "האנימציות אופסו בהצלחה מ-" + resetCount + " שכבות ברצועה " + targetTrack + "!"
            });
        } catch (e) {
            return JSON.stringify({ error: "resetTextAnimation error: " + e.toString() });
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

function getSelectedClipsInfo() {
    return safeBridgeEncode(AutoCutHost.getSelectedClipsInfo());
}

function selectAllTopTrackClips() {
    return safeBridgeEncode(AutoCutHost.selectAllTopTrackClips());
}

function applyTextAnimation(paramsJson) {
    return safeBridgeEncode(AutoCutHost.applyTextAnimation(paramsJson));
}

function resetTextAnimation(paramsJson) {
    return safeBridgeEncode(AutoCutHost.resetTextAnimation(paramsJson));
}



