// Interactive layer for the landing page: scroll progress, hero glow and tilt,
// card spotlights, magnetic buttons, live demos, FAQ motion and download confetti.
(function () {
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    // Scroll progress bar
    var bar = $("#fxProgress");
    if (bar) {
        var ticking = false;
        var update = function () {
            var max = document.documentElement.scrollHeight - window.innerHeight;
            bar.style.transform = "scaleX(" + (max > 0 ? Math.min(window.scrollY / max, 1) : 0) + ")";
            ticking = false;
        };
        window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
        update();
    }

    // Highlight the nav link of the section in view
    var navLinks = $$('.nav-links a[href^="#"]');
    if (navLinks.length && "IntersectionObserver" in window) {
        var byId = {};
        navLinks.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
        var spy = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                navLinks.forEach(function (a) { a.classList.remove("is-active"); });
                var link = byId[entry.target.id];
                if (link) link.classList.add("is-active");
            });
        }, { rootMargin: "-45% 0px -50% 0px" });
        Object.keys(byId).forEach(function (id) { var el = document.getElementById(id); if (el) spy.observe(el); });
    }

    if (finePointer && !reduceMotion) {
        // Hero grid follows the cursor; the window tilts toward it
        var hero = $(".h-hero"), heroBg = $(".fx-hero-bg"), win = $(".h-window");
        if (hero && heroBg) {
            hero.addEventListener("pointermove", function (e) {
                var r = hero.getBoundingClientRect();
                heroBg.style.setProperty("--mx", (e.clientX - r.left) + "px");
                heroBg.style.setProperty("--my", (e.clientY - r.top) + "px");
            });
        }
        if (win) {
            var wrap = win.parentElement;
            wrap.addEventListener("pointermove", function (e) {
                var r = wrap.getBoundingClientRect();
                var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
                win.classList.add("is-tilting");
                win.style.setProperty("--ry", (x * 10).toFixed(2) + "deg");
                win.style.setProperty("--rx", (-y * 8).toFixed(2) + "deg");
            });
            wrap.addEventListener("pointerleave", function () {
                win.classList.remove("is-tilting");
                win.style.setProperty("--ry", "0deg");
                win.style.setProperty("--rx", "0deg");
            });
        }

        // Spotlight that follows the cursor across cards
        document.addEventListener("pointermove", function (e) {
            var card = e.target.closest && e.target.closest(".h-card, .download-card, .suggest-card");
            if (!card) return;
            var r = card.getBoundingClientRect();
            card.style.setProperty("--mx", (e.clientX - r.left) + "px");
            card.style.setProperty("--my", (e.clientY - r.top) + "px");
        });

        // Large buttons lean toward the cursor
        $$(".btn-lg").forEach(function (btn) {
            btn.addEventListener("pointermove", function (e) {
                var r = btn.getBoundingClientRect();
                btn.style.setProperty("--tx", ((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1) + "px");
                btn.style.setProperty("--ty", ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + "px");
            });
            btn.addEventListener("pointerleave", function () {
                btn.style.setProperty("--tx", "0px");
                btn.style.setProperty("--ty", "0px");
            });
        });
    }

    // Live caption demo: pick how many words go in each caption
    var screen = $(".h-screen"), pills = $("#fxWordPills");
    if (screen && pills) {
        var words = ["איך", "חותכים", "שקט", "בפרמייר", "בלחיצה", "אחת", "בלי", "לייצא"];
        var perChunk = 2, wordIndex = 0, chunkEl = null, timer = null;
        screen.classList.add("is-live");
        screen.innerHTML = "";

        var render = function () {
            var start = Math.floor(wordIndex / perChunk) * perChunk;
            if (!chunkEl || wordIndex === start) {
                chunkEl = document.createElement("div");
                chunkEl.className = "h-chunk";
                words.slice(start, start + perChunk).forEach(function (w) {
                    var span = document.createElement("span");
                    span.className = "h-w6";
                    span.textContent = w;
                    chunkEl.appendChild(span);
                });
                screen.innerHTML = "";
                screen.appendChild(chunkEl);
                if (!reduceMotion) chunkEl.classList.add("is-entering");
            }
            $$(".h-w6", chunkEl).forEach(function (span, i) { span.classList.toggle("is-said", start + i === wordIndex); });
        };
        var step = function () { wordIndex = (wordIndex + 1) % words.length; render(); };
        var start = function () { clearInterval(timer); timer = setInterval(step, 520); };

        pills.addEventListener("click", function (e) {
            var btn = e.target.closest("button[data-n]");
            if (!btn) return;
            $$("button", pills).forEach(function (b) { b.classList.toggle("is-on", b === btn); });
            perChunk = parseInt(btn.dataset.n, 10);
            screen.classList.toggle("is-long", perChunk > 4);
            wordIndex = 0; chunkEl = null;
            render(); start();
        });
        render(); start();
    }

    // Text-animation playground: type a word, click a style to replay it
    var fxInput = $("#fxWordInput"), fxCards = $$(".h-fx");
    var replay = function (card) {
        var word = $(".h-fx-word", card);
        word.style.animation = "none";
        void word.offsetWidth;
        word.style.animation = "";
    };
    if (fxInput) {
        fxInput.addEventListener("input", function () {
            var text = fxInput.value.trim() || "כותרת";
            fxCards.forEach(function (card) { $(".h-fx-word", card).textContent = text; replay(card); });
        });
    }
    fxCards.forEach(function (card) {
        card.addEventListener("click", function () { replay(card); });
        card.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); replay(card); }
        });
    });

    // Smooth open/close for FAQ answers
    if (!reduceMotion && Element.prototype.animate) {
        $$(".h-faq details").forEach(function (details) {
            var summary = $("summary", details), body = $("p", details);
            summary.addEventListener("click", function (e) {
                e.preventDefault();
                if (details.dataset.busy) return;
                details.dataset.busy = "1";
                var done = function () { delete details.dataset.busy; };
                if (details.open) {
                    var anim = body.animate([{ height: body.offsetHeight + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 220, easing: "ease-in" });
                    body.style.overflow = "hidden";
                    anim.onfinish = function () { details.open = false; body.style.overflow = ""; done(); };
                } else {
                    details.open = true;
                    body.style.overflow = "hidden";
                    var h = body.offsetHeight;
                    body.animate([{ height: "0px", opacity: 0 }, { height: h + "px", opacity: 1 }], { duration: 280, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" })
                        .onfinish = function () { body.style.overflow = ""; done(); };
                }
            });
        });
    }

    // Confetti burst when the download success view appears
    var success = document.getElementById("leadSuccessView");
    if (success && !reduceMotion && "MutationObserver" in window) {
        var wasShown = false;
        new MutationObserver(function () {
            var shown = success.style.display !== "none";
            if (shown && !wasShown) confetti();
            wasShown = shown;
        }).observe(success, { attributes: true, attributeFilter: ["style"] });
    }

    function confetti() {
        var canvas = document.createElement("canvas");
        canvas.className = "fx-confetti";
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
        document.body.appendChild(canvas);
        var ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);
        var colors = ["#2f7cf6", "#facc15", "#3ecf8e", "#8db8ff", "#ffffff"];
        var parts = [];
        for (var i = 0; i < 140; i++) {
            var angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, speed = 7 + Math.random() * 9;
            parts.push({
                x: innerWidth / 2, y: innerHeight * 0.55,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                w: 5 + Math.random() * 5, h: 8 + Math.random() * 6,
                r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
                c: colors[i % colors.length]
            });
        }
        var t0 = performance.now();
        (function frame(now) {
            var t = now - t0;
            ctx.clearRect(0, 0, innerWidth, innerHeight);
            ctx.globalAlpha = Math.max(0, 1 - t / 2200);
            parts.forEach(function (p) {
                p.vy += 0.28; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
                ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
                ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
                ctx.restore();
            });
            if (t < 2200) requestAnimationFrame(frame); else canvas.remove();
        })(t0);
    }
})();
