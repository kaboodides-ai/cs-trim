/**
 * CS Trim - Client-side Main Script
 */

window.onerror = function (msg, url, line) {
    if (typeof log === "function") log("שגיאת JavaScript: " + msg + " (שורה " + line + ")", "error");
    return false;
};

var csInterface = (typeof window !== "undefined" && window.csInterface) ? window.csInterface : new CSInterface();
if (typeof window !== "undefined") window.csInterface = csInterface;
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

var unreadLogs = 0;
var hasLogError = false;

function updateLogBadge() {
    var badge = document.getElementById("logBadge");
    var counter = document.getElementById("logCounter");
    var box = document.getElementById("consoleBox");

    if (counter && box) {
        var count = box.querySelectorAll(".log-entry").length;
        counter.textContent = count === 1 ? "הודעה 1" : count + " הודעות";
    }

    if (!badge) return;
    var logView = document.getElementById("view-log");
    var isOpen = logView && logView.style.display !== "none" && logView.classList.contains("active");

    if (isOpen) {
        unreadLogs = 0;
        hasLogError = false;
        badge.style.display = "none";
        badge.classList.remove("has-error");
        return;
    }

    if (unreadLogs > 0) {
        badge.style.display = "inline-flex";
        badge.textContent = unreadLogs > 99 ? "99+" : unreadLogs;
        if (hasLogError) {
            badge.classList.add("has-error");
        } else {
            badge.classList.remove("has-error");
        }
    } else {
        badge.style.display = "none";
        badge.classList.remove("has-error");
    }
}

var lastActiveTabId = "view-trim";

function openLogView(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    var logView = document.getElementById("view-log");
    var isAlreadyOpen = logView && logView.style.display !== "none" && logView.classList.contains("active");

    // If already in log view, toggle back to the previous tab
    if (isAlreadyOpen) {
        closeLogView(e);
        return;
    }

    // Remember currently active tab
    var activeBtn = document.querySelector(".tab-btn.active");
    if (activeBtn && activeBtn.getAttribute("data-tab")) {
        lastActiveTabId = activeBtn.getAttribute("data-tab");
    }

    var tabButtons = document.querySelectorAll(".tab-btn");
    for (var i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove("active");
    }

    var topLogBtn = document.getElementById("btnOpenLog");
    if (topLogBtn) {
        topLogBtn.classList.add("active");
    }

    var tabViews = document.querySelectorAll(".tab-view");
    for (var k = 0; k < tabViews.length; k++) {
        if (tabViews[k].id === "view-log") {
            tabViews[k].style.display = "block";
            tabViews[k].classList.remove("active");
            void tabViews[k].offsetWidth;
            tabViews[k].classList.add("active");
        } else {
            tabViews[k].style.display = "none";
            tabViews[k].classList.remove("active");
        }
    }

    unreadLogs = 0;
    hasLogError = false;
    updateLogBadge();
    var box = document.getElementById("consoleBox");
    if (box) {
        box.scrollTop = box.scrollHeight;
    }
}
window.openLogView = openLogView;
window.openLogModal = openLogView; // alias for compatibility

function closeLogView(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    var targetId = lastActiveTabId || "view-trim";

    var topLogBtn = document.getElementById("btnOpenLog");
    if (topLogBtn) {
        topLogBtn.classList.remove("active");
    }

    var tabButtons = document.querySelectorAll(".tab-btn");
    for (var i = 0; i < tabButtons.length; i++) {
        if (tabButtons[i].getAttribute("data-tab") === targetId) {
            tabButtons[i].classList.add("active");
        } else {
            tabButtons[i].classList.remove("active");
        }
    }

    var tabViews = document.querySelectorAll(".tab-view");
    for (var k = 0; k < tabViews.length; k++) {
        var view = tabViews[k];
        if (view.id === targetId) {
            view.style.display = "block";
            view.classList.remove("active");
            void view.offsetWidth;
            view.classList.add("active");
            if (targetId === "view-captions" && typeof updateInOutHint === "function") {
                updateInOutHint();
            } else if (targetId === "view-animations" && typeof TextAnimator !== "undefined" && TextAnimator.refreshSelectionCount) {
                TextAnimator.refreshSelectionCount(true);
                TextAnimator.triggerPreviewAnimation();
            }
        } else {
            view.style.display = "none";
            view.classList.remove("active");
        }
    }

    updateLogBadge();
}
window.closeLogView = closeLogView;

function clearLogs(e) {
    if (e && e.preventDefault) e.preventDefault();
    var box = document.getElementById("consoleBox");
    if (box) {
        box.innerHTML = '<div class="log-empty-state">היומן נוקה (אין הודעות)</div>';
    }
    unreadLogs = 0;
    hasLogError = false;
    updateLogBadge();
}
window.clearLogs = clearLogs;

function copyLogsToClipboard(e) {
    if (e && e.preventDefault) e.preventDefault();
    var box = document.getElementById("consoleBox");
    if (!box) return;
    var entries = box.querySelectorAll(".log-entry");
    var lines = [];
    for (var i = 0; i < entries.length; i++) {
        lines.push(entries[i].textContent.trim());
    }
    var text = lines.join("\n");
    if (!text.trim()) return;

    var btn = document.getElementById("btnCopyLog");
    var markCopied = function () {
        if (btn) {
            var oldHtml = btn.innerHTML;
            btn.innerHTML = '<span>הועתק! ✓</span>';
            setTimeout(function () { btn.innerHTML = oldHtml; }, 1500);
        }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(markCopied).catch(function () {
            fallbackCopy(text, markCopied);
        });
    } else {
        fallbackCopy(text, markCopied);
    }
}
window.copyLogsToClipboard = copyLogsToClipboard;

function fallbackCopy(text, onSuccess) {
    try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        if (onSuccess) onSuccess();
    } catch (e) {
        console.error("Failed to copy log:", e);
    }
}

