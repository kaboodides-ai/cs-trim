/**
 * CS Trim - Text Animator (Clean & Simple)
 * Applies native Premiere Pro keyframe motion (Pop, Slide Up, Zoom In, Smooth Fade)
 * directly to selected text, captions, and graphic layers.
 */

var TextAnimator = {
    state: {
        preset: "pop",
        track: "V2",
        scope: "in_out",
        duration: 0.35,
        motionBlur: true
    },

    PRESET_NAMES: {
        pop: "פופ (Bounce)",
        slide_up: "החלקה למעלה",
        zoom_in: "זום פנימה",
        fade: "עמעום חלק",
        type: "הקלדה (מילה אחרי מילה)"
    },

    escapeForEval: function (str) {
        return (str || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');
    },

    ensureHostLoaded: function (callback) {
        if (typeof csInterface === "undefined") {
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
    },

    init: function () {
        var self = this;

        // Restore saved preferences
        try {
            var savedPreset = localStorage.getItem("cstrim_anim_preset");
            if (savedPreset && self.PRESET_NAMES[savedPreset]) self.state.preset = savedPreset;
            var savedTrack = localStorage.getItem("cstrim_anim_track");
            if (savedTrack && /^(V1|V2|V3|V4)$/i.test(savedTrack)) self.state.track = savedTrack.toUpperCase();
            var savedScope = localStorage.getItem("cstrim_anim_scope");
            if (savedScope) self.state.scope = savedScope;
            var savedDur = localStorage.getItem("cstrim_anim_duration");
            if (savedDur) self.state.duration = parseFloat(savedDur) || 0.35;
            var savedBlur = localStorage.getItem("cstrim_anim_motion_blur");
            if (savedBlur !== null) self.state.motionBlur = (savedBlur === "true");
        } catch (e) {}

        self.bindElements();
        self.applyStateToUI();
    },

    bindElements: function () {
        var self = this;

        // 1. Preset Buttons (2x2 Grid)
        var presetBtns = document.querySelectorAll(".anim-preview-card, .anim-simple-btn");
        for (var i = 0; i < presetBtns.length; i++) {
            (function (btn) {
                btn.addEventListener("click", function () {
                    var presetId = this.getAttribute("data-preset");
                    if (!presetId) return;
                    self.setPreset(presetId);
                });
            })(presetBtns[i]);
        }

        // 2. Track Selector (V1, V2, V3, V4)
        var trackBtns = document.querySelectorAll(".anim-track-btn");
        for (var t = 0; t < trackBtns.length; t++) {
            (function (btn) {
                btn.addEventListener("click", function () {
                    var tr = this.getAttribute("data-track");
                    if (!tr) return;
                    self.setTrack(tr);
                });
            })(trackBtns[t]);
        }

        // 3. Scope Selector (In & Out / In / Out)
        var scopeBtns = document.querySelectorAll(".anim-scope-btn");
        for (var s = 0; s < scopeBtns.length; s++) {
            (function (btn) {
                btn.addEventListener("click", function () {
                    var sc = this.getAttribute("data-scope");
                    if (!sc) return;
                    self.setScope(sc);
                });
            })(scopeBtns[s]);
        }

        // 4. Speed Selector (Fast / Normal / Smooth)
        var speedBtns = document.querySelectorAll(".anim-speed-btn");
        for (var sp = 0; sp < speedBtns.length; sp++) {
            (function (btn) {
                btn.addEventListener("click", function () {
                    var dur = parseFloat(this.getAttribute("data-dur")) || 0.35;
                    self.setDuration(dur);
                });
            })(speedBtns[sp]);
        }

        // 5. Motion Blur Checkbox
        var chkBlur = document.getElementById("animMotionBlur");
        if (chkBlur) {
            chkBlur.addEventListener("change", function () {
                self.setMotionBlur(this.checked);
            });
        }

        // 6. Apply Animation Button
        var btnApply = document.getElementById("btnApplyAnimation");
        if (btnApply) {
            btnApply.addEventListener("click", function () {
                self.applyAnimation();
            });
        }

        // 7. Reset Animation Button
        var btnReset = document.getElementById("btnResetAnimation");
        if (btnReset) {
            btnReset.addEventListener("click", function () {
                self.resetAnimation();
            });
        }
    },

    setMotionBlur: function (enabled) {
        var self = this;
        self.state.motionBlur = !!enabled;
        try { localStorage.setItem("cstrim_anim_motion_blur", String(self.state.motionBlur)); } catch (e) {}

        var chk = document.getElementById("animMotionBlur");
        if (chk) chk.checked = self.state.motionBlur;

        var animView = document.getElementById("view-animations");
        if (animView) {
            if (self.state.motionBlur) {
                animView.classList.add("with-motion-blur");
            } else {
                animView.classList.remove("with-motion-blur");
            }
        }
    },

    setTrack: function (trackName) {
        var self = this;
        var cleanTrack = (trackName || "V2").toUpperCase();
        self.state.track = cleanTrack;
        try { localStorage.setItem("cstrim_anim_track", cleanTrack); } catch (e) {}

        var btns = document.querySelectorAll(".anim-track-btn");
        for (var i = 0; i < btns.length; i++) {
            if ((btns[i].getAttribute("data-track") || "").toUpperCase() === cleanTrack) {
                btns[i].classList.add("active");
            } else {
                btns[i].classList.remove("active");
            }
        }
    },

    setPreset: function (presetId) {
        var self = this;
        self.state.preset = presetId;
        try { localStorage.setItem("cstrim_anim_preset", presetId); } catch (e) {}

        var btns = document.querySelectorAll(".anim-preview-card, .anim-simple-btn");
        for (var i = 0; i < btns.length; i++) {
            if (btns[i].getAttribute("data-preset") === presetId) {
                btns[i].classList.add("active");
            } else {
                btns[i].classList.remove("active");
            }
        }
    },

    setScope: function (scopeKey) {
        var self = this;
        self.state.scope = scopeKey;
        try { localStorage.setItem("cstrim_anim_scope", scopeKey); } catch (e) {}

        var btns = document.querySelectorAll(".anim-scope-btn");
        for (var i = 0; i < btns.length; i++) {
            if (btns[i].getAttribute("data-scope") === scopeKey) {
                btns[i].classList.add("active");
            } else {
                btns[i].classList.remove("active");
            }
        }
    },

    setDuration: function (dur) {
        var self = this;
        self.state.duration = dur;
        try { localStorage.setItem("cstrim_anim_duration", String(dur)); } catch (e) {}

        var btns = document.querySelectorAll(".anim-speed-btn");
        for (var i = 0; i < btns.length; i++) {
            var d = parseFloat(btns[i].getAttribute("data-dur"));
            if (Math.abs(d - dur) < 0.05) {
                btns[i].classList.add("active");
            } else {
                btns[i].classList.remove("active");
            }
        }

        var grid = document.getElementById("animPresetsGrid");
        if (grid) {
            var cycle = dur <= 0.25 ? "1.9s" : (dur >= 0.5 ? "3.2s" : "2.6s");
            grid.style.setProperty("--anim-cycle-duration", cycle);
        }
    },

    applyStateToUI: function () {
        var self = this;
        self.setPreset(self.state.preset);
        self.setTrack(self.state.track);
        self.setScope(self.state.scope);
        self.setDuration(self.state.duration);
        self.setMotionBlur(self.state.motionBlur);
    },

    // Compatibility no-ops for main.js tab switches
    refreshSelectionCount: function () {},
    triggerPreviewAnimation: function () {},

    applyAnimation: function () {
        var self = this;
        // Typing is exact only when the captions are re-rendered from the transcript, not keyframed
        if (self.state.preset === "type") {
            if (typeof window.CSTrimApplyTypeReveal === "function") window.CSTrimApplyTypeReveal(true);
            return;
        }
        if (typeof csInterface === "undefined") {
            alert("CSInterface אינו זמין (פועל מחוץ לפרמייר)");
            return;
        }

        var btn = document.getElementById("btnApplyAnimation");
        if (btn) {
            btn.disabled = true;
            btn.textContent = "מחיל אנימציה...";
        }

        if (typeof log === "function") {
            var presetLabel = self.PRESET_NAMES[self.state.preset] || self.state.preset;
            var blurSuffix = self.state.motionBlur ? " (עם טשטוש תנועה)" : "";
            log("מחיל אנימציית " + presetLabel + blurSuffix + " על שכבה " + self.state.track + "...", "info");
        }

        self.ensureHostLoaded(function () {
            var params = {
                preset: self.state.preset,
                targetTrack: self.state.track || "V2",
                scope: self.state.scope,
                duration: self.state.duration,
                motionBlur: !!self.state.motionBlur,
                intensity: "standard",
                autoSelectTopTrack: true // Fallback to top track if nothing explicitly highlighted
            };

            var jsonStr = JSON.stringify(params);
            var escapedJson = self.escapeForEval(jsonStr);
            var scriptCall = "applyTextAnimation('" + escapedJson + "')";

            csInterface.evalScript(scriptCall, function (res) {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = "החל אנימציה";
                }

                try {
                    var raw = res;
                    if (typeof raw === "string") {
                        try { raw = decodeURIComponent(raw); } catch (eDec) {}
                    }
                    var data = (typeof raw === "string") ? JSON.parse(raw) : raw;

                    if (data && data.success) {
                        var count = data.count || 0;
                        var msg = "האנימציה הוחלה בהצלחה על " + count + " שכבות ב-" + self.state.track + "!";
                        if (typeof log === "function") log(msg, "ok");
                        self.showBannerSuccess(msg);
                    } else {
                        var errMsg = (data && data.message) ? data.message : ((data && data.error) ? data.error : ("שגיאה בפרמייר: " + res));
                        if (typeof log === "function") log("שגיאה בהחלת אנימציה: " + errMsg, "error");
                        alert(errMsg);
                    }
                } catch (err) {
                    if (typeof log === "function") log("שגיאה: " + err.message + " (תשובה: " + res + ")", "error");
                }
            });
        });
    },

    resetAnimation: function () {
        var self = this;
        if (typeof csInterface === "undefined") return;

        var btn = document.getElementById("btnResetAnimation");
        if (btn) {
            btn.disabled = true;
            btn.textContent = "מאפס...";
        }

        if (typeof log === "function") log("מאפס אנימציות משכבה " + self.state.track + "...", "info");

        self.ensureHostLoaded(function () {
            var params = {
                targetTrack: self.state.track || "V2"
            };
            var jsonStr = JSON.stringify(params);
            var escapedJson = self.escapeForEval(jsonStr);
            var scriptCall = "resetTextAnimation('" + escapedJson + "')";

            csInterface.evalScript(scriptCall, function (res) {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = "איפוס אנימציות";
                }

                try {
                    var raw = res;
                    if (typeof raw === "string") {
                        try { raw = decodeURIComponent(raw); } catch (eDec) {}
                    }
                    var data = (typeof raw === "string") ? JSON.parse(raw) : raw;

                    if (data && data.success) {
                        var count = data.count || 0;
                        var msg = "האנימציות אופסו בהצלחה מ-" + count + " שכבות!";
                        if (typeof log === "function") log(msg, "ok");
                        self.showBannerSuccess(msg);
                    } else {
                        var errMsg = (data && data.message) ? data.message : "לא נמצאו שכבות לאיפוס";
                        if (typeof log === "function") log("איפוס: " + errMsg, "warn");
                    }
                } catch (err) {
                    console.error("resetAnimation error:", err);
                }
            });
        });
    },

    showBannerSuccess: function (msg) {
        var badge = document.getElementById("animSuccessPill");
        if (!badge) return;
        badge.textContent = msg;
        badge.style.display = "flex";
        badge.classList.remove("fade-out");
        void badge.offsetWidth;
        badge.classList.add("fade-in");

        setTimeout(function () {
            badge.classList.remove("fade-in");
            badge.classList.add("fade-out");
            setTimeout(function () {
                badge.style.display = "none";
            }, 350);
        }, 3000);
    }
};

// Initialize on DOM ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
        TextAnimator.init();
    });
} else {
    TextAnimator.init();
}
