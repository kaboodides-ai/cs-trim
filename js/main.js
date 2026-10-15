/**
 * CS Trim - Client-side Main Script
 */

window.onerror = function (msg, url, line) {
    if (typeof log === "function") log("שגיאת JavaScript: " + msg + " (שורה " + line + ")", "error");
    return false;
};

var csInterface = new CSInterface();
var selectedProfile = "normal";

// Safe UTF-8 Bridge: seamlessly decode any percent-encoded data from ExtendScript
var _rawEvalScript = csInterface.evalScript.bind(csInterface);
csInterface.evalScript = function (script, callback) {
    _rawEvalScript(script, function (res) {
        var decoded = res;
        if (typeof res === "string") {
            try {
                decoded = decodeURIComponent(res);
            } catch (e) {
                try { decoded = unescape(res); } catch (e2) {}
            }
        }
        if (callback) callback(decoded);
    });
};

var MAC_ROMAN_HEBREW_MAP = {
    "\u2021": "א", "\u00B7": "ב", "\u201A": "ג", "\u201E": "ד", "\u2030": "ה",
    "\u00C2": "ו", "\u00CA": "ז", "\u00C1": "ח", "\u00CB": "ט", "\u00C8": "י",
    "\u00CD": "ך", "\u00CE": "כ", "\u00CF": "ל", "\u00CC": "ם", "\u00D3": "מ",
    "\u00D4": "ן", "\uF8FF": "נ", "\u00D2": "ס", "\u00DA": "ע", "\u00DB": "ף",
    "\u00D9": "פ", "\u0131": "ץ", "\u02C6": "צ", "\u02DC": "ק", "\u00AF": "ר",
    "\u02D8": "ש", "\u02D9": "ת"
};

function cleanUtf8(str) {
    if (!str || typeof str !== "string") return str || "";
    var res = str;
    try {
        res = decodeURIComponent(escape(str));
    } catch (e) {
        try {
            res = str.replace(/[\u0080-\u00FF]+/g, function (m) {
                try { return decodeURIComponent(escape(m)); } catch (e2) { return m; }
            });
        } catch (e3) {
            res = str;
        }
    }
    if (res && /[\u2021\u00B7\u201A\u201E\u2030\u00C2\u00CA\u00C1\u00CB\u00C8\u00CD\u00CE\u00CF\u00CC\u00D3\u00D4\uF8FF\u00D2\u00DA\u00DB\u00D9\u0131\u02C6\u02DC\u00AF\u02D8\u02D9]/.test(res)) {
        res = res.replace(/[\u2021\u00B7\u201A\u201E\u2030\u00C2\u00CA\u00C1\u00CB\u00C8\u00CD\u00CE\u00CF\u00CC\u00D3\u00D4\uF8FF\u00D2\u00DA\u00DB\u00D9\u0131\u02C6\u02DC\u00AF\u02D8\u02D9]/g, function (ch) {
            return MAC_ROMAN_HEBREW_MAP[ch] || ch;
        });
    }
    return res;
}

function log(message, type) {
    var box = document.getElementById("consoleBox");
    if (!box) return;
    var entry = document.createElement("div");
    entry.className = "log-entry" + (type ? " log-" + type : "");
    entry.dir = "rtl";

    var timeSpan = document.createElement("span");
    timeSpan.className = "log-time";
    timeSpan.dir = "ltr";
    timeSpan.textContent = "[" + new Date().toLocaleTimeString("he-IL", { hour12: false }) + "]";

    var msgSpan = document.createElement("span");
    msgSpan.className = "log-msg";
    msgSpan.dir = "auto";
    msgSpan.textContent = " " + message;

    entry.appendChild(timeSpan);
    entry.appendChild(msgSpan);
    box.appendChild(entry);
    box.scrollTop = box.scrollHeight;
}

function updateProgress(percent, text) {
    var area = document.getElementById("progressArea");
    if (!area) return;
    if (percent > 0 && percent < 100) area.style.display = "block";
    else if (percent >= 100) setTimeout(function () { area.style.display = "none"; }, 1200);
    else area.style.display = "none";
    document.getElementById("progressBar").style.width = percent + "%";
    document.getElementById("progressPercent").innerText = Math.round(percent) + "%";
    document.getElementById("progressStatus").innerText = text || "";
}

