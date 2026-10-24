/* Demo driver for the real CS Trim panel markup.
   Handles only UI state; reports it to the parent page (the fake Premiere window)
   and shows progress / results that the parent sends back. */
(function () {
    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

    var state = {
        tab: 'view-trim', profile: 'normal',
        scope: 'entire', words: 3, punct: true, stretch: true, highlight: false, color: '#FACC15',
        preset: 'pop', track: 'V2', trans: 'in_out', dur: 0.35, blur: false
    };
    var busy = false;

    function send(msg) { try { parent.postMessage(Object.assign({ csDemo: true }, msg), '*'); } catch (e) {} }
    function emit() { send({ type: 'state', state: state }); }

    function group(sel, attr, key, cast) {
        $$(sel + ' button').forEach(function (b) {
            b.addEventListener('click', function () {
                $$(sel + ' button').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                var v = b.getAttribute(attr);
                state[key] = cast ? cast(v) : v;
                emit();
            });
        });
    }

    // Tabs
    $$('.tab-btn').forEach(function (b) {
        b.addEventListener('click', function () {
            if (busy) return;
            $$('.tab-btn').forEach(function (x) { x.classList.remove('active'); });
            b.classList.add('active');
            var id = b.getAttribute('data-tab');
            $$('.tab-view').forEach(function (v) {
                var on = v.id === id;
                v.classList.toggle('active', on);
                v.style.display = on ? 'block' : 'none';
            });
            state.tab = id;
            emit();
        });
    });

    group('#profiles', 'data-profile', 'profile');
    group('#captionScopeSelector', 'data-scope', 'scope');
    group('#highlightSwatches', 'data-color', 'color');
    group('.anim-track-selector', 'data-track', 'track');
    group('.anim-scope-selector', 'data-scope', 'trans');
    group('.anim-speed-selector', 'data-dur', 'dur', parseFloat);

    // Scope button label like the real panel
    $$('#captionScopeSelector button').forEach(function (b) {
        b.addEventListener('click', function () {
            $('#btnCaptions').textContent = b.getAttribute('data-scope') === 'inout'
                ? 'יצירת כתוביות בין In ל-Out' : 'יצירת כתוביות לכל הסיקוונס';
        });
    });

    // Anim presets
    $$('#animPresetsGrid .anim-preview-card').forEach(function (c) {
        c.addEventListener('click', function () {
            $$('#animPresetsGrid .anim-preview-card').forEach(function (x) { x.classList.remove('active'); });
            c.classList.add('active');
            state.preset = c.getAttribute('data-preset');
            emit();
        });
    });

    // Slider
    var slider = $('#captionWordCount'), badge = $('#captionWordCountVal');
    function paintSlider() {
        var v = +slider.value;
        badge.textContent = v === 1 ? 'מילה אחת' : v + ' מילים';
        var pct = (v - 1) / 7 * 100;
        slider.style.setProperty('--fill', pct + '%');
        state.words = v;
    }
    slider.addEventListener('input', function () { paintSlider(); emit(); });
    paintSlider();

    // Toggles
    function toggle(id, key) { $(id).addEventListener('change', function (e) { state[key] = e.target.checked; syncHighlight(); emit(); }); }
    toggle('#captionPunctuation', 'punct');
    toggle('#captionStretchGaps', 'stretch');
    toggle('#captionWordHighlight', 'highlight');
    toggle('#animMotionBlur', 'blur');

    var typeReveal = $('#captionTypeReveal'), safeMode = $('#captionSafeMode');
    function syncHighlight() {
        var pill = $('#highlightPreviewPill');
        if (pill) pill.style.background = state.highlight ? state.color : '';
        if (pill) pill.style.color = state.highlight ? '#111' : '';
        var row = $('#rowHighlightColor');
        if (row) row.style.display = (state.highlight || typeReveal.checked) ? '' : 'none';
        var chip = $('#markerChip');
        if (chip) chip.textContent = state.highlight ? 'מרקר' : (typeReveal.checked ? 'הקלדה' : '');
        $('#foldStyle').style.display = (state.highlight || typeReveal.checked || safeMode.checked) ? '' : 'none';
        renderSafe();
    }
    $('#highlightSwatches').addEventListener('click', function () { syncHighlight(); });
    typeReveal.addEventListener('change', syncHighlight);
    safeMode.addEventListener('change', syncHighlight);

    // Safe zones (same numbers as the real panel)
    var PLATS = {
        instagram: { name: 'אינסטגרם', top: .14, bottom: .35, left: .06, right: .06 },
        tiktok: { name: 'טיקטוק', top: .13, bottom: .27, left: .06, right: .15 },
        shorts: { name: 'יוטיוב שורטס', top: .12, bottom: .25, left: .06, right: .14 }
    };
    var plat = 'instagram', cap = { y: 59, x: 50 };
    function renderSafe() {
        var SZ = PLATS[plat], box = $('#safeZoneBox'), halfH = .053;
        var minY = Math.ceil((SZ.top + halfH) * 100), maxY = Math.floor((1 - SZ.bottom - halfH) * 100);
        var minX = Math.ceil(SZ.left * 100) + 15, maxX = Math.floor((1 - SZ.right) * 100) - 15;
        $('.sz-top', box).style.height = SZ.top * 100 + '%';
        $('.sz-bottom', box).style.height = SZ.bottom * 100 + '%';
        [['l', SZ.left], ['r', SZ.right]].forEach(function (k) {
            var el = $('.sz-side-' + k[0], box);
            el.style.top = SZ.top * 100 + '%'; el.style.bottom = SZ.bottom * 100 + '%'; el.style.width = k[1] * 100 + '%';
        });
        $$('#szPlatforms .sz-plat').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-plat') === plat); });
        var graphics = state.highlight || typeReveal.checked || safeMode.checked;
        var cp = $('#szCap'), status = $('#szStatus'), hint = $('#szHint'), chip = $('#szChip');
        function set(msg, unsafe) {
            box.classList.toggle('is-unsafe', unsafe); status.textContent = msg;
            chip.textContent = unsafe ? 'לא בטוח' : 'בטוח'; chip.classList.toggle('is-unsafe', unsafe);
        }
        if (!graphics) {
            cp.style.top = '92%'; cp.style.left = '50%';
            set('כתוביות Premiere רגילות: בתחתית, באזור שהאפליקציה מכסה', true);
            hint.textContent = 'כדי להזיז אותן, הפעל את המתג למעלה.';
            return;
        }
        if (safeMode.checked) {
            cap.y = Math.max(minY, Math.min(maxY, cap.y)); cap.x = Math.max(minX, Math.min(maxX, cap.x));
        }
        cp.style.top = cap.y + '%'; cp.style.left = cap.x + '%';
        var unsafe = cap.y < minY || cap.y > maxY;
        if (safeMode.checked) {
            set('בטוח', false);
            hint.textContent = 'הכתוביות נשארות באזור הבטוח. גרור את הפס הלבן כדי להזיז.';
        } else {
            set(unsafe ? 'חלק מהכתובית מכוסה על ידי ' + SZ.name : 'בטוח', unsafe);
            hint.textContent = 'מיקום חופשי. האזורים האדומים מכוסים על ידי ' + SZ.name + '.';
        }
    }
    $$('#szPlatforms .sz-plat').forEach(function (b) {
        b.addEventListener('click', function () { plat = b.getAttribute('data-plat'); renderSafe(); });
    });
    var phone = $('#szPhone'), dragging = false;
    function drag(ev) {
        if (!dragging || !(state.highlight || typeReveal.checked || safeMode.checked)) return;
        var r = phone.getBoundingClientRect();
        cap.y = Math.max(8, Math.min(94, Math.round((ev.clientY - r.top) / r.height * 100)));
        cap.x = Math.max(10, Math.min(90, Math.round((ev.clientX - r.left) / r.width * 100)));
        renderSafe();
    }
    phone.addEventListener('pointerdown', function (ev) { dragging = true; try { phone.setPointerCapture(ev.pointerId); } catch (e) {} drag(ev); });
    phone.addEventListener('pointermove', drag);
    phone.addEventListener('pointerup', function () { dragging = false; });
    phone.addEventListener('pointercancel', function () { dragging = false; });
    var guide = $('#btnSzGuide');
    guide.addEventListener('click', function () {
        var on = guide.getAttribute('data-on') !== '1';
        guide.setAttribute('data-on', on ? '1' : '0');
        guide.textContent = on ? 'הסתר קווי עזר בטיימליין' : 'הצג קווי עזר בטיימליין';
    });

    // Font picker + size
    var fonts = ['Heebo עבה', 'Heebo בינוני', 'Arial', 'Tahoma', 'Segoe UI', 'Gisha'];
    var fpop = $('#markerFontPop'), flist = $('#markerFontList'), flabel = $('#markerFontBtnLabel');
    fonts.forEach(function (f) {
        var d = document.createElement('div'); d.className = 'font-picker-item'; d.textContent = f;
        d.addEventListener('click', function () { flabel.textContent = f; fpop.style.display = 'none'; });
        flist.appendChild(d);
    });
    $('#markerFontBtn').addEventListener('click', function () { fpop.style.display = fpop.style.display === 'none' ? 'block' : 'none'; });
    var msz = $('#markerSize');
    msz.addEventListener('input', function () { $('#markerSizeVal').textContent = msz.value + '%'; });

    syncHighlight();

    var cc = $('#customColorBtn'); if (cc) cc.addEventListener('click', function (e) { e.preventDefault(); });

    // Actions → parent
    function act(id, name) {
        var el = $(id); if (!el) return;
        el.addEventListener('click', function () { if (!busy) send({ type: 'action', name: name, state: state }); });
    }
    act('#btnAutoCut', 'cut');
    act('#btnSilenceMarkers', 'mark');
    act('#btnCaptions', 'captions');
    act('#btnEditCaptions', 'edit');
    act('#btnApplyAnimation', 'apply');
    act('#btnResetAnimation', 'reset');

    // Parent → panel
    var prog = $('#progressArea'), bar = $('#progressBar'), pst = $('#progressStatus'), ppc = $('#progressPercent');
    var pillTimer;
    window.addEventListener('message', function (e) {
        var m = e.data; if (!m || !m.csDemoCmd) return;
        if (m.cmd === 'busy') {
            busy = !!m.on;
            $$('.btn').forEach(function (b) { b.disabled = busy; b.style.opacity = busy ? '.55' : ''; });
        } else if (m.cmd === 'progress') {
            prog.style.display = m.pct == null ? 'none' : 'block';
            if (m.pct != null) { bar.style.width = m.pct + '%'; ppc.textContent = Math.round(m.pct) + '%'; pst.textContent = m.text || ''; }
        } else if (m.cmd === 'results') {
            var c = $('#resultsCard'); c.style.display = m.html ? 'block' : 'none'; $('#resultsText').innerHTML = m.html || '';
        } else if (m.cmd === 'pill') {
            var p = $('#animSuccessPill'); p.textContent = m.text; p.style.display = 'block';
            p.className = 'anim-success-pill fade-in';
            clearTimeout(pillTimer);
            pillTimer = setTimeout(function () { p.className = 'anim-success-pill fade-out'; }, 2200);
        } else if (m.cmd === 'showEdit') {
            $('#btnEditCaptions').style.display = m.on ? '' : 'none';
        } else if (m.cmd === 'setState') {
            if (m.tab) { var t = $('.tab-btn[data-tab="' + m.tab + '"]'); if (t) t.click(); }
        }
    });

    // Auto-size: tell parent nothing; panel scrolls inside its frame.
    emit();
})();
