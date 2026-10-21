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

    function syncHighlight() {
        var row = $('#rowHighlightColor');
        if (row) row.style.opacity = state.highlight ? '1' : '.4';
        var pill = $('#highlightPreviewPill');
        if (pill) pill.style.background = state.highlight ? state.color : '';
        if (pill) pill.style.color = state.highlight ? '#111' : '';
    }
    $('#highlightSwatches').addEventListener('click', function () { syncHighlight(); });
    syncHighlight();

    var cc = $('#customColorBtn'); if (cc) cc.addEventListener('click', function (e) { e.preventDefault(); });
    var gk = $('#linkGetApiKey'); if (gk) gk.addEventListener('click', function (e) { e.preventDefault(); });
    var tk = $('#btnToggleKey'), ki = $('#groqApiKey');
    if (ki) ki.value = 'gsk_demo_key_not_real_0000';
    if (tk) tk.addEventListener('click', function () {
        ki.type = ki.type === 'password' ? 'text' : 'password';
        tk.textContent = ki.type === 'password' ? 'הצג' : 'הסתר';
    });

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