function setBusy(busy) {
    ["btnAutoCut", "btnSilenceMarkers", "btnUndoCut", "btnCaptions"].forEach(function (id) {
        var b = document.getElementById(id);
        if (b) b.disabled = busy;
    });
}

function escapeForEval(str) {
    return (str || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function ensureHostScriptLoaded(callback) {
    try {
        var extDir = csInterface.getSystemPath("extension");
        if (!extDir) extDir = "/Users/liamkaboodi/plugin text";
        var jsx = extDir.replace(/\\/g, "/") + "/host/index.jsx";
        csInterface.evalScript('$.evalFile(new File("' + jsx + '"))', function () {
            if (callback) callback();
        });
        return;
    } catch (e) {
        console.error("Failed to load host script:", e);
    }
    if (callback) callback();
}

function initTabs() {
    var tabButtons = document.querySelectorAll(".tab-btn");
    var tabViews = document.querySelectorAll(".tab-view");

    tabButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
            var targetId = this.getAttribute("data-tab");

            tabButtons.forEach(function (b) {
                b.classList.remove("active");
            });
            this.classList.add("active");

            tabViews.forEach(function (view) {
                if (view.id === targetId) {
                    view.style.display = "block";
                    view.classList.remove("active");
                    void view.offsetWidth; // re-trigger 0.15s fade-in animation
                    view.classList.add("active");
                } else {
                    view.style.display = "none";
                    view.classList.remove("active");
                }
            });
        });
    });
}