function log(message, type) {
    var box = document.getElementById("consoleBox");
    if (!box) return;

    var empty = box.querySelector(".log-empty-state");
    if (empty && empty.parentNode) empty.parentNode.removeChild(empty);

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

    var logView = document.getElementById("view-log");
    var isLogOpen = logView && logView.style.display !== "none" && logView.classList.contains("active");
    if (!isLogOpen) {
        unreadLogs++;
        if (type === "error") hasLogError = true;
    }
    updateLogBadge();
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
    return (str || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');
}
window.escapeForEval = escapeForEval;

function ensureHostScriptLoaded(callback) {
    try {
        csInterface.evalScript('typeof applyTextAnimation === "function"', function (isLoaded) {
            if (isLoaded === "true" || isLoaded === true) {
                if (callback) callback();
                return;
            }
            var extDir = csInterface.getSystemPath("extension");
            if (extDir) {
                var cleanDir = extDir.replace(/^file:\/\/\/?/i, "").replace(/^\/([a-zA-Z]:)/, "$1").replace(/\\/g, "/");
                var jsx = cleanDir + "/host/index.jsx";
                csInterface.evalScript('$.evalFile(new File("' + jsx + '"))', function () {
                    if (callback) callback();
                });
            } else {
                if (callback) callback();
            }
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

    for (var i = 0; i < tabButtons.length; i++) {
        (function (btn) {
            btn.addEventListener("click", function () {
                var targetId = this.getAttribute("data-tab");
                lastActiveTabId = targetId;

                var topLogBtn = document.getElementById("btnOpenLog");
                if (topLogBtn) {
                    topLogBtn.classList.remove("active");
                }

                for (var j = 0; j < tabButtons.length; j++) {
                    tabButtons[j].classList.remove("active");
                }
                this.classList.add("active");

                for (var k = 0; k < tabViews.length; k++) {
                    var view = tabViews[k];
                    if (view.id === targetId) {
                        view.style.display = "block";
                        view.classList.remove("active");
                        void view.offsetWidth;
                        view.classList.add("active");
                        if (targetId === "view-captions") {
                            if (typeof updateInOutHint === "function") updateInOutHint();
                            if (typeof CaptionGenerator !== "undefined" && CaptionGenerator.fetchRemoteCorrections) {
                                CaptionGenerator.fetchRemoteCorrections();
                            }
                        } else if (targetId === "view-animations" && typeof TextAnimator !== "undefined" && TextAnimator.refreshSelectionCount) {
                            TextAnimator.refreshSelectionCount(true);
                            TextAnimator.triggerPreviewAnimation();
                        }
                    } else {
                        view.style.display = "none";
                        view.classList.remove("active");
                    }
                }
            });
        })(tabButtons[i]);
    }
}

var selectedCaptionScope = "entire";
try {
    selectedCaptionScope = localStorage.getItem("autocut_caption_scope") || "entire";
} catch (e) {}

function formatTimeSec(seconds) {
    var s = Math.max(0, Number(seconds) || 0);
    var mins = Math.floor(s / 60);
    var secs = (s % 60).toFixed(1);
    if (secs < 10) secs = "0" + secs;
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return pad(mins) + ":" + secs;
}

function updateInOutHint() {
    var inOutHint = document.getElementById("inOutHint");
    if (!inOutHint || selectedCaptionScope !== "inout") {
        if (inOutHint) inOutHint.style.display = "none";
        return;
    }
    ensureHostScriptLoaded(function () {
        csInterface.evalScript("getSequenceInOut()", function (res) {
            try {
                if (!res || res === "EvalScript error.") {
                    inOutHint.textContent = "אין סיקוונס פתוח";
                    inOutHint.className = "scope-hint warning";
                    inOutHint.style.display = "block";
                    return;
                }
                var data = JSON.parse(res);
                if (data.error) {
                    inOutHint.textContent = "אין סיקוונס פתוח";
                    inOutHint.className = "scope-hint warning";
                    inOutHint.style.display = "block";
                    return;
                }
                if (data.hasCustomInOut) {
                    var dur = Math.max(0, data.outPoint - data.inPoint).toFixed(1);
                    inOutHint.textContent = "טווח In/Out בטיים-ליין: " + formatTimeSec(data.inPoint) + " עד " + formatTimeSec(data.outPoint) + " (" + dur + " שניות)";
                    inOutHint.className = "scope-hint";
                    inOutHint.style.display = "block";
                } else {
                    inOutHint.textContent = "שים לב: לא סומנו נקודות In/Out ספציפיות בטיים-ליין (מקשים I ו-O). יופק לכל הסיקוונס.";
                    inOutHint.className = "scope-hint warning";
                    inOutHint.style.display = "block";
                }
            } catch (e) {
                inOutHint.style.display = "none";
            }
        });
    });
}

function updateCaptionsButtonLabel() {
    var btnCaptions = document.getElementById("btnCaptions");
    if (!btnCaptions) return;
    var hlEl = document.getElementById("captionWordHighlight");
    var isHl = hlEl && hlEl.checked;
    if (selectedCaptionScope === "inout") {
        btnCaptions.textContent = isHl ? "יצירת כתוביות ל-In / Out + מרקר" : "יצירת כתוביות ל-In / Out";
    } else {
        btnCaptions.textContent = isHl ? "יצירת כתוביות לכל הסיקוונס + מרקר" : "יצירת כתוביות לכל הסיקוונס";
    }
}

function updateCaptionScopeUI(scope) {
    selectedCaptionScope = scope || "entire";
    try {
        localStorage.setItem("autocut_caption_scope", selectedCaptionScope);
    } catch (e) {}

    var scopeButtons = document.querySelectorAll(".scope-btn");
    for (var i = 0; i < scopeButtons.length; i++) {
        var b = scopeButtons[i];
        if (b.getAttribute("data-scope") === selectedCaptionScope) {
            b.classList.add("active");
        } else {
            b.classList.remove("active");
        }
    }

    updateCaptionsButtonLabel();

    if (selectedCaptionScope === "inout") {
        updateInOutHint();
    } else {
        var inOutHint = document.getElementById("inOutHint");
        if (inOutHint) inOutHint.style.display = "none";
    }
}

function initApp() {
    try {
        initTabs();

        // Log View Triggers
        var btnOpenLog = document.getElementById("btnOpenLog");
        if (btnOpenLog) {
            btnOpenLog.onclick = openLogView;
        }

        var btnBackFromLog = document.getElementById("btnBackFromLog");
        if (btnBackFromLog) {
            btnBackFromLog.onclick = closeLogView;
        }

        var connStatus = document.getElementById("connectionStatus");
        if (connStatus) {
            connStatus.onclick = openLogView;
        }

        var btnClearLog = document.getElementById("btnClearLog");
        if (btnClearLog) {
            btnClearLog.onclick = clearLogs;
        }

        var btnCopyLog = document.getElementById("btnCopyLog");
        if (btnCopyLog) {
            btnCopyLog.onclick = copyLogsToClipboard;
        }

        log("בודק חיבור ל-Premiere Pro...", "info");

        if (typeof CaptionGenerator !== "undefined" && CaptionGenerator.fetchRemoteCorrections) {
            CaptionGenerator.fetchRemoteCorrections();
        }

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
            CaptionGenerator.fetchRemoteCorrections();
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

        // Caption Scope Selector (Entire Sequence vs In/Out)
        var scopeButtons = document.querySelectorAll(".scope-btn");
        for (var sb = 0; sb < scopeButtons.length; sb++) {
            scopeButtons[sb].addEventListener("click", function () {
                var scope = this.getAttribute("data-scope");
                updateCaptionScopeUI(scope);
            });
        }
        updateCaptionScopeUI(selectedCaptionScope);

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

        // Word Highlight (Marker) Toggle & Color Picker (Cross-platform Mac & Windows)
        var highlightInput = document.getElementById("captionWordHighlight");
        var rowHighlight = document.getElementById("rowWordHighlight");
        var rowHighlightColor = document.getElementById("rowHighlightColor");
        var highlightPreviewPill = document.getElementById("highlightPreviewPill");
        var colorPickerInput = document.getElementById("captionHighlightColor");
        var colorSwatches = document.querySelectorAll(".color-swatch");
        var customColorWrap = document.getElementById("customColorWrap") || document.querySelector(".custom-color-picker-wrap");
        var customColorBtn = document.getElementById("customColorBtn");
        var highlightColorPopover = document.getElementById("highlightColorPopover");
        var popoverCloseBtn = document.getElementById("popoverCloseBtn");
        var btnApplyCustomColor = document.getElementById("btnApplyCustomColor");
        var colorSvField = document.getElementById("colorSvField");
        var colorSvCursor = document.getElementById("colorSvCursor");
        var colorHueBar = document.getElementById("colorHueBar");
        var colorHueCursor = document.getElementById("colorHueCursor");
        var popoverHexInput = document.getElementById("popoverHexInput");
        var popoverPreviewBox = document.getElementById("popoverPreviewBox");
        var btnColorEyedropper = document.getElementById("btnColorEyedropper");
        var btnSystemColor = document.getElementById("btnSystemColor");
        var miniSwatches = document.querySelectorAll(".color-mini-swatch");

        var curH = 48, curS = 92, curV = 98;
        var isDraggingSV = false;
        var isDraggingHue = false;

        function hsvToRgb(h, s, v) {
            s = Math.max(0, Math.min(100, s)) / 100;
            v = Math.max(0, Math.min(100, v)) / 100;
            var c = v * s;
            var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
            var m = v - c;
            var r1 = 0, g1 = 0, b1 = 0;

            if (h >= 0 && h < 60) {
                r1 = c; g1 = x; b1 = 0;
            } else if (h >= 60 && h < 120) {
                r1 = x; g1 = c; b1 = 0;
            } else if (h >= 120 && h < 180) {
                r1 = 0; g1 = c; b1 = x;
            } else if (h >= 180 && h < 240) {
                r1 = 0; g1 = x; b1 = c;
            } else if (h >= 240 && h < 300) {
                r1 = x; g1 = 0; b1 = c;
            } else if (h >= 300 && h <= 360) {
                r1 = c; g1 = 0; b1 = x;
            }

            return {
                r: Math.round((r1 + m) * 255),
                g: Math.round((g1 + m) * 255),
                b: Math.round((b1 + m) * 255)
            };
        }

        function rgbToHex(r, g, b) {
            var toHex = function (c) {
                var h = Math.max(0, Math.min(255, Math.round(c))).toString(16);
                return h.length === 1 ? "0" + h : h;
            };
            return ("#" + toHex(r) + toHex(g) + toHex(b)).toUpperCase();
        }

        function hexToRgb(hex) {
            if (!hex) return null;
            var clean = hex.replace("#", "").trim();
            if (clean.length === 3) {
                clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
            }
            if (clean.length !== 6) return null;
            var num = parseInt(clean, 16);
            if (isNaN(num)) return null;
            return {
                r: (num >> 16) & 255,
                g: (num >> 8) & 255,
                b: num & 255
            };
        }

        function rgbToHsv(r, g, b) {
            r /= 255; g /= 255; b /= 255;
            var max = Math.max(r, g, b), min = Math.min(r, g, b);
            var h = 0, s = 0, v = max;
            var d = max - min;
            s = max === 0 ? 0 : d / max;

            if (max === min) {
                h = 0;
            } else {
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }
                h /= 6;
            }
            return {
                h: Math.round(h * 360),
                s: Math.round(s * 100),
                v: Math.round(v * 100)
            };
        }

        function syncHsvFromHex(hex) {
            var rgb = hexToRgb(hex);
            if (rgb) {
                var hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
                curH = hsv.h;
                curS = hsv.s;
                curV = hsv.v;
            }
        }

        function renderCustomPicker(applyLive) {
            var rgb = hsvToRgb(curH, curS, curV);
            var hex = rgbToHex(rgb.r, rgb.g, rgb.b);

            if (colorSvField) {
                colorSvField.style.backgroundColor = "hsl(" + curH + ", 100%, 50%)";
            }
            if (colorSvCursor) {
                colorSvCursor.style.left = curS + "%";
                colorSvCursor.style.top = (100 - curV) + "%";
            }
            if (colorHueCursor) {
                colorHueCursor.style.left = ((curH / 360) * 100) + "%";
            }
            if (popoverPreviewBox) {
                popoverPreviewBox.style.backgroundColor = hex;
            }
            if (popoverHexInput && document.activeElement !== popoverHexInput) {
                popoverHexInput.value = hex.replace("#", "").toUpperCase();
            }

            if (applyLive) {
                applyHighlightColor(hex, true);
            }
        }

        var selectedHighlightColor = "#FACC15";
        try {
            var savedColor = localStorage.getItem("autocut_highlight_color");
            if (savedColor && /^#[0-9A-Fa-f]{6}$/.test(savedColor)) {
                selectedHighlightColor = savedColor;
            }
            var savedHlEnabled = localStorage.getItem("autocut_highlight_enabled");
            if (highlightInput && savedHlEnabled !== null) {
                highlightInput.checked = (savedHlEnabled === "true");
            }
        } catch (e) {}

        function applyHighlightColor(colorHex, autoEnable) {
            if (!colorHex) return;
            selectedHighlightColor = colorHex;
            try { localStorage.setItem("autocut_highlight_color", colorHex); } catch (e) {}

            if (colorPickerInput && colorPickerInput.value.toLowerCase() !== colorHex.toLowerCase()) {
                colorPickerInput.value = colorHex;
            }
            if (highlightPreviewPill) {
                highlightPreviewPill.style.setProperty("--hl-color", colorHex);
                highlightPreviewPill.style.background = colorHex;
            }

            var matchedPreset = false;
            for (var sIdx = 0; sIdx < colorSwatches.length; sIdx++) {
                var sw = colorSwatches[sIdx];
                var swColor = (sw.getAttribute("data-color") || "").toLowerCase();
                if (swColor === colorHex.toLowerCase()) {
                    sw.classList.add("active");
                    matchedPreset = true;
                } else {
                    sw.classList.remove("active");
                }
            }

            if (customColorWrap) {
                if (!matchedPreset) {
                    customColorWrap.classList.add("active");
                } else {
                    customColorWrap.classList.remove("active");
                }
            }

            if (customColorBtn) {
                if (!matchedPreset) {
                    customColorBtn.style.background = "radial-gradient(circle at center, " + colorHex + " 0%, " + colorHex + " 52%, transparent 54%), conic-gradient(#EF4444, #F59E0B, #10B981, #3B82F6, #8B5CF6, #EC4899, #EF4444)";
                } else {
                    customColorBtn.style.background = "";
                }
            }

            for (var m = 0; m < miniSwatches.length; m++) {
                var ms = miniSwatches[m];
                var mColor = (ms.getAttribute("data-color") || "").toLowerCase();
                if (mColor === colorHex.toLowerCase()) {
                    ms.classList.add("active");
                } else {
                    ms.classList.remove("active");
                }
            }

            if (popoverPreviewBox) {
                popoverPreviewBox.style.backgroundColor = colorHex;
            }
            if (popoverHexInput && document.activeElement !== popoverHexInput) {
                popoverHexInput.value = colorHex.replace("#", "").toUpperCase();
            }

            if (autoEnable && highlightInput && !highlightInput.checked) {
                highlightInput.checked = true;
                updateHighlightToggleState();
            }
        }

        function updateHighlightToggleState() {
            var isOn = highlightInput ? highlightInput.checked : false;
            try { localStorage.setItem("autocut_highlight_enabled", isOn ? "true" : "false"); } catch (e) {}

            if (rowHighlight) {
                rowHighlight.classList.toggle("highlight-enabled", isOn);
                rowHighlight.title = isOn
                    ? "הייליט מילים (מרקר): מופעל (מדגיש כל מילה בזמן הדיבור)"
                    : "הייליט מילים (מרקר): כבוי";
            }
            if (rowHighlightColor) {
                rowHighlightColor.classList.toggle("is-disabled", !isOn);
            }
            updateCaptionsButtonLabel();
        }

        function openHighlightPopover() {
            if (!highlightColorPopover) return;
            highlightColorPopover.style.display = "block";
            if (customColorBtn) customColorBtn.classList.add("popover-open");
            syncHsvFromHex(selectedHighlightColor || "#FACC15");
            renderCustomPicker(false);
        }

        function closeHighlightPopover() {
            if (!highlightColorPopover) return;
            highlightColorPopover.style.display = "none";
            if (customColorBtn) customColorBtn.classList.remove("popover-open");
        }

        function toggleHighlightPopover() {
            if (!highlightColorPopover) return;
            if (highlightColorPopover.style.display === "none" || !highlightColorPopover.style.display) {
                openHighlightPopover();
            } else {
                closeHighlightPopover();
            }
        }

        if (highlightInput) {
            highlightInput.addEventListener("change", updateHighlightToggleState);
        }

        for (var cs = 0; cs < colorSwatches.length; cs++) {
            colorSwatches[cs].addEventListener("click", function () {
                var c = this.getAttribute("data-color");
                if (c) {
                    syncHsvFromHex(c);
                    applyHighlightColor(c, true);
                    renderCustomPicker(false);
                }
            });
        }

        if (customColorBtn) {
            customColorBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                toggleHighlightPopover();
            });
        }

        if (customColorWrap) {
            customColorWrap.addEventListener("click", function (e) {
                if (e.target !== customColorBtn && !customColorBtn.contains(e.target)) {
                    toggleHighlightPopover();
                }
            });
        }

        if (popoverCloseBtn) {
            popoverCloseBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                closeHighlightPopover();
            });
        }

        if (btnApplyCustomColor) {
            btnApplyCustomColor.addEventListener("click", function (e) {
                e.stopPropagation();
                closeHighlightPopover();
            });
        }

        document.addEventListener("click", function (e) {
            if (!highlightColorPopover || highlightColorPopover.style.display === "none") return;
            if (highlightColorPopover.contains(e.target)) return;
            if (customColorBtn && (customColorBtn === e.target || customColorBtn.contains(e.target))) return;
            if (customColorWrap && (customColorWrap === e.target || customColorWrap.contains(e.target))) return;
            closeHighlightPopover();
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && highlightColorPopover && highlightColorPopover.style.display !== "none") {
                closeHighlightPopover();
            }
        });

        function handleSvEvent(e) {
            if (!colorSvField) return;
            var rect = colorSvField.getBoundingClientRect();
            var clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
            var clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
            var x = Math.max(0, Math.min(rect.width, clientX - rect.left));
            var y = Math.max(0, Math.min(rect.height, clientY - rect.top));

            curS = Math.round((x / rect.width) * 100);
            curV = Math.round((1 - (y / rect.height)) * 100);
            renderCustomPicker(true);
        }

        if (colorSvField) {
            colorSvField.addEventListener("mousedown", function (e) {
                isDraggingSV = true;
                handleSvEvent(e);
            });
            colorSvField.addEventListener("touchstart", function (e) {
                isDraggingSV = true;
                handleSvEvent(e);
            }, { passive: true });
        }

        function handleHueEvent(e) {
            if (!colorHueBar) return;
            var rect = colorHueBar.getBoundingClientRect();
            var clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
            var x = Math.max(0, Math.min(rect.width, clientX - rect.left));
            curH = Math.round((x / rect.width) * 360);
            if (curH >= 360) curH = 0;
            renderCustomPicker(true);
        }

        if (colorHueBar) {
            colorHueBar.addEventListener("mousedown", function (e) {
                isDraggingHue = true;
                handleHueEvent(e);
            });
            colorHueBar.addEventListener("touchstart", function (e) {
                isDraggingHue = true;
                handleHueEvent(e);
            }, { passive: true });
        }

        window.addEventListener("mousemove", function (e) {
            if (isDraggingSV) {
                e.preventDefault();
                handleSvEvent(e);
            } else if (isDraggingHue) {
                e.preventDefault();
                handleHueEvent(e);
            }
        });

        window.addEventListener("touchmove", function (e) {
            if (isDraggingSV) {
                handleSvEvent(e);
            } else if (isDraggingHue) {
                handleHueEvent(e);
            }
        });

        window.addEventListener("mouseup", function () {
            isDraggingSV = false;
            isDraggingHue = false;
        });

        window.addEventListener("touchend", function () {
            isDraggingSV = false;
            isDraggingHue = false;
        });

        if (popoverHexInput) {
            popoverHexInput.addEventListener("input", function () {
                var raw = this.value.replace(/[^0-9A-Fa-f]/g, "");
                if (raw.length === 3 || raw.length === 6) {
                    var fullHex = raw.length === 3
                        ? "#" + raw[0] + raw[0] + raw[1] + raw[1] + raw[2] + raw[2]
                        : "#" + raw;
                    syncHsvFromHex(fullHex);
                    renderCustomPicker(true);
                }
            });
            popoverHexInput.addEventListener("blur", function () {
                var rgb = hsvToRgb(curH, curS, curV);
                this.value = rgbToHex(rgb.r, rgb.g, rgb.b).replace("#", "");
            });
        }

        for (var mi = 0; mi < miniSwatches.length; mi++) {
            miniSwatches[mi].addEventListener("click", function () {
                var c = this.getAttribute("data-color");
                if (c) {
                    syncHsvFromHex(c);
                    renderCustomPicker(false);
                    applyHighlightColor(c, true);
                }
            });
        }

        if (window.EyeDropper && btnColorEyedropper) {
            btnColorEyedropper.style.display = "inline-flex";
            btnColorEyedropper.addEventListener("click", function () {
                var eyeDropper = new window.EyeDropper();
                eyeDropper.open().then(function (result) {
                    if (result && result.sRGBHex) {
                        syncHsvFromHex(result.sRGBHex);
                        renderCustomPicker(false);
                        applyHighlightColor(result.sRGBHex, true);
                    }
                }).catch(function () {});
            });
        }

        var isWindowsOS = (typeof navigator !== "undefined") &&
            ((navigator.platform && navigator.platform.indexOf("Win") !== -1) ||
             (navigator.userAgent && navigator.userAgent.indexOf("Windows") !== -1));
        if (btnSystemColor && isWindowsOS) {
            btnSystemColor.style.display = "inline-flex";
            btnSystemColor.addEventListener("click", function () {
                if (colorPickerInput) {
                    colorPickerInput.click();
                }
            });
        }

        if (colorPickerInput) {
            colorPickerInput.addEventListener("input", function () {
                syncHsvFromHex(this.value);
                renderCustomPicker(false);
                applyHighlightColor(this.value, true);
            });
            colorPickerInput.addEventListener("change", function () {
                syncHsvFromHex(this.value);
                renderCustomPicker(false);
                applyHighlightColor(this.value, true);
            });
        }

        applyHighlightColor(selectedHighlightColor, false);
        syncHsvFromHex(selectedHighlightColor);
        renderCustomPicker(false);
        updateHighlightToggleState();

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
            var highlightEl = document.getElementById("captionWordHighlight");
            var highlightWords = highlightEl ? highlightEl.checked : false;
            var syncEl = document.getElementById("captionSync");
            var syncDelay = syncEl ? parseFloat(syncEl.value) : 0.12;

            setBusy(true);
            log(highlightWords ? "מתחיל ביצירת כתוביות AI עם מרקר מילים מסונכרן..." : "מתחיל ביצירת כתוביות AI מסונכרנות...", "info");
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

                        var scope = selectedCaptionScope || "entire";
                        var rangeStart = 0;
                        var rangeEnd = Number(data.duration) || 0;

                        if (scope === "inout") {
                            var inPt = (typeof data.inPoint === "number") ? data.inPoint : 0;
                            var outPt = (typeof data.outPoint === "number" && data.outPoint > 0) ? data.outPoint : rangeEnd;

                            if (outPt <= inPt) {
                                log("נקודת ה-In גדולה או שווה לנקודת ה-Out בסיקוונס. אנא סמן טווח In/Out תקין בפרמייר.", "error");
                                updateProgress(0, "");
                                setBusy(false);
                                return;
                            }

                            rangeStart = inPt;
                            rangeEnd = outPt;

                            if (data.hasCustomInOut) {
                                var rangeDur = (rangeEnd - rangeStart).toFixed(1);
                                log("מייצר כתוביות עבור טווח In/Out (" + formatTimeSec(rangeStart) + " - " + formatTimeSec(rangeEnd) + ", " + rangeDur + " שניות)...", "info");
                            } else {
                                log("לא זוהו נקודות In/Out ספציפיות בסיקוונס (מוגדר כל הסיקוונס). מייצר כתוביות לכל הטווח...", "info");
                            }
                        } else {
                            log("מתמלל כתוביות לכל הסיקוונס (" + clips.length + " קטעים)...", "info");
                        }

                        var options = {
                            syncDelay: syncDelay,
                            wordCount: wordCount,
                            includePunctuation: includePunctuation,
                            stretchGaps: stretchGaps,
                            highlightWords: highlightWords,
                            highlightColor: selectedHighlightColor || "#FACC15",
                            seqWidth: Number(data.frameWidth) || 1080,
                            seqHeight: Number(data.frameHeight) || 1920,
                            scope: scope,
                            rangeStart: rangeStart,
                            rangeEnd: rangeEnd
                        };

                        CaptionGenerator.generateCaptions(clips, apiKey, lang, options, function (pct, msg) {
                            updateProgress(pct, msg);
                        }).then(function (capResult) {
                            var destDesc = (scope === "inout") ? "לטווח In/Out" : "לכל הסיקוונס";

                            var btnEdit = document.getElementById("btnEditCaptions");
                            if (btnEdit && capResult.cues && capResult.cues.length > 0) {
                                btnEdit.style.display = "flex";
                                btnEdit.innerHTML = "<span>✏️ עריכת טקסט הכתוביות (" + capResult.cues.length + " שורות)</span>";
                            }

                            if (capResult.highlightWords && capResult.highlightManifestPath) {
                                updateProgress(95, "מניח שכבות מרקר מילים " + destDesc + " בטיים-ליין...");
                                var manifestEsc = escapeForEval(capResult.highlightManifestPath);
                                csInterface.evalScript('importHighlightedSubtitles("' + manifestEsc + '")', function (hlRes) {
                                    updateProgress(100, "הושלם!");
                                    setBusy(false);
                                    try {
                                        var hlData = JSON.parse(hlRes);
                                        if (hlData.success) {
                                            log("נוצרו " + capResult.highlightClipsCount + " הדגשות מרקר מילים (" + destDesc + ") והונחו בערוץ וידאו עליון בטיים-ליין! ניתן לערוך כל מילה בכפתור 'עריכת טקסט הכתוביות'.", "success");
                                        } else {
                                            log("שגיאה בהנחת שכבות המרקר בטיים-ליין: " + (hlData.error || hlRes), "error");
                                        }
                                    } catch (e) {
                                        log("כתוביות המרקר יובאו לפרמייר בהצלחה!", "success");
                                    }
                                });
                                return;
                            }

                            updateProgress(90, "מייבא ומניח כתוביות " + destDesc + " בטיים-ליין...");
                            var srtEsc = escapeForEval(capResult.srtPath);
                            csInterface.evalScript('importSubtitles("' + srtEsc + '", 0)', function (hostRes) {
                                updateProgress(100, "הושלם!");
                                setBusy(false);
                                try {
                                    var hData = JSON.parse(hostRes);
                                    if (hData.success) {
                                        var subMsg = "נוצרו " + capResult.blocksCount + " כתוביות (" + destDesc + ") והונחו ישירות בסיקוונס בטיים-ליין!";
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

        // Caption Text Editor (Fix typos & re-render markers without re-transcribing)
        var btnEditCaptions = document.getElementById("btnEditCaptions");
        var btnBackFromEditor = document.getElementById("btnBackFromEditor");
        var btnApplyCaptionEdits = document.getElementById("btnApplyCaptionEdits");

        try {
            if (typeof CaptionGenerator !== "undefined" && (!CaptionGenerator.lastGeneratedCues || CaptionGenerator.lastGeneratedCues.length === 0)) {
                var savedCuesRaw = localStorage.getItem("autocut_last_cues");
                var savedOptsRaw = localStorage.getItem("autocut_last_options");
                if (savedCuesRaw) {
                    var parsedCues = JSON.parse(savedCuesRaw);
                    if (Array.isArray(parsedCues) && parsedCues.length > 0) {
                        CaptionGenerator.lastGeneratedCues = parsedCues;
                        if (savedOptsRaw) {
                            try { CaptionGenerator.lastGeneratedOptions = JSON.parse(savedOptsRaw) || {}; } catch (e2) {}
                        }
                        if (btnEditCaptions) {
                            btnEditCaptions.style.display = "flex";
                            btnEditCaptions.innerHTML = "<span>✏️ עריכת טקסט הכתוביות (" + parsedCues.length + " שורות)</span>";
                        }
                    }
                }
            }
        } catch (restoreErr) {}

        function openCaptionEditor() {
            var cues = (typeof CaptionGenerator !== "undefined" && CaptionGenerator.lastGeneratedCues) ? CaptionGenerator.lastGeneratedCues : [];
            if (!cues || cues.length === 0) {
                log("אין כתוביות שמורות לעריכה. צור כתוביות תחילה.", "info");
                return;
            }

            var listEl = document.getElementById("captionEditorList");
            var countEl = document.getElementById("editorLinesCount");
            if (countEl) {
                countEl.textContent = cues.length + " שורות";
            }

            if (listEl) {
                listEl.innerHTML = "";
                for (var i = 0; i < cues.length; i++) {
                    (function (idx, cue) {
                        var row = document.createElement("div");
                        row.className = "caption-editor-row";

                        var timeBtn = document.createElement("button");
                        timeBtn.type = "button";
                        timeBtn.className = "caption-time-btn";
                        timeBtn.textContent = formatTimeSec(cue.start);
                        timeBtn.title = "קפוץ לזמן " + formatTimeSec(cue.start) + " בפרמייר";
                        timeBtn.addEventListener("click", function () {
                            csInterface.evalScript("setPlayheadPosition(" + Number(cue.start).toFixed(3) + ")");
                        });

                        var input = document.createElement("input");
                        input.type = "text";
                        input.className = "caption-text-input";
                        input.value = cue.text || "";
                        input.setAttribute("data-cue-index", String(idx));
                        input.dir = "rtl";

                        row.appendChild(timeBtn);
                        row.appendChild(input);
                        listEl.appendChild(row);
                    })(i, cues[i]);
                }
            }

            var tabViews = document.querySelectorAll(".tab-view");
            for (var k = 0; k < tabViews.length; k++) {
                if (tabViews[k].id === "view-caption-editor") {
                    tabViews[k].style.display = "block";
                    tabViews[k].classList.remove("active");
                    void tabViews[k].offsetWidth;
                    tabViews[k].classList.add("active");
                } else {
                    tabViews[k].style.display = "none";
                    tabViews[k].classList.remove("active");
                }
            }
        }

        function closeCaptionEditor() {
            var tabViews = document.querySelectorAll(".tab-view");
            for (var k = 0; k < tabViews.length; k++) {
                if (tabViews[k].id === "view-captions") {
                    tabViews[k].style.display = "block";
                    tabViews[k].classList.remove("active");
                    void tabViews[k].offsetWidth;
                    tabViews[k].classList.add("active");
                } else {
                    tabViews[k].style.display = "none";
                    tabViews[k].classList.remove("active");
                }
            }
        }

        if (btnEditCaptions) {
            btnEditCaptions.addEventListener("click", openCaptionEditor);
        }

        if (btnBackFromEditor) {
            btnBackFromEditor.addEventListener("click", closeCaptionEditor);
        }

        if (btnApplyCaptionEdits) {
            btnApplyCaptionEdits.addEventListener("click", function () {
                var cues = (typeof CaptionGenerator !== "undefined" && CaptionGenerator.lastGeneratedCues) ? CaptionGenerator.lastGeneratedCues : [];
                if (!cues || cues.length === 0) return;

                var inputs = document.querySelectorAll("#captionEditorList .caption-text-input");
                var updatedCues = [];

                for (var i = 0; i < inputs.length; i++) {
                    var idx = parseInt(inputs[i].getAttribute("data-cue-index"), 10);
                    var origCue = cues[idx];
                    if (!origCue) continue;

                    var newText = (inputs[i].value || "").trim();
                    if (!newText) continue;

                    var newWordsParts = newText.split(/\s+/).filter(Boolean);
                    var origWords = origCue.words || [];
                    var newWords = [];

                    if (newWordsParts.length === origWords.length && origWords.length > 0) {
                        for (var w = 0; w < origWords.length; w++) {
                            newWords.push({
                                word: newWordsParts[w],
                                start: origWords[w].start,
                                end: origWords[w].end
                            });
                        }
                    } else {
                        var dur = Math.max(0.15, origCue.end - origCue.start);
                        var step = dur / Math.max(1, newWordsParts.length);
                        for (var nw = 0; nw < newWordsParts.length; nw++) {
                            newWords.push({
                                word: newWordsParts[nw],
                                start: origCue.start + nw * step,
                                end: (nw === newWordsParts.length - 1) ? origCue.end : (origCue.start + (nw + 1) * step)
                            });
                        }
                    }

                    updatedCues.push({
                        start: origCue.start,
                        end: origCue.end,
                        text: newText,
                        words: newWords
                    });
                }

                if (updatedCues.length === 0) {
                    log("לא נמצאו שורות כתוביות תקינות לעדכון.", "error");
                    return;
                }

                var savedOpts = (CaptionGenerator.lastGeneratedOptions) ? CaptionGenerator.lastGeneratedOptions : {};
                var hlEl = document.getElementById("captionWordHighlight");
                savedOpts.highlightWords = hlEl ? hlEl.checked : Boolean(savedOpts.highlightWords);
                savedOpts.highlightColor = selectedHighlightColor || savedOpts.highlightColor || "#FACC15";

                setBusy(true);
                closeCaptionEditor();
                updateProgress(20, "מעדכן טקסט ומרקר בטיים-ליין...");

                CaptionGenerator.regenerateFromEditedCues(updatedCues, savedOpts, function (pct, msg) {
                    updateProgress(pct, msg);
                }).then(function (capResult) {
                    if (capResult.highlightWords && capResult.highlightManifestPath) {
                        updateProgress(92, "מחליף שכבות מרקר בטיים-ליין עם הטקסט המתוקן...");
                        var manifestEsc = escapeForEval(capResult.highlightManifestPath);
                        csInterface.evalScript('importHighlightedSubtitles("' + manifestEsc + '")', function (hlRes) {
                            updateProgress(100, "הושלם!");
                            setBusy(false);
                            try {
                                var hlData = JSON.parse(hlRes);
                                if (hlData.success) {
                                    log("הטקסט והמרקרים עודכנו בהצלחה בטיים-ליין (" + capResult.highlightClipsCount + " מילים)!", "success");
                                } else {
                                    log("שגיאה בעדכון שכבות המרקר: " + (hlData.error || hlRes), "error");
                                }
                            } catch (e) {
                                log("הכתוביות המתוקנות עודכנו בהצלחה!", "success");
                            }
                        });
                        return;
                    }

                    updateProgress(92, "מעדכן כתוביות בטיים-ליין...");
                    var srtEsc = escapeForEval(capResult.srtPath);
                    csInterface.evalScript('importSubtitles("' + srtEsc + '", 0)', function () {
                        updateProgress(100, "הושלם!");
                        setBusy(false);
                        log("הכתוביות המתוקנות עודכנו בהצלחה בטיים-ליין!", "success");
                    });
                }).catch(function (err) {
                    updateProgress(0, "");
                    setBusy(false);
                    log("שגיאה בעדכון כתוביות: " + err.message, "error");
                });
            });
        }

        // AutoUpdater In-App UI Controller
        var currentUpdateData = null;
        var updateBanner = document.getElementById("updateBanner");
        var btnRunUpdate = document.getElementById("btnRunUpdate");
        var btnDismissUpdate = document.getElementById("btnDismissUpdate");
        var footerVerText = document.getElementById("footerVersionText");
        var footerSpin = document.getElementById("footerCheckSpin");

        if (typeof AutoUpdater !== "undefined" && footerVerText) {
            footerVerText.textContent = "v" + AutoUpdater.CURRENT_VERSION;
        }

        function showUpdateBanner(updateInfo) {
            if (!updateBanner) return;
            currentUpdateData = updateInfo;
            var badge = document.getElementById("updateVersionBadge");
            var notes = document.getElementById("updateNotesPreview");
            if (badge) badge.textContent = "v" + updateInfo.latestVersion;
            if (notes) {
                var changelogSummary = (updateInfo.changelog && updateInfo.changelog.length > 0)
                    ? updateInfo.changelog[0]
                    : (updateInfo.title || "עדכון תכונות ותיקוני באגים");
                notes.textContent = changelogSummary;
            }
            updateBanner.style.display = "flex";
        }

        if (btnDismissUpdate) {
            btnDismissUpdate.addEventListener("click", function () {
                if (updateBanner) updateBanner.style.display = "none";
            });
        }

        if (btnRunUpdate) {
            btnRunUpdate.addEventListener("click", function () {
                if (!currentUpdateData || typeof AutoUpdater === "undefined") return;
                var actionsWrap = document.querySelector(".update-banner-actions");
                var progWrap = document.getElementById("updateProgressWrap");
                var progMsg = document.getElementById("updateProgressMsg");
                var progPct = document.getElementById("updateProgressPct");
                var progFill = document.getElementById("updateProgressBar");

                if (actionsWrap) actionsWrap.style.display = "none";
                if (progWrap) progWrap.style.display = "flex";

                AutoUpdater.applyUpdate(currentUpdateData, function (pct, msg) {
                    if (progMsg) progMsg.textContent = msg;
                    if (progPct) progPct.textContent = pct + "%";
                    if (progFill) progFill.style.width = pct + "%";
                }).then(function () {
                    log("התוסף עודכן בהצלחה לגרסה v" + currentUpdateData.latestVersion + "!", "success");
                }).catch(function (err) {
                    if (actionsWrap) actionsWrap.style.display = "flex";
                    if (progWrap) progWrap.style.display = "none";
                    log("שגיאה בעדכון אוטומטי: " + err.message, "error");
                });
            });
        }

        window.checkUpdateManual = function (ev) {
            if (ev) ev.preventDefault();
            if (typeof AutoUpdater === "undefined") {
                log("מערכת העדכונים אינה זמינה כרגע.", "error");
                return;
            }
            if (footerSpin) footerSpin.classList.add("spinning");
            log("בודק עדכונים מול השרת...", "info");

            AutoUpdater.checkForUpdates().then(function (res) {
                if (footerSpin) footerSpin.classList.remove("spinning");
                if (res.hasUpdate) {
                    showUpdateBanner(res);
                    log("נמצאה גרסה חדשה זמינה: v" + res.latestVersion + "! לחץ 'עדכן עכשיו' בראש הפאנל.", "success");
                } else {
                    log("התוסף מעודכן לגרסה האחרונה (v" + AutoUpdater.CURRENT_VERSION + ") ✔️", "success");
                }
            }).catch(function (err) {
                if (footerSpin) footerSpin.classList.remove("spinning");
                log("בדיקת עדכונים נכשלה: " + err.message, "error");
            });
        };

        // Quiet background check after initial startup
        setTimeout(function () {
            if (typeof AutoUpdater !== "undefined") {
                AutoUpdater.checkForUpdates().then(function (res) {
                    if (res.hasUpdate) {
                        showUpdateBanner(res);
                    }
                }).catch(function () {});
            }
        }, 2500);
    } catch (e) {
        log("שגיאה באתחול הפאנל: " + e.message, "error");
    }
}

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}

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

// -----------------------------------------------------------------------------
// Plugin Feedback & Improvement Suggestions
// -----------------------------------------------------------------------------
function openFeedbackModal(e) {
    if (e) e.preventDefault();
    var modal = document.getElementById("pluginFeedbackModal");
    if (modal) modal.style.display = "flex";
    var msgInput = document.getElementById("pluginFbMessage");
    if (msgInput) setTimeout(function () { msgInput.focus(); }, 120);
}

function closeFeedbackModal(e) {
    if (e) e.preventDefault();
    var modal = document.getElementById("pluginFeedbackModal");
    if (modal) modal.style.display = "none";
}

function handlePluginFeedbackOverlayClick(e) {
    if (e && e.target && e.target.id === "pluginFeedbackModal") {
        closeFeedbackModal(e);
    }
}

function updatePluginFbTypePill(radio) {
    var pills = document.querySelectorAll(".pfb-type-pill");
    pills.forEach(function (p) { p.classList.remove("active"); });
    if (radio && radio.parentElement) {
        radio.parentElement.classList.add("active");
    }
}

function submitPluginFeedback(e) {
    if (e) e.preventDefault();
    var msgInput = document.getElementById("pluginFbMessage");
    var contactInput = document.getElementById("pluginFbContact");
    var submitBtn = document.getElementById("btnSendPluginFb");
    var statusBox = document.getElementById("pluginFbStatus");

    var message = (msgInput ? msgInput.value : "").trim();
    var contact = (contactInput ? contactInput.value : "").trim();
    var typeRadio = document.querySelector('input[name="pluginFbType"]:checked');
    var type = typeRadio ? typeRadio.value : "improvement";

    if (!message || message.length < 3) {
        if (statusBox) {
            statusBox.className = "pfb-status error";
            statusBox.style.display = "block";
            statusBox.textContent = "נא לכתוב פידבק או תיאור של לפחות מספר מילים";
        }
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = "<span>שולח פידבק למערכת...</span>";
    }

    var payload = {
        type: type,
        message: message,
        contact: contact,
        source: "plugin",
        platform: (typeof navigator !== "undefined" && navigator.platform) ? navigator.platform : "Premiere",
        version: (typeof AutoUpdater !== "undefined" && AutoUpdater.CURRENT_VERSION) ? AutoUpdater.CURRENT_VERSION : "1.0.5"
    };

    // Cache locally
    try {
        var stored = JSON.parse(localStorage.getItem("cs_trim_feedbacks_cache") || "[]");
        stored.push(Object.assign({}, payload, { timestamp: new Date().toISOString() }));
        localStorage.setItem("cs_trim_feedbacks_cache", JSON.stringify(stored));
    } catch (err) {}

    var targetUrl = (typeof window !== "undefined" && window.location && window.location.protocol.startsWith("http"))
        ? "/api/feedback"
        : "https://cstrim.vercel.app/api/feedback";

    // Direct Google Sheets Webhook backup
    var sheetsDirectUrl = "https://script.google.com/macros/s/AKfycbxKrwUzhMHd4k9sztgsB3zn6GCW5hgNa39R1P8Dj7Vic-pmlVc2kcDuCxTqzilraTSNeQ/exec";
    try {
        fetch(sheetsDirectUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).catch(function () {});
    } catch (eSheets) {}

    fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(function (res) {
        return res.json().catch(function () { return {}; });
    })
    .then(function (data) {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = "<span>שלח פידבק למפתחים</span>";
        }
        if (statusBox) {
            statusBox.className = "pfb-status success";
            statusBox.style.display = "block";
            statusBox.innerHTML = "<strong>תודה רבה!</strong> הפידבק שלך נשמר בהצלחה ועוזר לנו לשפר את CS Trim.";
        }
        if (msgInput) msgInput.value = "";
        if (contactInput) contactInput.value = "";
        setTimeout(function () {
            closeFeedbackModal();
            if (statusBox) statusBox.style.display = "none";
        }, 2800);
    })
    .catch(function (err) {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = "<span>שלח פידבק למפתחים</span>";
        }
        if (statusBox) {
            statusBox.className = "pfb-status success";
            statusBox.style.display = "block";
            statusBox.innerHTML = "תודה רבה! הפידבק שלך נרשם בהצלחה במערכת.";
        }
        if (msgInput) msgInput.value = "";
        if (contactInput) contactInput.value = "";
        setTimeout(function () {
            closeFeedbackModal();
            if (statusBox) statusBox.style.display = "none";
        }, 2800);
    });
}

