/* Live demo: the real CS Trim panel (iframe) driving a simulated Premiere Pro window.
   Panel clicks arrive via postMessage; this script moves the timeline, captions and title animations. */
(function () {
    var root = document.getElementById('liveDemo');
    if (!root) return;
    var frame = root.querySelector('.ld-panel-frame');
    var $ = function (s) { return root.querySelector(s); };

    /* ---------- Sequence model ---------- */
    var SPEECH = [
        'היי חברים, היום נראה', 'איך חותכים שקט', 'בפרמייר, בלחיצה אחת.', 'בלי לעבוד שעות',
        'התוסף מוצא את כל השתיקות', 'ומתמלל הכול לעברית', 'עם הדגשת המילה', 'שנאמרת, בצבע שתבחרו.'
    ];
    var GAPS = [1.2, 1.6, 0.9, 1.4, 0.8, 0.5, 0.4];
    var WORD = 0.55;
    var THRESH = { normal: 1.0, high: 0.7, aggressive: 0.35 };

    var segs = [];
    SPEECH.forEach(function (t, i) {
        var w = t.split(' ');
        segs.push({ type: 's', words: w, d: w.length * WORD });
        if (i < GAPS.length) segs.push({ type: 'g', d: GAPS[i], marked: false, cut: false });
    });
    var ORIG = segs.reduce(function (a, s) { return a + s.d; }, 0);

    var S = { panel: { tab: 'view-trim', profile: 'normal', scope: 'entire', words: 3, punct: true, stretch: true, highlight: false, color: '#FACC15', preset: 'pop', track: 'V2', trans: 'in_out', dur: 0.35, blur: false }, captions: null, title: null, hasCut: false, playing: true, t: 0 };

    /* ---------- DOM refs ---------- */
    var rowCC = $('#ldRowCC'), rowA = $('#ldRowA'), rowV1 = $('#ldRowV1'), ruler = $('#ldRuler');
    var playhead = $('#ldPlayhead'), capEl = $('#ldCaption'), titleEl = $('#ldTitle'), tcEl = $('#ldTC');
    var inout = $('#ldInOut'), saved = $('#ldSaved'), hint = $('#ldHint'), playBtn = $('#ldPlay');
    var markers = $('#ldMarkers');

    var fmt = function (s) {
        var m = Math.floor(s / 60), r = Math.floor(s % 60), f = Math.floor((s % 1) * 25);
        return '00:' + String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0') + ':' + String(f).padStart(2, '0');
    };
    var pct = function (sec) { return (sec / ORIG * 100).toFixed(3) + '%'; };

    function send(cmd, o) { try { frame.contentWindow.postMessage(Object.assign({ csDemoCmd: true, cmd: cmd }, o || {}), '*'); } catch (e) {} }

    /* ---------- Layout (current timeline after cuts) ---------- */
    var layout = [], total = ORIG;
    function computeLayout() {
        layout = []; var cur = 0, orig = 0;
        segs.forEach(function (s, i) {
            var len = s.cut ? 0 : s.d;
            layout.push({ s: s, i: i, start: cur, end: cur + len, oStart: orig, oEnd: orig + s.d });
            cur += len; orig += s.d;
        });
        total = cur;
    }
    computeLayout();

    // Waveform bars (deterministic)
    function wave(seed, n) {
        var out = '', x = seed;
        for (var k = 0; k < n; k++) {
            x = (x * 9301 + 49297) % 233280;
            var h = 18 + (x / 233280) * 70 * (0.55 + 0.45 * Math.sin(k / 3.1 + seed));
            out += '<rect x="' + (k * 4) + '" y="' + ((100 - h) / 2) + '" width="2.2" height="' + h + '" rx="1"/>';
        }
        return '<svg viewBox="0 0 ' + n * 4 + ' 100" preserveAspectRatio="none" aria-hidden="true">' + out + '</svg>';
    }

    var items = [];
    function buildTimeline() {
        rowA.innerHTML = ''; rowV1.innerHTML = ''; items = [];
        segs.forEach(function (s, i) {
            var a = document.createElement('div'), v = document.createElement('div');
            if (s.type === 's') {
                a.className = 'ld-clip ld-aud'; a.innerHTML = wave(i + 3, Math.round(s.d * 9));
                v.className = 'ld-clip ld-vid'; v.innerHTML = '<span>Reel_Edit_01.mov</span>';
            } else {
                a.className = 'ld-gap'; v.className = 'ld-gap';
            }
            rowA.appendChild(a); rowV1.appendChild(v);
            items.push({ a: a, v: v });
        });
        placeItems();
    }
    function placeItems() {
        layout.forEach(function (l, i) {
            var left = pct(l.start), w = pct(l.end - l.start);
            [items[i].a, items[i].v].forEach(function (el) { el.style.left = left; el.style.width = w; });
        });
        // ruler ticks
        ruler.innerHTML = '';
        for (var t = 0; t <= ORIG; t += 5) {
            var tick = document.createElement('span');
            tick.style.left = pct(t); tick.textContent = '0:' + String(t).padStart(2, '0');
            ruler.appendChild(tick);
        }
        saved.textContent = S.hasCut ? 'קוצרו ' + (ORIG - total).toFixed(1) + ' שניות · סה״כ ' + total.toFixed(1) + 's' : 'אורך: ' + ORIG.toFixed(1) + 's';
        renderMarkers();
    }
    function renderMarkers() {
        markers.innerHTML = '';
        layout.forEach(function (l) {
            if (l.s.type === 'g' && l.s.marked && !l.s.cut) {
                var m = document.createElement('i');
                m.style.left = pct(l.start); m.style.width = pct(l.end - l.start);
                markers.appendChild(m);
            }
        });
    }

    /* ---------- Captions ---------- */
    var capClips = [];
    function buildCaptions() {
        capClips = [];
        var P = S.panel, n = P.words;
        var lo = P.scope === 'inout' ? total * 0.22 : -1, hi = P.scope === 'inout' ? total * 0.78 : 1e9;
        layout.forEach(function (l) {
            if (l.s.type !== 's' || l.s.cut) return;
            var wd = (l.end - l.start) / l.s.words.length;
            var ws = l.s.words.map(function (w, k) { return { t: w, a: l.start + k * wd, b: l.start + (k + 1) * wd }; });
            for (var k = 0; k < ws.length; k += n) {
                var grp = ws.slice(k, k + n);
                if (grp[0].a < lo || grp[grp.length - 1].b > hi) continue;
                capClips.push({ words: grp, a: grp[0].a, b: grp[grp.length - 1].b });
            }
        });
        if (P.stretch) for (var i = 0; i < capClips.length - 1; i++) capClips[i].b = capClips[i + 1].a;
        renderCapClips();
    }
    function renderCapClips() {
        rowCC.innerHTML = '';
        inout.style.display = S.panel.scope === 'inout' ? 'block' : 'none';
        inout.style.left = pct(total * 0.22); inout.style.width = pct(total * 0.56);
        (S.captions ? capClips : []).forEach(function (c, i) {
            var el = document.createElement('div');
            el.className = 'ld-clip ld-cap';
            el.style.left = pct(c.a); el.style.width = pct(c.b - c.a);
            el.style.animationDelay = (i * 35) + 'ms';
            el.innerHTML = '<span>' + c.words.map(function (w) { return strip(w.t); }).join(' ') + '</span>';
            rowCC.appendChild(el);
        });
    }
    function strip(t) { return S.panel.punct ? t : t.replace(/[,.!?]/g, ''); }

    var lastKey = '';
    function paintCaption(t) {
        var c = null;
        if (S.captions) for (var i = 0; i < capClips.length; i++) if (t >= capClips[i].a && t < capClips[i].b) { c = capClips[i]; break; }
        if (!c) { capEl.innerHTML = ''; lastKey = ''; return; }
        var key = c.a + '|' + S.panel.highlight + '|' + S.panel.color + '|' + S.panel.punct;
        if (key !== lastKey) {
            lastKey = key;
            capEl.innerHTML = c.words.map(function (w) { return '<span class="ld-w">' + strip(w.t) + '</span>'; }).join(' ');
        }
        var spans = capEl.children, on = S.panel.highlight;
        for (var k = 0; k < spans.length; k++) {
            var act = on && t >= c.words[k].a && t < c.words[k].b;
            spans[k].className = 'ld-w' + (act ? ' is-on' : '');
            spans[k].style.background = act ? S.panel.color : '';
        }
    }

    /* ---------- Title animation ---------- */
    var TITLE_A = 4.0, TITLE_B = 9.0;
    var ease = { pop: function (p) { return 1 + 2.1 * Math.pow(p - 1, 3) + 1.1 * Math.pow(p - 1, 2); }, o: function (p) { return 1 - Math.pow(1 - p, 3); } };
    function paintTitle(t) {
        var T = S.title;
        if (!T || t < T.a || t > T.b) { titleEl.style.opacity = 0; return; }
        var d = T.dur, pin = (T.trans !== 'out') ? Math.min(1, (t - T.a) / d) : 1, pout = (T.trans !== 'in') ? Math.min(1, (T.b - t) / d) : 1;
        var p = Math.min(pin, pout), e = ease.o(p), op = 1, tr = '', blur = 0;
        var q = 1 - e; // 0 = settled
        switch (T.preset) {
            case 'pop': var s = 0.5 + 0.5 * ease.pop(p); tr = 'scale(' + s.toFixed(3) + ')'; op = Math.min(1, p * 3); break;
            case 'slide_up': tr = 'translateY(' + (q * 60).toFixed(1) + 'px)'; op = e; break;
            case 'zoom_in': tr = 'scale(' + (1 + q * 0.9).toFixed(3) + ')'; op = e; break;
            default: op = e;
        }
        if (T.blur) blur = q * 10;
        titleEl.style.opacity = op;
        titleEl.style.transform = tr;
        titleEl.style.filter = blur > 0.2 ? 'blur(' + blur.toFixed(1) + 'px)' : 'none';
    }
    function renderTitleClip() {
        ['V4', 'V3', 'V2'].forEach(function (id) { var r = $('#ldRow' + id); if (r) r.innerHTML = ''; });
        var T = S.title; if (!T) return;
        var r = $('#ldRow' + T.track); if (!r) return;
        var el = document.createElement('div'); el.className = 'ld-clip ld-title';
        el.style.left = pct(T.a); el.style.width = pct(T.b - T.a);
        var dw = T.dur / (T.b - T.a) * 100, kf = '';
        if (T.trans !== 'out') kf += '<b style="left:0"></b><b style="left:' + dw + '%"></b>';
        if (T.trans !== 'in') kf += '<b style="right:0"></b><b style="right:' + dw + '%"></b>';
        el.innerHTML = '<span>הכותרת שלך</span>' + kf;
        r.appendChild(el);
    }

    /* ---------- Playback ---------- */
    var last = 0;
    function frameTick(ts) {
        if (!last) last = ts;
        var dt = (ts - last) / 1000; last = ts;
        if (S.playing && visible) { S.t += dt; if (S.t >= total) S.t = 0; }
        paint();
        requestAnimationFrame(frameTick);
    }
    function paint() {
        var t = S.t;
        playhead.style.left = pct(t);
        tcEl.textContent = fmt(t);
        paintCaption(t); paintTitle(t);
    }
    var visible = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: 0.15 }).observe(root);
    playBtn.addEventListener('click', function () { S.playing = !S.playing; playBtn.classList.toggle('is-paused', !S.playing); playBtn.setAttribute('aria-label', S.playing ? 'השהיה' : 'ניגון'); });
    var tl = $('#ldTimeline');
    function scrub(e) {
        var r = $('#ldTracks').getBoundingClientRect(), x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
        S.t = Math.max(0, Math.min(total - 0.01, x / r.width * ORIG));
        paint();
    }
    var drag = false;
    tl.addEventListener('mousedown', function (e) { drag = true; scrub(e); });
    window.addEventListener('mousemove', function (e) { if (drag) scrub(e); });
    window.addEventListener('mouseup', function () { drag = false; });
    tl.addEventListener('touchstart', scrub, { passive: true });

    /* ---------- Flows ---------- */
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    async function progress(steps) {
        for (var i = 0; i < steps.length; i++) { send('progress', { pct: steps[i][0], text: steps[i][1] }); await wait(steps[i][2] || 450); }
    }
    function silences() {
        var th = THRESH[S.panel.profile], list = segs.filter(function (s) { return s.type === 'g' && !s.cut && s.d >= th; });
        return { list: list, sum: list.reduce(function (a, s) { return a + s.d; }, 0) };
    }
    function done() { send('progress', { pct: null }); send('busy', { on: false }); }
    function setHint(txt) { hint.textContent = txt; hint.classList.toggle('is-off', !txt); }

    async function runTrim(doCut) {
        send('busy', { on: true }); send('results', { html: '' });
        await progress([[5, 'סורק קליפים בסיקוונס...', 500], [18, 'מנתח: Reel_Edit_01.mov', 500], [45, 'מנתח אודיו...', 500], [70, 'מזהה שתיקות...', 450]]);
        var r = silences();
        r.list.forEach(function (g) { g.marked = true; });
        send('results', { html: 'נמצאו <b>' + r.list.length + '</b> שתיקות לחיתוך · <b>' + r.sum.toFixed(1) + 's</b> מתוך ' + total.toFixed(1) + 's' });
        renderMarkers();
        if (!doCut) { await progress([[100, 'הושלם! סימנו את השתיקות', 300]]); await wait(900); done(); setHint('המרקרים הצהובים מסמנים מה ייחתך. עכשיו אפשר ללחוץ "חיתוך שקט".'); return; }
        await wait(700);
        await progress([[85, 'מעבד חיתוך ישיר בטיים-ליין...', 500]]);
        r.list.forEach(function (g) { g.cut = true; g.marked = false; });
        S.hasCut = true; computeLayout(); placeItems();
        if (S.captions) buildCaptions();
        S.t = Math.min(S.t, total - 0.01);
        await progress([[100, 'הושלם!', 500]]);
        await wait(700); done();
        setHint('הסיקוונס התקצר ב-' + (ORIG - total).toFixed(1) + ' שניות. עברו ללשונית "כתוביות".');
    }

    async function runCaptions() {
        send('busy', { on: true });
        await progress([[8, 'סורק קליפים...', 450], [25, 'מחלץ אודיו מהסיקוונס...', 600], [55, 'מתמלל בעברית...', 900], [78, 'מיישר מילים לדיבור...', 600], [90, 'מייבא ומניח כתוביות בטיים-ליין...', 500]]);
        S.captions = true; buildCaptions();
        await progress([[100, 'הושלם!', 500]]);
        await wait(700); done(); send('showEdit', { on: false });
        setHint('הכתוביות על הטיימליין. שנו "מילים בשורה", הדגשה וצבע, ולחצו שוב כדי לראות את ההבדל.');
    }

    async function runApply() {
        var P = S.panel;
        send('busy', { on: true });
        await progress([[30, 'מוסיף שכבת טקסט ל-' + P.track + '...', 450], [65, 'יוצר קיפריימים' + (P.blur ? ' ו-Motion Blur' : '') + '...', 600]]);
        var a = Math.min(TITLE_A, total - 2), b = Math.min(TITLE_B, total - 0.5);
        S.title = { preset: P.preset, track: P.track, trans: P.trans, dur: P.dur, blur: P.blur, a: a, b: b };
        renderTitleClip();
        await progress([[100, 'הושלם!', 350]]);
        await wait(500); done();
        send('pill', { text: 'האנימציה הוחלה על ' + P.track });
        S.t = Math.max(0, a - 0.3); S.playing = true; playBtn.classList.remove('is-paused');
        setHint('הנגינה עברה לכותרת. החליפו סגנון, מהירות או Motion Blur והחילו שוב.');
    }

    function resetAll() {
        segs.forEach(function (s) { if (s.type === 'g') { s.cut = false; s.marked = false; } });
        S.hasCut = false; S.captions = null; S.title = null; capClips = [];
        computeLayout(); placeItems(); renderCapClips(); renderTitleClip(); lastKey = '';
        send('results', { html: '' }); send('showEdit', { on: false }); send('progress', { pct: null }); send('busy', { on: false });
        S.t = 0; setHint('לחצו "חיתוך שקט" בפאנל מימין והסתכלו על הטיימליין.');
    }
    $('#ldReset').addEventListener('click', resetAll);

    /* ---------- Messages from panel ---------- */
    window.addEventListener('message', function (e) {
        var m = e.data; if (!m || !m.csDemo || e.source !== frame.contentWindow) return;
        if (m.type === 'state') {
            var prev = S.panel; S.panel = m.state;
            if (prev && S.captions && (prev.words !== S.panel.words || prev.scope !== S.panel.scope || prev.stretch !== S.panel.stretch || prev.punct !== S.panel.punct)) { buildCaptions(); }
            else if (prev && !S.captions) { /* nothing yet */ }
            if (prev && prev.tab !== S.panel.tab) {
                var tabs = { 'view-trim': 0, 'view-captions': 1, 'view-animations': 2 };
                root.querySelectorAll('.ld-chip').forEach(function (c, i) { c.classList.toggle('is-on', i === tabs[S.panel.tab]); });
            }
            return;
        }
        if (m.type === 'action') {
            S.panel = m.state;
            if (m.name === 'cut') runTrim(true);
            else if (m.name === 'mark') runTrim(false);
            else if (m.name === 'captions') runCaptions();
            else if (m.name === 'apply') runApply();
            else if (m.name === 'reset') { S.title = null; renderTitleClip(); send('pill', { text: 'האנימציות אופסו' }); }
        }
    });

    // Chips jump to the matching panel tab
    root.querySelectorAll('.ld-chip').forEach(function (c, i) {
        c.addEventListener('click', function () { send('setState', { tab: ['view-trim', 'view-captions', 'view-animations'][i] }); });
    });

    buildTimeline(); renderCapClips(); paint();
    requestAnimationFrame(frameTick);
    setHint('לחצו "חיתוך שקט" בפאנל מימין והסתכלו על הטיימליין.');
})();