window.addEventListener("DOMContentLoaded", function () {
    try {
        initTabs();
        log("בודק חיבור ל-Premiere Pro...", "info");

        ensureHostScriptLoaded(function () {
            csInterface.evalScript("pingHost()", function (result) {
                var dot = document.querySelector(".status-dot");
                var txt = document.getElementById("statusText");
                if (result && result !== "EvalScript error." && result !== "CEP_NOT_FOUND") {
                    dot.classList.remove("offline");
                    txt.innerText = "מחובר";
                    log("מחובר ל-Premiere Pro", "success");
                    refreshSequenceInfo();
                } else {
                    dot.classList.add("offline");
                    txt.innerText = "לא מחובר";
                    log("פרמייר לא החזיר תשובה. נסה Reload.", "error");
                }
            });
        });

        // Initialize Groq API Key
        var apiKeyInput = document.getElementById("groqApiKey");
        if (apiKeyInput && typeof CaptionGenerator !== "undefined") {
            apiKeyInput.value = CaptionGenerator.getApiKey();
            apiKeyInput.addEventListener("input", function () {
                CaptionGenerator.saveApiKey(this.value);
            });
        }

        // Toggle Key Visibility (Show/Hide Button)
        var btnToggleKey = document.getElementById("btnToggleKey");
        if (btnToggleKey && apiKeyInput) {
            btnToggleKey.addEventListener("click", function () {
                if (apiKeyInput.type === "password") {
                    apiKeyInput.type = "text";
                    btnToggleKey.innerText = "הסתר";
                } else {
                    apiKeyInput.type = "password";
                    btnToggleKey.innerText = "הצג";
                }
            });
        }

        // Toggle Punctuation Checkbox (Tooltip / State)
        var punctInput = document.getElementById("captionPunctuation");
        var rowPunct = document.getElementById("rowPunctuation");
        if (punctInput) {
            var updatePunctTitle = function () {
                if (rowPunct) {
                    rowPunct.title = punctInput.checked
                        ? "סימני פיסוק: מופעל (עם פסיקים ונקודות)"
                        : "סימני פיסוק: כבוי (ללא סימני פיסוק)";
                }
            };
            punctInput.addEventListener("change", updatePunctTitle);
            updatePunctTitle();
        }

        // Toggle Stretch Gaps Checkbox (Tooltip / State)
        var stretchInput = document.getElementById("captionStretchGaps");
        var rowStretch = document.getElementById("rowStretchGaps");
        if (stretchInput) {
            var updateStretchTitle = function () {
                if (rowStretch) {
                    rowStretch.title = stretchInput.checked
                        ? "מתיחת כתוביות: מופעל (ללא רווחים ריקים)"
                        : "מתיחת כתוביות: כבוי (רווחים מקוריים)";
                }
            };
            stretchInput.addEventListener("change", updateStretchTitle);
            updateStretchTitle();
        }

        // Word Count Slider (1-8 words, live badge, mousewheel support)
        var wordSlider = document.getElementById("captionWordCount");
        var wordBadge = document.getElementById("captionWordCountVal");
        var sliderWrap = document.getElementById("sliderWrap");

        function updateWordSlider(val) {
            if (!wordSlider) return;
            var num = parseInt(val, 10);
            if (isNaN(num)) num = 3;
            num = Math.max(1, Math.min(8, num));
            wordSlider.value = num;

            if (wordBadge) {
                wordBadge.textContent = (num === 1) ? "מילה 1" : (num + " מילים");
            }

            // Fill percentage: (num - 1) / (8 - 1) * 100
            var pct = ((num - 1) / 7) * 100;
            wordSlider.style.setProperty("--slider-fill", pct.toFixed(1) + "%");
        }

        if (wordSlider) {
            updateWordSlider(wordSlider.value || 3);

            wordSlider.addEventListener("input", function () {
                updateWordSlider(this.value);
            });
            wordSlider.addEventListener("change", function () {
                updateWordSlider(this.value);
            });
        }

        if (wordBadge && wordSlider) {
            wordBadge.addEventListener("click", function () {
                var cur = parseInt(wordSlider.value, 10) || 3;
                var next = (cur >= 8) ? 1 : cur + 1;
                updateWordSlider(next);
            });
        }

        if (sliderWrap && wordSlider) {
            sliderWrap.addEventListener("wheel", function (e) {
                e.preventDefault();
                var cur = parseInt(wordSlider.value, 10) || 3;
                var step = (e.deltaY < 0 || e.deltaX > 0) ? 1 : -1;
                var next = Math.max(1, Math.min(8, cur + step));
                if (next !== cur) {
                    updateWordSlider(next);
                }
            }, { passive: false });
        }

        // Free Groq API Key link
        var linkGetApiKey = document.getElementById("linkGetApiKey");
        if (linkGetApiKey) {
            linkGetApiKey.addEventListener("click", function (e) {
                e.preventDefault();
                var url = "https://console.groq.com/keys";
                try {
                    csInterface.openURLInDefaultBrowser(url);
                } catch (err) {
                    window.open(url, "_blank");
                }
            });
        }

        // Profile buttons
        var buttons = document.querySelectorAll(".profile");
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener("click", function () {
                for (var j = 0; j < buttons.length; j++) buttons[j].classList.remove("active");
                this.classList.add("active");
                selectedProfile = this.getAttribute("data-profile");
            });
        }

        // Preview markers
        var btnSilenceMarkers = document.getElementById("btnSilenceMarkers");
        if (btnSilenceMarkers) {
            btnSilenceMarkers.addEventListener("click", function () {
                runSilenceDetection(function (analysis) {
                    csInterface.evalScript('addSilenceMarkers("' + escapeForEval(JSON.stringify(analysis.silences)) + '")', function (res) {
                        try {
                            var mData = JSON.parse(res);
                            if (mData.success) {
                                log("נוספו " + mData.count + " מרקרים של שקט לציר הזמן", "success");
                                return;
                            }
                        } catch (e) {}
                        log("נוספו " + analysis.silences.length + " מרקרים של שקט לציר הזמן", "success");
                    });
                });
            });
        }

        // Cut
        var btnAutoCut = document.getElementById("btnAutoCut");
        if (btnAutoCut) {
            btnAutoCut.addEventListener("click", function () {
                runSilenceDetection(function (analysis, seqData) {
                    log("יוצר גיבוי וחותך בסיקוונס הפעיל...", "info");
                    updateProgress(85, "מעבד חיתוך ישיר בטיים-ליין...");
                    var segJson = escapeForEval(JSON.stringify(analysis.speechSegments));
                    var mediaEsc = escapeForEval(analysis.mediaPath);
                    csInterface.evalScript('buildCutSequence("' + mediaEsc + '","' + segJson + '")', function (res) {
                        updateProgress(100, "הושלם!");
                        try {
                            var cutData = JSON.parse(res);
                            if (cutData.success) {
                                var cutMsg = "בוצע חיתוך: " + cutData.inserted + " קטעים (" + cutData.totalCutSec + " שניות)";
                                if (cutData.backupCreated && cutData.backupName) {
                                    cutMsg += " · נוצר גיבוי: " + cutData.backupName;
                                }
                                log(cutMsg, "success");
                                refreshSequenceInfo();
                                return;
                            }
                            if (cutData.error) {
                                log("שגיאה בביצוע החיתוך: " + cutData.error, "error");
                                return;
                            }
                        } catch (e) {}
                        if (res && res.indexOf("SUCCESS") === 0) {
                            log("חיתוך שקט הושלם בהצלחה!", "success");
                            refreshSequenceInfo();
                        } else {
                            log("שגיאה בביצוע החיתוך: " + res, "error");
                        }
                    });
                });
            });
        }

        // Undo Cut
        var btnUndoCut = document.getElementById("btnUndoCut");
        if (btnUndoCut) {
            btnUndoCut.addEventListener("click", function () {
                setBusy(true);
                log("מבטל את החיתוך ומשחזר מסיקוונס הגיבוי...", "info");
                updateProgress(30, "משחזר סיקוונס מקורי...");
                ensureHostScriptLoaded(function () {
                    csInterface.evalScript("undoLastCut()", function (result) {
                        setBusy(false);
                        updateProgress(100, "הושלם!");
                        try {
                            var data = JSON.parse(result);
                            if (data.success) {
                                log(data.message, "success");
                                refreshSequenceInfo();
                            } else {
                                log("שגיאה בביטול חיתוך: " + (data.error || result), "error");
                            }
                        } catch (e) {
                            log("תוצאת ביטול: " + result, "info");
                            refreshSequenceInfo();
                        }
                    });
                });
            });
        }

        // Captions Generation
        var btnCaptions = document.getElementById("btnCaptions");
        if (btnCaptions) {
            btnCaptions.addEventListener("click", function () {
            var apiKey = apiKeyInput ? apiKeyInput.value.trim() : "";
            if (!apiKey) {
                log("נא להזין מפתח Groq API חינמי. לחץ על הקישור למעלה לקבלת מפתח ב-30 שניות.", "error");
                if (apiKeyInput) apiKeyInput.focus();
                return;
            }

            var lang = "he";
            var wordCountEl = document.getElementById("captionWordCount");
            var wordCount = wordCountEl ? parseInt(wordCountEl.value, 10) : 3;
            var punctEl = document.getElementById("captionPunctuation");
            var includePunctuation = punctEl ? punctEl.checked : true;
            var stretchEl = document.getElementById("captionStretchGaps");
            var stretchGaps = stretchEl ? stretchEl.checked : false;
            var syncEl = document.getElementById("captionSync");
            var syncDelay = syncEl ? parseFloat(syncEl.value) : 0.12;

            setBusy(true);
            log("מתחיל ביצירת כתוביות AI מסונכרנות...", "info");
            updateProgress(5, "סורק קליפים בסיקוונס...");

            ensureHostScriptLoaded(function () {
                csInterface.evalScript("getSequenceClips()", function (result) {
                    try {
                        if (!result || result === "EvalScript error.") {
                            log("שגיאה בתקשורת עם פרמייר. ודא שיש סיקוונס פתוח.", "error");
                            updateProgress(0, "");
                            setBusy(false);
                            return;
                        }
                        var data = JSON.parse(result);
                        if (data.error) {
                            log("שגיאה מפרמייר: " + data.error, "error");
                            updateProgress(0, "");
                            setBusy(false);
                            return;
                        }
                        var clips = (data.allClips && data.allClips.length > 0) ? data.allClips : data.mediaFiles;
                        if (!clips || clips.length === 0) {
                            log("לא נמצאו קליפים בסיקוונס הפעיל.", "error");
                            updateProgress(0, "");
                            setBusy(false);
                            return;
                        }

                        log("מתמלל כתוביות לכל הסיקוונס (" + clips.length + " קטעים)...", "info");

                        var options = {
                            syncDelay: syncDelay,
                            wordCount: wordCount,
                            includePunctuation: includePunctuation,
                            stretchGaps: stretchGaps
                        };

                        CaptionGenerator.generateCaptions(clips, apiKey, lang, options, function (pct, msg) {
                            updateProgress(pct, msg);
                        }).then(function (capResult) {
                            updateProgress(90, "מייבא ומניח כתוביות לכל הסיקוונס בטיים-ליין...");
                            var srtEsc = escapeForEval(capResult.srtPath);
                            csInterface.evalScript('importSubtitles("' + srtEsc + '", 0)', function (hostRes) {
                                updateProgress(100, "הושלם!");
                                setBusy(false);
                                try {
                                    var hData = JSON.parse(hostRes);
                                    if (hData.success) {
                                        var subMsg = "נוצרו " + capResult.blocksCount + " כתוביות והונחו ישירות בסיקוונס בטיים-ליין!";
                                        if (hData.inTimeline === false) {
                                            subMsg = "נוצרו " + capResult.blocksCount + " כתוביות ויובאו לחלונית הפרויקט.";
                                        }
                                        log(subMsg, "success");
                                    } else {
                                        log("הכתוביות נוצרו בקובץ: " + capResult.srtPath + " (" + (hData.error || hostRes) + ")", "info");
                                    }
                                } catch (e) {
                                    log("הכתוביות נוצרו בהצלחה בקובץ SRT! (" + capResult.blocksCount + " שורות)", "success");
                                }
                            });
                        }).catch(function (err) {
                            log("שגיאה ביצירת כתוביות: " + err.message, "error");
                            updateProgress(0, "");
                            setBusy(false);
                        });
                    } catch (e) {
                        log("שגיאה בפענוח נתוני סיקוונס: " + e.message, "error");
                        updateProgress(0, "");
                        setBusy(false);
                    }
                });
            });
            });
        }
    } catch (e) {
        log("שגיאה באתחול הפאנל: " + e.message, "error");
    }
});

function runSilenceDetection(onSuccess) {
    setBusy(true);
    log("מאתר מדיה בסיקוונס הפעיל...", "info");
    updateProgress(5, "סורק קליפים...");

    var fail = function (msg) {
        log(msg, "error");
        updateProgress(0, "");
        setBusy(false);
    };

    ensureHostScriptLoaded(function () {
        csInterface.evalScript("getSequenceClips()", function (result) {
            try {
                if (!result || result === "EvalScript error.") {
                    return fail("שגיאה בתקשורת עם פרמייר (ודא שיש סיקוונס פעיל עם קליפ).");
                }
                var data = JSON.parse(result);
                if (data.error) return fail("שגיאה מפרמייר: " + data.error);
                if (!data.mediaFiles || data.mediaFiles.length === 0) {
                    return fail("לא נמצא קליפ בסיקוונס הפעיל.");
                }

                var target = data.mediaFiles[0];
                log("מנתח: " + (cleanUtf8(target.name) || "קובץ מדיה"), "info");

                AudioAnalyzer.analyzeFile(target.path, selectedProfile, function (pct, msg) {
                    updateProgress(pct, msg);
                }).then(function (analysis) {
                    var card = document.getElementById("resultsCard");
                    card.style.display = "block";
                    document.getElementById("resultsText").innerHTML =
                        "נמצאו <b>" + analysis.silenceCount + "</b> שתיקות לחיתוך · " +
                        "<b>" + analysis.totalSilenceTime + "s</b> מתוך " + analysis.totalDuration + "s";
                    log("פרופיל " + analysis.profile + " · סף " + analysis.threshold + "dB · " +
                        analysis.silenceCount + " חיתוכים (" + analysis.totalSilenceTime + "s)", "success");
                    setBusy(false);
                    if (onSuccess) onSuccess(analysis, data);
                }).catch(function (err) {
                    fail("שגיאה בניתוח הקובץ: " + err.message);
                });
            } catch (e) {
                fail("שגיאה בפענוח נתוני סיקוונס: " + e.message);
            }
        });
    });
}

function refreshSequenceInfo() {
    csInterface.evalScript("getSequenceInfo()", function (result) {
        var el = document.getElementById("seqName");
        if (!el) return;
        try {
            var data = JSON.parse(result);
            var seqName = cleanUtf8(data.name) || "סיקוונס ללא שם";
            el.innerText = data.error ? ("שגיאה: " + data.error) : (seqName + " · " + Math.round(data.duration || 0) + "s");
        } catch (e) {
            el.innerText = cleanUtf8(result) || "אין סיקוונס פתוח";
        }
    });
}
