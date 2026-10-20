// scene.js v3: CS Trim promo. Black, soft coloured light, the real plugin panel (panel.js) at the centre, cards that
// turn into other cards in 3D, thin Apple style type with glow, liquid glass buttons. 20 s, sound design only.
//   0-3.7     hook: a waveform with flat silences; "מתעצבנים על שתיקות בעריכה?" blurs in letter by letter
//   2.9-3.7   the waveform contracts into the pulse line of the logo; 3.7 the bubble closes around it, "CS TRIM"
//   4.55      the bubble opens into the panel (silence tab); "גבוה", "חיתוך שקט"
//   5.95-8.4  the button opens into a timeline, the silences close, "חסכת 12 דקות", it folds into a glass check, back
//   8.55      the panel flips like a card to the captions tab: marker on, orange swatch, "יצירת כתוביות"
//   9.7-13.5  the button opens into a Premiere style window: caption clips drop onto V2, the playhead plays them,
//             the program monitor shows each caption with the marker on the spoken word
//   13.85     flip to the animations tab: each clicked tile lifts into a glass preview card, "בלחיצה אחת" in that style
//   16.4-20   the panel folds back into the logo; "CS TRIM", glass chips Mac / Windows, glass button "להורדה בחינם"
// World px: 0,0 is the frame centre. The panel is built at its real CSS size (310 px wide) and scaled by K.
(() => {
  'use strict';
  const { PNW, PANEL_HTML, SWATCHES, STYLES, BUBBLE, PULSE, PULSE_D } = window.PANEL;
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;
  const mixc = (a, b, k) => { const A = hex(a), B = hex(b); k = clamp(k, 0, 1); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; };
  const mixa = (a, b, k) => { k = clamp(k, 0, 1); return `rgba(${[0, 1, 2].map(i => Math.round(lerp(a[i], b[i], k))).join(',')},${f2(lerp(a[3], b[3], k))})`; };
  const css = (el, o) => Object.assign(el.style, o);
  const px = v => f2(v) + 'px';
  const place = (el, x, y, w, h) => css(el, { left: px(x), top: px(y), width: px(w), height: px(h) });
  const ramp = (t, t0, d = 0.08) => clamp((t - t0) / d, 0, 1);
  const bump = (t, t0, hold = 0.06, a = 34, b = 13) => S(t - t0, a, 1) - S(t - t0 - hold, b, 1);
  const kick = (t, t0, a = 14, b = 7, d = 0.16) => S(t - t0, a, 1) - S(t - t0 - d, b, 1);
  // thin Apple style type: Heebo Light, tight tracking; key words a little heavier. Glow by colour.
  const HL = { font: F.HEEBO, weight: 300, ls: -0.02 };
  const GLOW = {
    w: '0 0 22px rgba(255,255,255,0.40), 0 0 64px rgba(150,130,255,0.30)',
    o: `0 0 22px ${rgba(C.WARM, 0.8)}, 0 0 70px ${rgba(C.WARM, 0.45)}`,
    b: `0 0 22px ${rgba(C.BLUE, 0.8)}, 0 0 70px ${rgba(C.BLUE, 0.45)}`,
  };
  const K = 2.2;
  const TL_W = 920, TL_H = 440, PR_W = 860;
  const VIDX = 20, VIDY = 50, VIDW = PR_W - 40, VIDH = Math.round((PR_W - 40) * 9 / 16), CBY = VIDY + VIDH + 6, TLY = CBY + 58, PR_H = TLY + 320;
  const RGB = h => [...hex(h), 1];

  const T = {
    t1: 0.3, t2: 0.75, tOut: 2.7, wave: 2.9, logo: 3.7, wm: 3.95, wmOut: 4.4, open: 4.55,
    sens: 5.45, cut: 5.9, gaps: 6.45, count: [6.55, 7.2], chk: 7.6, back: 8.1,
    tab1: 8.55, toggle: 9.0, swatch: 9.3, create: 9.65, gen: 9.95, play: 10.8, words: [10.8, 11.23, 11.66, 12.1, 12.75], close2: 13.5,
    tab2: 13.85, tiles: [14.2, 14.75, 15.3, 15.85], fold: 16.4, logo2: 16.85, wm2: 17.05, chips: 17.3, cta: 17.6, site: 17.8,
  };
  // the panel flips like a card on each tab change; the new tab's face shows once it passes edge on
  const FLIP_WN = 11, FLIP_D = 0.05;
  const flipCross = (() => { let a = 0, b = 1; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (S(m, FLIP_WN, 1) < 0.5) a = m; else b = m; } return a; })();
  const TC1 = T.tab1 + FLIP_D + flipCross, TC2 = T.tab2 + FLIP_D + flipCross;
  const flipRy = t => [T.tab1, T.tab2].reduce((r, c) => { const a = 180 * S(t - c - FLIP_D, FLIP_WN, 1); return r + (a <= 90 ? a : a - 180); }, 0);
  const flipK = t => [T.tab1, T.tab2].reduce((r, c) => r + Math.sin(Math.PI * S(t - c - FLIP_D, FLIP_WN, 1)), 0);

  // ---------- text: every letter comes in from a blur, in reading order ----------
  // words: [[string, color, dir, weight]] laid out right to left like row(); o.ltr for a Latin line (first word on the left)
  // like row(), but each word is measured with its own weight
  function rowW(parent, words, o) {
    const ws = words.map(w => measure(w[0], Object.assign({}, o, { weight: w[3] || o.weight, dir: w[2] || o.dir })).w);
    const gap = o.gap ?? (o.size || 120) * 0.28;
    let xr = (o.x || 0) + (ws.reduce((a, b) => a + b, 0) + gap * (words.length - 1)) / 2;
    return words.map((w, k) => { const cx = xr - ws[k] / 2; xr -= ws[k] + gap; return { g: txt(parent, w[0], Object.assign({}, o, { x: cx, align: 'c', weight: w[3] || o.weight })), w: ws[k], cx }; });
  }
  function blurWords(parent, words, o) {
    const r = rowW(parent, o.ltr ? words.slice().reverse() : words, o);
    if (o.ltr) r.reverse();
    const spans = [];
    r.forEach((w, k) => {
      const [s, col, dir, wt] = words[k], c = col || o.color || C.WHITE;
      w.g.inner.textContent = '';
      css(w.g.inner, { direction: dir || 'rtl', fontWeight: wt || o.weight, textShadow: c === C.WARM ? GLOW.o : c === C.BLUE ? GLOW.b : GLOW.w });
      [...s].forEach(ch => {
        const sp_ = document.createElement('span'); sp_.textContent = ch;
        css(sp_, { display: 'inline-block', whiteSpace: 'pre', color: c });
        w.g.inner.appendChild(sp_); spans.push(sp_);
      });
    });
    return { groups: r.map(w => w.g), spans, size: o.size, words: r };
  }
  function blurIO(b, t, t0, t1 = 1e9, st = 0.028) {
    const n = b.spans.length, live = t >= t0 - 0.01 && t < t1 + 0.25 + n * 0.014;
    b.groups.forEach(g => on(g, live));
    if (!live) return;
    b.spans.forEach((s, j) => {
      const a = t0 + j * st, k = S(t - a, 18, 1), ko = ramp(t, t1 + j * 0.014, 0.16);
      tf(s, { o: ramp(t, a, 0.14) * (1 - ko), blur: 14 * (1 - k) + 12 * ko, y: b.size * (0.16 * (1 - k) - 0.08 * ko) });
    });
  }
  const blurEl = (el, t, t0, t1 = 1e9, extra = {}) => {
    const k = S(t - t0, 16, 1), ko = ramp(t, t1, 0.16);
    return tf(el, Object.assign({ o: ramp(t, t0, 0.16) * (1 - ko), blur: 14 * (1 - k) + 12 * ko, y: 26 * (1 - k) - 14 * ko }, extra));
  };

  // ---------- liquid glass: frosted, bright rim, a specular highlight that follows the tilt ----------
  const GLASS_BG = 'linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0.06) 48%, rgba(255,255,255,0.11))';
  const GLASS_RIM = 'inset 0 1.5px 1px rgba(255,255,255,0.65), inset 0 -1.5px 1px rgba(255,255,255,0.2), inset 0 0 26px rgba(255,255,255,0.10)';
  function lglass(parent, w, h, r, x = 0, y = 0) {
    const g = grp(parent, x, y);
    const sh = box(g, 0, 24, w * 0.92, h, { borderRadius: px(r), background: 'rgba(0,0,0,0.55)', filter: 'blur(26px)' });
    const el = box(g, 0, 0, w, h, { borderRadius: px(r), boxSizing: 'border-box', overflow: 'hidden', background: GLASS_BG,
      border: '1px solid rgba(255,255,255,0.28)', backdropFilter: 'blur(22px) saturate(180%) brightness(1.08)', boxShadow: GLASS_RIM });
    const hi = div(el, { left: '0', top: '0', width: '100%', height: '100%' });
    return { g, el, hi, sh, w, h, r };
  }
  const glassHi = (G, ang) => { G.hi.style.background = `radial-gradient(70% 90% at ${f2(30 + ang)}% -10%, rgba(255,255,255,0.40), rgba(255,255,255,0) 60%), linear-gradient(${f2(105 + ang)}deg, rgba(255,255,255,0) 38%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0) 62%)`; };

  // ---------- the logo (img/logo-mark.svg) ----------
  const pulseY = x => { for (let i = 1; i < PULSE.length; i++) if (x <= PULSE[i][0]) { const [a, b] = [PULSE[i - 1], PULSE[i]]; return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])); } return 236; };
  function makeLogo(parent, cy, LS, gid) {
    const g = grp(parent, 0, cy);
    const glow = svgEl('svg', g, { viewBox: '0 0 512 512', width: LS, height: LS });
    glow.style.cssText = `position:absolute;left:${-LS / 2}px;top:${-LS / 2}px;overflow:visible`;
    svgEl('path', glow, { d: BUBBLE, fill: C.BLUE });
    const s = svgEl('svg', g, { viewBox: '0 0 512 512', width: LS, height: LS });
    s.style.cssText = `position:absolute;left:${-LS / 2}px;top:${-LS / 2}px;overflow:visible`;
    const lg = svgEl('linearGradient', svgEl('defs', s), { id: gid, x1: 0, y1: 0, x2: 1, y2: 1 });
    svgEl('stop', lg, { offset: 0, 'stop-color': C.LOGO1 }); svgEl('stop', lg, { offset: 1, 'stop-color': C.LOGO2 });
    const bub = svgEl('g', s);
    svgEl('path', bub, { d: BUBBLE, fill: `url(#${gid})` });
    const pulse = svgEl('path', s, { d: PULSE_D, fill: 'none', stroke: '#fff', 'stroke-width': 24, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const bar = svgEl('path', s, { d: 'M298 288H350', stroke: '#fff', 'stroke-opacity': 0.55, 'stroke-width': 24, 'stroke-linecap': 'round' });
    const sc = LS / 512;
    return { g, glow, bub, pulse, bar, len: pulse.getTotalLength(), sc, cy, body: [0, cy + (236 - 256) * sc, 344 * sc, 240 * sc, 100 * sc] };
  }
  const bubScale = (lg, s) => lg.bub.setAttribute('transform', `translate(256 236) scale(${f2(s)}) translate(-256 -236)`);

  scene('main', 0, DUR, { bg: C.INK }, (root) => {
    // ================= background light (parallax 0.35) =================
    const bg = grp(root, W / 2, H / 2);
    const fog = (col, a, size) => box(bg, 0, 0, size, size, { borderRadius: '50%', background: `radial-gradient(closest-side, ${rgba(col, a)}, ${rgba(col, a * 0.38)} 45%, ${rgba(col, 0)} 100%)` });
    const fA = fog(C.VIOLET, 0.42, 1500), fB = fog(C.BLUE, 0.34, 1300), fC = fog(C.LOGO2, 0.3, 1100);
    const L1Y = -150, L2Y = -380;
    const fAp = track([-300, -620], [[3.0, [-140, L1Y - 60]], [T.open, [260, -560]], [T.tab1, [-280, -520]], [T.tab2, [280, -520]], [T.fold, [-200, L2Y]]], 4, 1);
    const fBp = track([320, 420], [[3.0, [120, L1Y + 80]], [T.open, [-300, 420]], [T.tab1, [300, 380]], [T.tab2, [-260, 460]], [T.fold, [160, 260]]], 4, 1);
    const fCp = track([0, 900], [[3.4, [0, L1Y]], [T.open, [0, 200]], [T.fold, [0, L2Y]]], 4, 1);
    const fogK = track(0.55, [[3.2, 1, 3, 1], [T.open, 0.8, 4, 1], [T.fold, 1, 3, 1]]);

    // ================= camera =================
    const cam = grp(root, W / 2, H / 2);
    const camZ = track(1, [[0, 1.05, 1.4, 1], [2.85, 0.99, 5, 1], [T.logo, 1.05, 1.8, 1], [T.open, 1.0, 5, 1], [T.fold, 1.0, 6, 1], [T.logo2, 1.04, 1.2, 1]]);
    const drift = t => [18 * vnoise(t * 0.16 + 0.3, 4), 14 * vnoise(t * 0.13 + 0.7, 9), 0.3 * vnoise(t * 0.1 + 0.2, 13)];
    sfx(0, 'amb', 1);

    // ================= 1. hook =================
    const tS = Math.min(132, fit('שתיקות בעריכה?', Object.assign({}, HL, { weight: 500 }), 820));
    const TT1 = blurWords(cam, [['מתעצבנים'], ['על']], Object.assign({}, HL, { size: tS, y: -230, gap: tS * 0.26 }));
    const TT2 = blurWords(cam, [['שתיקות', C.WARM, 'rtl', 500], ['בעריכה?']], Object.assign({}, HL, { size: tS, y: -230 + tS * 1.16, gap: tS * 0.26 }));
    const WV = { x0: -450, x1: 450, y: 260, A: 92, N: 240 };
    const GAPF = [[0.17, 0.27], [0.41, 0.48], [0.62, 0.71], [0.83, 0.9]];
    const gapIn = u => GAPF.reduce((e, [a, b]) => e * (1 - E.smooth((u - a) / 0.016) * E.smooth((b - u) / 0.016)), 1);
    const waveY = (u, t) => {
      const env = Math.pow(Math.sin(Math.PI * u), 0.4) * (0.45 + 0.55 * Math.abs(Math.sin(u * 21 + 1.3))) * gapIn(u);
      return WV.A * env * (0.7 * Math.sin(u * 96 + t * 9) + 0.3 * Math.sin(u * 213 - t * 13));
    };
    const L1 = makeLogo(cam, L1Y, 440, 'lgA');
    const pW = u => { const x = lerp(PULSE[0][0], PULSE[PULSE.length - 1][0], u); return [(x - 256) * L1.sc, L1Y + (pulseY(x) - 256) * L1.sc]; };
    const gapGlows = GAPF.map(([a, b]) => rect(cam, lerp(WV.x0, WV.x1, a), WV.y - 5, (b - a) * (WV.x1 - WV.x0), 10, { borderRadius: '5px', background: C.WARM }));
    const waveS = svgBox(cam, 0, 0, 10, 10);
    waveS.style.filter = `drop-shadow(0 0 10px ${rgba(C.WHITE, 0.55)})`;
    const wave = svgEl('path', waveS, { fill: 'none', stroke: C.WHITE, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const drawK = t => E.o3(seg(t, -0.3, 0.75));
    sfx(0.02, 'data', 0.3); sfx(T.t1, 'glass', 0.45); sfx(T.t2, 'glass', 0.4); sfx(T.tOut, 'swish', 0.3); sfx(2.95, 'rise', 0.4);

    // ================= 2. logo lockup =================
    const burst = box(cam, 0, L1.body[1], 300, 300, { borderRadius: '50%', border: `2px solid ${rgba(C.LOGO1, 0.8)}`, boxSizing: 'border-box' });
    const WM1 = blurWords(cam, [['CS', C.WHITE, 'ltr'], ['TRIM', C.BLUE, 'ltr']], { font: F.HEEBO, weight: 700, ls: 0.01, size: 112, y: L1Y + 255, gap: 28, ltr: true });
    sfx(T.logo, 'land', 0.9); sfx(T.logo, 'shimmer', 0.6); sfx(T.wm, 'blip', 0.5);

    // ================= 3. the panel =================
    const pnEl = div(null, {}, 'pn');
    pnEl.innerHTML = PANEL_HTML;
    const q = s => pnEl.querySelector(s), qa = s => [...pnEl.querySelectorAll(s)];
    const mPersp = grp(cam, 0, 0); mPersp.style.perspective = '2400px';
    const mTilt = grp(mPersp, 0, 0);
    const mR = div(mTilt, { overflow: 'hidden', boxSizing: 'border-box' });
    const mPulse = svgEl('svg', mR, { viewBox: '84 116 344 240', width: '100%', height: '100%' });
    mPulse.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
    svgEl('path', mPulse, { d: PULSE_D, fill: 'none', stroke: '#fff', 'stroke-width': 24, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const pShadow = div(cam, { borderRadius: '30px', background: 'rgba(0,0,0,0.6)' });
    const pPersp = grp(cam, 0, 0); pPersp.style.perspective = '2400px';
    const pTilt = grp(pPersp, 0, 0), pScale = grp(pTilt, 0, 0);
    pScale.appendChild(pnEl);
    css(pnEl, { left: px(-PNW / 2), top: '0px', height: '600px' });
    const hd = q('.hd'), ctx = q('.ctx'), tabs = q('.tabs'), views = q('.views'), ft = q('.ft');
    const V = qa('.view'), TABS = qa('.tab'), tabbar = q('.tabbar');
    const VPARTS = V.map(v => [...v.children].filter(c => !c.classList.contains('bglow')));
    const loc = el => { let x = 0, y = 0; while (el && el !== pnEl) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; } return [x, y]; };
    const rectOf = el => { const [x, y] = loc(el); return { x, y, w: el.offsetWidth, h: el.offsetHeight }; };
    const topH = loc(views)[1], VH = V.map(v => v.offsetHeight), PH = VH.map(h => topH + h + 14 + 40);
    const PTOP0 = -Math.round(K * PH[0] / 2) - 30, PTOP1 = -500;
    const PTOP = track(PTOP0, [[TC1, PTOP1, 40, 1]]);
    const PHt = track(PH[0], [[TC1, PH[1], 40, 1], [TC2, PH[2], 40, 1]]);
    const world = (el, ptop, fx = 0.5, fy = 0.5) => { const r = rectOf(el); return [K * (r.x + r.w * fx - PNW / 2), ptop + K * (r.y + r.h * fy)]; };
    const wrect = (el, ptop, rr = 7) => { const r = rectOf(el); return [K * (r.x + r.w / 2 - PNW / 2), ptop + K * (r.y + r.h / 2), K * r.w, K * r.h, rr * K]; };
    const panelRect = (i, ptop) => [0, ptop + K * PH[i] / 2, K * PNW, K * PH[i], 12 * K];
    report('panel heights', PH.map(h => Math.round(h * K)).join(' / '));
    // sensitivity knob
    const sens = qa('.sens > span'), sensKnob = q('.sens .knob');
    const sensR = sens.map(s => rectOf(s)), sensP = rectOf(q('.sens'));
    const knobX = track(sensR[0].x - sensP.x - 1, [[T.sens, sensR[1].x - sensP.x - 1, 22, 0.85]]);
    css(sensKnob, { width: px(sensR[0].w) });
    const smK = q('.seg.sm .knob'), smS = qa('.seg.sm > span');
    const smR = rectOf(smS[0]), smP = rectOf(q('.seg.sm'));
    css(smK, { left: px(smR.x - smP.x - 1), width: px(smR.w) }); smS[0].style.color = C.PN_TX; smS[0].style.fontWeight = 600;
    // tab indicator (moves while the face is edge on)
    const tabR = TABS.map(el => rectOf(el)), tabsP = rectOf(tabs);
    const barEdges = i => [tabR[i].x - tabsP.x + tabR[i].w * 0.18, tabR[i].x - tabsP.x + tabR[i].w * 0.82];
    const barL = track(barEdges(0)[0], [[TC1, barEdges(1)[0], 60, 1], [TC2, barEdges(2)[0], 60, 1]]);
    const barR = track(barEdges(0)[1], [[TC1, barEdges(1)[1], 60, 1], [TC2, barEdges(2)[1], 60, 1]]);
    const BTN = V.map(v => v.querySelector('.bp')), GLOW_BTN = V.map(v => v.querySelector('.bglow'));
    const mk = q('.sw.mk'), mkKnob = q('.sw.mk > i'), pill = q('.pill'), rowc = q('.rowc'), sws = qa('.swc'), ring = q('.ring');
    const swR = sws.map(s => rectOf(s)), swP = rectOf(q('.sws'));
    const ringX = track(swR[0].x - swP.x, [[T.swatch, swR[4].x - swP.x, 20, 0.85]]);
    const tiles = qa('.tile'), smps = qa('.smp'), nms = qa('.nm'), vps = qa('.vp');
    const P_SENS = world(sens[1], PTOP0), P_CUT = world(BTN[0], PTOP0, 0.62, 0.6);
    const P_TAB1 = world(TABS[1], PTOP0), P_TOG = world(mk, PTOP1), P_SW = world(sws[4], PTOP1), P_CREATE = world(BTN[1], PTOP1, 0.62, 0.6);
    const P_TAB2 = world(TABS[2], PTOP1), P_TILES = tiles.map(el => world(el, PTOP1, 0.62, 0.42));
    const BTN0R = wrect(BTN[0], PTOP0), BTN1R = wrect(BTN[1], PTOP1), TILER = tiles.map(el => wrect(el, PTOP1, 10));
    const RC = track(0, [[T.cut + 0.05, 1, 9, 1], [T.back, 0, 10, 1], [T.create + 0.05, 1, 9, 1], [T.close2, 0, 10, 1]]);
    sfx(T.open, 'flip', 0.7); sfx(T.open + 0.35, 'land', 0.5);
    sfx(T.sens, 'slide', 0.8); sfx(T.sens, 'click', 0.4);
    sfx(T.cut, 'click', 0.9); sfx(T.cut, 'glass', 0.4);
    [T.tab1, T.tab2].forEach(c => { sfx(c, 'click', 0.6); sfx(c + FLIP_D, 'flip', 0.8); });
    sfx(T.toggle, 'lock', 0.9); sfx(T.swatch, 'glass', 0.8); sfx(T.create, 'click', 0.9);

    // ================= 4. the front card: button -> timeline -> glass check -> button -> Premiere -> button =================
    const TLR = [0, 40, TL_W, TL_H, 26], CHK = [0, 40, 230, 230, 115], PRR = [0, 60, PR_W, PR_H, 26];
    const fPersp = grp(cam, 0, 0); fPersp.style.perspective = '2200px';
    const fTilt = grp(fPersp, 0, 0);
    const fShadow = div(fTilt, { background: 'rgba(0,0,0,0.6)' });
    const fR = div(fTilt, { overflow: 'hidden', boxSizing: 'border-box', backdropFilter: 'blur(22px) saturate(180%)' });
    const fHi = div(fR, { left: '0', top: '0', width: '100%', height: '100%' });
    const center = (w, h) => ({ left: '50%', top: '50%', width: px(w), height: px(h), marginLeft: px(-w / 2), marginTop: px(-h / 2) });
    const tlC = div(fR, center(TL_W, TL_H)), prC = div(fR, center(PR_W, PR_H));
    const chkS = svgEl('svg', fR, { viewBox: '0 0 120 120', width: 120, height: 120 });
    chkS.style.cssText = `position:absolute;left:50%;top:50%;margin:-60px 0 0 -60px;overflow:visible;filter:drop-shadow(0 0 14px ${rgba(C.OK, 0.9)})`;
    const chk = svgEl('path', chkS, { d: 'M30 62L52 84L92 40', fill: 'none', stroke: C.OK, 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const chkL = chk.getTotalLength(); chk.setAttribute('stroke-dasharray', `${chkL} ${chkL}`);
    const fT = track(BTN0R, [[T.cut + 0.05, TLR, 11, 0.9], [T.chk, CHK, 12, 0.8], [T.back, BTN0R, 13, 0.95],
      [T.create - 0.2, BTN1R, 400, 1], [T.create + 0.05, PRR, 11, 0.9], [T.close2, BTN1R, 13, 0.95]]);
    sfx(T.cut + 0.05, 'whoosh', 0.5); sfx(T.chk, 'confirm', 0.8); sfx(T.chk + 0.1, 'shimmer', 0.5); sfx(T.back, 'swish', 0.4); sfx(T.back + 0.3, 'land', 0.4);
    // --- timeline (card-local px) ---
    const MONO = { font: F.MONO, weight: 500, color: C.PN_TX2, dir: 'ltr' };
    const tlRows = [0, 1, 2, 3].map(() => grp(tlC, 0, 0));
    [36, 58, 80].forEach(x => box(tlRows[0], x, 40, 13, 13, { borderRadius: '50%', background: 'rgba(255,255,255,0.16)' }));
    txt(tlRows[0], 'ראיון פרק 3', { font: F.HEEBO, weight: 500, size: 26, color: C.PN_TX, x: TL_W - 36, y: 41, align: 'r' });
    txt(tlRows[0], 'משך', { font: F.HEEBO, weight: 400, size: 24, color: C.PN_TX3, x: 520, y: 41 });
    const durV = txt(tlRows[0], '48:12', Object.assign({}, MONO, { x: 452, y: 41, size: 24, color: C.WHITE }));
    rect(tlRows[0], 0, 80, TL_W, 1, { background: 'rgba(255,255,255,0.07)' });
    const CX0 = 104, CW = 790;
    for (let k = 0; k <= 35; k++) rect(tlRows[1], CX0 + 22 * k, k % 5 ? 108 : 100, 1.5, k % 5 ? 8 : 16, { background: 'rgba(255,255,255,0.2)' });
    [0, 8, 16, 24, 32, 40].forEach(m => txt(tlRows[1], `${String(m).padStart(2, '0')}:00`, Object.assign({}, MONO, { x: CX0 + CW * m / 48.2 + 6, y: 97, size: 14, align: 'l', css: { opacity: 0.75 } })));
    [['V1', 170], ['A1', 312]].forEach(([s, y]) => {
      box(tlRows[1], 52, y, 54, 40, { borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', boxSizing: 'border-box' });
      txt(tlRows[1], s, Object.assign({}, MONO, { x: 52, y: y + 1, size: 17 }));
    });
    const SEG = [['s', 125], ['g', 68], ['s', 92], ['g', 54], ['s', 145], ['g', 78], ['s', 72], ['g', 58], ['s', 98]];
    const vFill = `repeating-linear-gradient(90deg, rgba(255,255,255,0) 0 52px, rgba(255,255,255,0.09) 52px 54px), linear-gradient(180deg, ${rgba(C.VIOLET, 0.66)}, ${rgba(C.VIOLET, 0.42)})`;
    const bars = (parent, w0, hh, seed, col) => {
      const sv = svgBox(parent, 0, 0, w0, hh), n = Math.floor((w0 - 6) / 6);
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, env = Math.pow(Math.sin(Math.PI * u), 0.55) * (0.62 + 0.38 * Math.abs(Math.sin(i * 0.83 + seed * 1.7)));
        const h = 4 + (hh - 44) * env * (0.4 + 0.6 * hash(i * 7.3 + seed * 31));
        svgEl('rect', sv, { x: 4 + 6 * i, y: hh / 2 - h / 2, width: 3, height: h, rx: 1.5, fill: col });
      }
    };
    let x0 = CX0, gi = 0;
    const segs = SEG.map(([kind, w0], k) => {
      const ends = k === 0 ? '10px 0 0 10px' : k === SEG.length - 1 ? '0 10px 10px 0' : '0';
      const s = { kind, w0, x0 };
      s.v = rect(tlRows[2], x0, 124, w0, 92, { background: vFill, backgroundPosition: `${-(x0 - CX0)}px 0`, borderRadius: ends, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)' });
      s.a = rect(tlRows[3], x0, 232, w0, 160, { background: rgba(C.ACC, 0.14), borderRadius: ends, boxShadow: `inset 0 1px 0 ${rgba(C.ACC, 0.4)}`, overflow: 'hidden' });
      if (kind === 's') {
        bars(s.a, w0, 160, k, C.ACC_T);
        if (k > 0) {
          s.seam = rect(tlRows[3], x0 - 1, 124, 2, 268, { background: C.INK });
          s.flash = rect(tlRows[3], x0 - 1.5, 116, 3, 284, { background: C.WHITE, boxShadow: `0 0 14px ${rgba(C.WHITE, 0.8)}` });
        }
      } else {
        s.tc = T.gaps + 0.07 * gi++;
        s.line = rect(s.a, 0, 79, w0, 2, { background: rgba(C.WARM, 0.75) });
        s.ov = rect(tlRows[3], x0, 118, w0, 280, { borderRadius: '10px', boxSizing: 'border-box', border: `1.5px solid ${rgba(C.WARM, 0.85)}`, background: rgba(C.WARM, 0.16), boxShadow: `0 0 24px ${rgba(C.WARM, 0.35)}` });
        sfx(s.tc + 0.05, 'tick', 0.45);
      }
      x0 += w0;
      return s;
    });
    txt(tlRows[2], 'ראיון', { font: F.HEEBO, weight: 500, size: 19, color: C.WHITE, x: CX0 + 12, y: 142, align: 'l', css: { opacity: 0.85 } });
    segs.forEach((s, k) => { if (s.seam) s.tc = segs[k - 1].tc; });
    const GAPS = segs.filter(s => s.kind === 'g'), GSUM = GAPS.reduce((a, s) => a + s.w0, 0);
    const closed = t => GAPS.reduce((a, s) => a + s.w0 * S(t - s.tc, 16, 1), 0) / GSUM;
    sfx(GAPS[GAPS.length - 1].tc + 0.3, 'land', 0.6);
    // "חסכת 12 דקות"
    const SV1 = blurWords(cam, [['חסכת']], Object.assign({}, HL, { size: 100, y: -560 }));
    const s2 = 184, o2 = Object.assign({}, HL, { size: s2 });
    const wN = measure('12', Object.assign({}, o2, { weight: 500 })).w, wD = measure('דקות', o2).w, tot2 = wN + s2 * 0.24 + wD;
    const numG = txt(cam, '0', Object.assign({}, o2, { weight: 500, x: tot2 / 2 - wN / 2, y: -392, color: C.WARM, css: { textShadow: GLOW.o } }));
    const SV2 = blurWords(cam, [['דקות']], Object.assign({}, o2, { x: -tot2 / 2 + wD / 2, y: -392 }));
    for (let k = 1; k <= 12; k++) sfx(T.count[0] + (T.count[1] - T.count[0]) * (1 - Math.cbrt(1 - (k - 0.5) / 12)), 'count', 0.28);
    sfx(T.count[1], 'blip', 0.6);

    // --- Premiere style window (card-local px; world = local - [490, 430] + [0, 0]) ---
    const PRX = l => l - PR_W / 2, PRY = l => PRR[1] - PR_H / 2 + l;
    const PRBG = '#1E1E1E', PRH = '#262626', PRL = '#2E2E2E';
    const prRows = [0, 1, 2, 3].map(() => grp(prC, 0, 0));
    rect(prRows[0], 0, 0, PR_W, 44, { background: PRH });
    [26, 46, 66].forEach(x => box(prRows[0], x, 22, 12, 12, { borderRadius: '50%', background: 'rgba(255,255,255,0.16)' }));
    txt(prRows[0], 'ראיון פרק 3', { font: F.HEEBO, weight: 500, size: 20, color: C.PN_TX2, x: PR_W - 24, y: 23, align: 'r' });
    rect(prRows[0], 0, 44, PR_W, CBY - 44, { background: '#0C0C0C' });
    const vid = rect(prRows[0], VIDX, VIDY, VIDW, VIDH, { overflow: 'hidden', borderRadius: '4px', background: `linear-gradient(160deg, ${mixc(C.INK, C.VIOLET, 0.32)}, ${mixc(C.INK, C.LOGO2, 0.24)} 60%, ${C.INK})` });
    const blob = (col, a, size, x, y) => box(vid, x, y, size, size, { borderRadius: '50%', background: `radial-gradient(closest-side, ${rgba(col, a)}, ${rgba(col, 0)})` });
    const vb1 = blob(C.VIOLET, 0.75, 760, VIDW * 0.3, VIDH * 0.35), vb2 = blob(C.BLUE, 0.55, 700, VIDW * 0.75, VIDH * 0.7);
    const orbG = grp(vid, VIDW / 2, VIDH * 0.4);
    const orbRings = T.words.map(() => box(orbG, 0, 0, 180, 180, { borderRadius: '50%', border: `2px solid ${rgba(C.WHITE, 0.5)}`, boxSizing: 'border-box' }));
    const orb = box(orbG, 0, 0, 180, 180, { borderRadius: '50%', background: `radial-gradient(circle at 40% 35%, ${rgba(C.WHITE, 0.55)}, ${rgba(C.VIOLET, 0.55)} 45%, ${rgba(C.BLUE, 0.15)} 75%, ${rgba(C.BLUE, 0)})`, boxShadow: `0 0 70px ${rgba(C.VIOLET, 0.55)}` });
    rect(vid, 0, VIDH * 0.55, VIDW, VIDH * 0.45, { background: `linear-gradient(180deg, ${rgba(C.INK, 0)}, ${rgba(C.INK, 0.55)})` });
    // monitor controls
    rect(prRows[1], 0, CBY, PR_W, 52, { background: PRH });
    const tcMon = txt(prRows[1], '00:00:03:00', Object.assign({}, MONO, { x: 24, y: CBY + 26, size: 18, align: 'l', color: C.ACC_T }));
    const ctl = svgBox(prRows[1], PR_W / 2 - 60, CBY + 12, 120, 28);
    svgEl('path', ctl, { d: 'M14 4V24M34 14L18 4V24Z', fill: C.PN_TX2, stroke: C.PN_TX2, 'stroke-width': 2, 'stroke-linejoin': 'round' });
    svgEl('path', ctl, { d: 'M52 3L72 14L52 25Z', fill: C.WHITE });
    svgEl('path', ctl, { d: 'M106 4V24M86 14L102 4V24Z', fill: C.PN_TX2, stroke: C.PN_TX2, 'stroke-width': 2, 'stroke-linejoin': 'round', transform: 'translate(192 0) scale(-1 1)' });
    // timeline panel
    rect(prRows[2], 0, TLY - 6, PR_W, PR_H - TLY + 6, { background: PRBG });
    rect(prRows[2], 0, TLY - 6, PR_W, 1, { background: PRL });
    const PX0 = 110, PXW = PR_W - 130, PPS = PXW / 8;   // 8 s of sequence across the content area
    for (let k = 0; k <= 40; k++) rect(prRows[2], PX0 + PXW * k / 40, k % 5 ? TLY + 22 : TLY + 14, 1.5, k % 5 ? 8 : 16, { background: 'rgba(255,255,255,0.2)' });
    for (let k = 0; k < 8; k++) txt(prRows[2], `00:0${k}`, Object.assign({}, MONO, { x: PX0 + PPS * k + 6, y: TLY + 11, size: 13, align: 'l', css: { opacity: 0.75 } }));
    const TRK = { V2: [TLY + 48, 62], V1: [TLY + 118, 62], A1: [TLY + 188, 110] };
    Object.entries(TRK).forEach(([n, [y, h]]) => {
      rect(prRows[2], 0, y, PR_W, h, { background: n === 'V2' ? '#222029' : '#202020' });
      rect(prRows[2], 0, y + h + 4, PR_W, 1, { background: PRL });
      box(prRows[2], 50, y + h / 2, 52, 34, { borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', boxSizing: 'border-box' });
      txt(prRows[2], n, Object.assign({}, MONO, { x: 50, y: y + h / 2 + 1, size: 15 }));
    });
    rect(prRows[2], PX0, TRK.V1[0] + 3, PXW, TRK.V1[1] - 6, { background: vFill, borderRadius: '6px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)' });
    txt(prRows[2], 'ראיון', { font: F.HEEBO, weight: 500, size: 16, color: C.WHITE, x: PX0 + 10, y: TRK.V1[0] + 16, align: 'l', css: { opacity: 0.85 } });
    const aClip = rect(prRows[2], PX0, TRK.A1[0] + 3, PXW, TRK.A1[1] - 6, { background: rgba(C.ACC, 0.14), borderRadius: '6px', boxShadow: `inset 0 1px 0 ${rgba(C.ACC, 0.4)}`, overflow: 'hidden' });
    bars(aClip, PXW, TRK.A1[1] - 6, 3, C.ACC_T);
    // caption clips on V2: 3 words each, as the panel setting says
    const CLIPS = ['כל מילה נדלקת', 'בדיוק בזמן', 'עם מרקר כתום', 'בעברית מלאה', 'בלי עבודה ידנית', 'תוך כמה שניות'];
    const CLW = PPS * 1.3, CLX = k => PX0 + 8 + k * CLW;
    const capClips = CLIPS.map((s, k) => {
      const g = grp(prRows[3], CLX(k) + CLW / 2, TRK.V2[0] + TRK.V2[1] / 2);
      box(g, 0, 0, CLW - 5, TRK.V2[1] - 8, { borderRadius: '6px', background: `linear-gradient(180deg, ${rgba('#A855F7', 0.72)}, ${rgba('#A855F7', 0.5)})`, border: `1px solid ${rgba('#C084FC', 0.9)}`, boxSizing: 'border-box', boxShadow: `0 0 18px ${rgba('#A855F7', 0.35)}` });
      txt(g, s, { font: F.HEEBO, weight: 500, size: 15, color: C.WHITE });
      sfx(T.gen + 0.1 * k + 0.05, 'blip', 0.5 - 0.04 * k);
      return g;
    });
    const genLine = rect(prRows[3], 0, TRK.V2[0], 3, TRK.V2[1], { background: C.WHITE, boxShadow: `0 0 18px ${C.ACC_T}, 0 0 40px ${C.ACC}` });
    const phG = grp(prRows[3], 0, 0);
    rect(phG, -1, TLY + 2, 2, 300, { background: C.ACC, boxShadow: `0 0 10px ${rgba(C.ACC, 0.8)}` });
    const phS = svgBox(phG, -9, TLY - 4, 18, 18); svgEl('path', phS, { d: 'M1 1H17V10L9 17L1 10Z', fill: C.ACC });
    const phX = t => CLX(0) + PPS * Math.max(0, t - T.play);
    sfx(T.create + 0.05, 'whoosh', 0.5); sfx(T.create + 0.4, 'land', 0.5); sfx(T.gen, 'data', 0.8);
    sfx(T.close2, 'swish', 0.4); sfx(T.close2 + 0.3, 'land', 0.4);
    // captions on the program monitor (world px), each caption group shown while the playhead is on its clip
    const HD = blurWords(cam, [['כתוביות'], ['AI', C.BLUE, 'ltr', 500], ['בעברית']], Object.assign({}, HL, { size: 92, y: PRR[1] - PR_H / 2 - 120, gap: 26 }));
    const cS = 58, CO = { font: F.HEEBO, weight: 800, size: cS, color: C.WHITE, gap: cS * 0.27 };
    const capY = PRY(VIDY + VIDH - 70);
    const marker = div(cam, { borderRadius: '10px', background: C.WARM, boxShadow: `0 0 26px ${rgba(C.WARM, 0.55)}` });
    const GA = row(cam, ['כל', 'מילה', 'נדלקת'], Object.assign({}, CO, { y: capY })), GB = row(cam, ['בדיוק', 'בזמן'], Object.assign({}, CO, { y: capY }));
    const CAP = [...GA, ...GB];
    CAP.forEach((w, k) => { w.g.inner.style.textShadow = '0 3px 14px rgba(0,0,0,0.65)'; sfx(T.words[k], 'tick', 0.3); });
    const mkPad = 12, mkEdge = k => [CAP[k].cx - CAP[k].w / 2 - mkPad, CAP[k].cx + CAP[k].w / 2 + mkPad];
    const mkKeys = side => CAP.slice(1).map((w, i) => {
      const k = i + 1, movingLeft = CAP[k].cx < CAP[k - 1].cx, lead = movingLeft ? side === 0 : side === 1;
      return [T.words[k], mkEdge(k)[side], lead ? 34 : 18, 0.9];
    });
    const mkL = track(mkEdge(0)[0], mkKeys(0)), mkRt = track(mkEdge(0)[1], mkKeys(1));

    // ================= 5. animations: each clicked tile lifts into a glass preview card =================
    const PREV = [0, -470, 880, 330, 44];
    const bS = Math.min(124, fit('בלחיצה אחת', Object.assign({}, HL, { weight: 500 }), 700));
    const BO = Object.assign({}, HL, { size: bS, y: PREV[1], color: C.WHITE, gap: bS * 0.26 });
    const PV = STYLES.map((_, i) => {
      const persp = grp(cam, 0, 0); persp.style.perspective = '2000px';
      const tilt = grp(persp, 0, 0);
      const sh = div(tilt, { background: 'rgba(0,0,0,0.55)' });
      const el = div(tilt, { boxSizing: 'border-box', overflow: 'hidden', background: GLASS_BG, border: '1px solid rgba(255,255,255,0.28)', backdropFilter: 'blur(22px) saturate(180%) brightness(1.08)', boxShadow: GLASS_RIM });
      const hi = div(el, { left: '0', top: '0', width: '100%', height: '100%' });
      const tk = track(TILER[i], [[T.tiles[i], PREV, 12, 0.8]]);
      return { persp, tilt, sh, el, hi, tk };
    });
    const BV = STYLES.map(() => { const r = rowW(cam, [['בלחיצה'], ['אחת', 0, 0, 500]], BO); r[0].g.inner.style.textShadow = GLOW.w; css(r[1].g.inner, { color: C.WARM, textShadow: GLOW.o }); return r; });
    T.tiles.forEach((c, i) => { sfx(c, 'click', 0.7); sfx(c + 0.03, 'swish', 0.3); });
    sfx(T.tiles[0] + 0.22, 'pop', 0.45); sfx(T.tiles[1] + 0.22, 'slide', 0.6); sfx(T.tiles[2] + 0.22, 'shimmer', 0.4); sfx(T.tiles[3] + 0.22, 'glass', 0.3);

    // ================= 6. end card =================
    const L2 = makeLogo(cam, L2Y, 480, 'lgB');
    const MT = track(L1.body, [[T.open, panelRect(0, PTOP0), 10, 0.9], [T.fold - 0.2, panelRect(2, PTOP1), 400, 1], [T.fold, L2.body, 11, 0.92]]);
    const WM2 = blurWords(cam, [['CS', C.WHITE, 'ltr'], ['TRIM', C.BLUE, 'ltr']], { font: F.HEEBO, weight: 700, ls: 0.01, size: 140, y: -110, gap: 36, ltr: true });
    const chO = { font: F.HEEBO, weight: 500, size: 52, color: C.WHITE, dir: 'ltr' };
    const chW = ['Mac', 'Windows'].map(s => measure(s, chO).w + 88), chGap = 24, chTot = chW[0] + chGap + chW[1];
    const CH = ['Mac', 'Windows'].map((s, i) => {
      const x = i === 0 ? -chTot / 2 + chW[0] / 2 : chTot / 2 - chW[1] / 2;
      const G = lglass(cam, chW[i], 96, 48, x, 60);
      txt(G.g, s, Object.assign({}, chO, { y: 2, css: { textShadow: GLOW.w } }));
      return G;
    });
    const cO = { font: F.HEEBO, weight: 500, size: 64, color: C.WHITE };
    const ctaT = 'להורדה בחינם', ctw = measure(ctaT, cO).w, icW = 52, cbw = ctw + icW + 22 + 150, cbh = 150;
    const ctaGlow = box(cam, 0, 270, cbw * 0.9, cbh, { borderRadius: px(cbh / 2), background: `linear-gradient(90deg, ${C.VIOLET}, ${C.ACC}, ${C.LOGO1})` });
    const CTA = lglass(cam, cbw, cbh, cbh / 2, 0, 260);
    const ring2 = div(CTA.el, { left: '-1px', top: '-1px', right: '-1px', bottom: '-1px', width: 'auto', height: 'auto', borderRadius: px(cbh / 2), padding: '2px',
      WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' });
    const cx0 = (icW + 22 + ctw) / 2;
    const dl = svgBox(CTA.g, cx0 - icW, -icW / 2, icW, icW);
    dl.setAttribute('viewBox', '0 0 24 24');
    dl.style.filter = `drop-shadow(0 0 10px ${rgba(C.WHITE, 0.6)})`;
    svgEl('path', dl, { d: 'M12 3.5V15M6.5 9.8L12 15.3L17.5 9.8M4.5 20H19.5', fill: 'none', stroke: C.WHITE, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    txt(CTA.g, ctaT, Object.assign({}, cO, { x: cx0 - icW - 22 - ctw / 2, y: 2, css: { textShadow: GLOW.w } }));
    const shine = rect(CTA.el, 0, -20, 110, cbh + 40, { background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.45), rgba(255,255,255,0))' });
    const site = txt(cam, 'cstrim.site', { font: F.HEEBO, weight: 400, size: 46, color: C.PN_TX2, dir: 'ltr', y: 392, ls: 0.02, css: { textShadow: '0 0 18px rgba(255,255,255,0.25)' } });
    sfx(T.fold, 'whoosh', 0.5); sfx(T.fold + 0.05, 'flip', 0.5); sfx(T.logo2, 'land', 0.9); sfx(T.logo2, 'shimmer', 0.6); sfx(T.wm2, 'blip', 0.5);
    sfx(T.chips, 'glass', 0.6); sfx(T.chips + 0.08, 'glass', 0.5); sfx(T.cta, 'land', 0.5); sfx(T.cta + 0.05, 'glass', 0.8); sfx(18.45, 'shimmer', 0.35);

    // ================= cursor =================
    const cur = cursor(cam, 50, C.WHITE, C.INK);
    const tip = p => [p[0] + 8, p[1] + 6];
    const curT = track([470, 760], [
      [5.05, tip(P_SENS), 12, 0.95], [5.62, tip(P_CUT), 13, 0.95], [6.0, [470, 620], 9, 1],
      [8.2, tip(P_TAB1), 12, 0.95], [8.7, tip(P_TOG), 13, 0.95], [9.05, tip(P_SW), 14, 0.95], [9.38, tip(P_CREATE), 13, 0.95], [9.75, [470, 640], 9, 1],
      [13.55, tip(P_TAB2), 12, 0.95], ...T.tiles.map((c, i) => [c - 0.28, tip(P_TILES[i]), 14, 0.95]), [16.05, [480, 720], 8, 1],
    ]);
    const CLICKS = [T.sens, T.cut, T.tab1, T.toggle, T.swatch, T.create, T.tab2, ...T.tiles];
    const curWin = [[4.95, 5.95], [8.2, 9.72], [13.55, 16.05]];

    // ================= film grain =================
    const gctx = canvas2d(root, 0, 0, W, H);
    const img = gctx.createImageData(W, H), R = rng(7);
    for (let i = 0; i < img.data.length; i += 4) { const v = R() < 0.5 ? 0 : 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = Math.floor(R() * 10); }
    gctx.putImageData(img, 0, 0);

    const kf = (u, keys) => { for (let i = 1; i < keys.length; i++) if (u <= keys[i][0]) { const a = keys[i - 1], b = keys[i], k = E.o3((u - a[0]) / Math.max(1e-6, b[0] - a[0])); return a.slice(1).map((v, j) => lerp(v, b[j + 1], k)); } return keys[keys.length - 1].slice(1); };
    const SAMPLE = [
      u => { const [s, o] = kf(u, [[0, 0.35, 0], [0.18, 1.12, 1], [0.28, 0.97, 1], [0.38, 1, 1], [0.72, 1, 1], [0.86, 0.35, 0], [1, 0.35, 0]]); return { s, o }; },
      u => { const [y, o] = kf(u, [[0, 30, 0], [0.2, 0, 1], [0.72, 0, 1], [0.84, -18, 0], [1, 30, 0]]); return { y, o }; },
      u => { const [s, o] = kf(u, [[0, 0.6, 0], [0.2, 1, 1], [0.72, 1, 1], [0.86, 1.22, 0], [1, 0.6, 0]]); return { s, o }; },
      u => { const [o] = kf(u, [[0, 0], [0.2, 1], [0.72, 1], [0.88, 0], [1, 0]]); return { o }; },
    ];
    const activeTile = t => { let a = 0; T.tiles.forEach((c, i) => { if (t >= c) a = i; }); return a; };

    // =====================================================================================
    return t => {
      const z = camZ(t), [dx, dy, dr] = drift(t);
      tf(cam, { x: dx, y: dy, s: z, r: dr });
      tf(bg, { x: dx * 0.35, y: dy * 0.35, s: 1 + (z - 1) * 0.35 });
      const fk = fogK(t);
      [[fA, fAp, 21], [fB, fBp, 25], [fC, fCp, 29]].forEach(([el, p, sd], i) => {
        const [x, y] = p(t);
        tf(el, { x: x + 34 * vnoise(t * 0.2, sd), y: y + 34 * vnoise(t * 0.17, sd + 1), o: fk * (i === 2 ? 0.5 + 0.5 * sp(t, 3.2, 4) : 1) * (0.92 + 0.08 * Math.sin(t * 1.3 + i)) });
      });

      // ---------- 1. hook ----------
      blurIO(TT1, t, T.t1, T.tOut);
      blurIO(TT2, t, T.t2, T.tOut + 0.05);
      const wk = S(t - T.wave, 7, 1), dk = drawK(t);
      if (on(waveS, t < T.logo)) {
        let d = '';
        for (let i = 0; i <= WV.N; i++) {
          const u = i / WV.N; if (u > dk) break;
          const [qx, qy] = pW(u);
          d += (i ? 'L' : 'M') + f2(lerp(lerp(WV.x0, WV.x1, u), qx, wk)) + ' ' + f2(lerp(WV.y + waveY(u, t), qy, wk));
        }
        wave.setAttribute('d', d || 'M0 0');
        wave.setAttribute('stroke-width', f2(lerp(4.5, 24 * L1.sc, wk)));
      }
      gapGlows.forEach((g, i) => tf(g, { o: (dk > GAPF[i][1] ? 1 : 0) * 0.9 * (0.75 + 0.25 * Math.sin(t * 5 + i)) * (1 - ramp(t, T.wave - 0.05, 0.3)), blur: 9 }));

      // ---------- 2. logo lockup ----------
      const l1o = t >= T.logo && t < T.open + 0.08 ? 1 - ramp(t, T.open, 0.08) : 0;
      if (tf(L1.g, { o: l1o })) {
        bubScale(L1, 0.55 + 0.45 * S(t - T.logo, 15, 0.62));
        tf(L1.glow, { o: 0.7 * sp(t, T.logo, 7), blur: 44, s: 1 + 0.03 * Math.sin((t - T.logo) * 3) });
        L1.bar.style.opacity = sp(t, T.logo + 0.2, 18);
      }
      const bk = sp(t, T.logo, 5);
      tf(burst, { s: 0.6 + 1.9 * bk, o: t >= T.logo ? 0.8 * (1 - bk) : 0 });
      blurIO(WM1, t, T.wm, T.wmOut, 0.035);

      // ---------- 3. panel ----------
      const ptop = PTOP(t), ph = PHt(t), recede = RC(t);
      const openK = kick(t, T.open, 14, 8, 0.18), foldK = S(t - T.fold, 12, 1), fry = flipRy(t), fkk = flipK(t);
      const pcy = ptop + K * ph / 2;
      const pOn = t >= T.open + 0.25 && t < T.fold + 0.16;
      tf(pPersp, { x: 0, y: pcy, o: pOn ? 1 : 0 });
      if (pOn) {
        tf(pTilt, { rx: 16 * openK + 20 * recede + 18 * foldK, ry: -7 * openK + fry, s: (1 - 0.17 * recede) * (1 - 0.3 * foldK) * (1 - 0.08 * fkk), y: 90 * recede,
          o: ramp(t, T.open + 0.3, 0.12) * (1 - 0.68 * recede) * (1 - ramp(t, T.fold + 0.02, 0.12)), blur: 9 * recede + 10 * ramp(t, T.fold, 0.14) });
        tf(pScale, { s: K, y: -K * ph / 2 });
        pnEl.style.height = px(ph);
        place(pShadow, -K * PNW / 2, pcy - K * ph / 2 + 40, K * PNW, K * ph);
        tf(pShadow, { o: 0.9 * ramp(t, T.open + 0.3, 0.2) * (1 - recede * 0.6) * (1 - ramp(t, T.fold, 0.12)) * (1 - 0.7 * fkk), blur: 50 });
        [hd, ctx, tabs, views, ft].forEach((el, i) => { const a = T.open + 0.32 + 0.07 * i, k = S(t - a, 18, 1); tf(el, { o: ramp(t, a, 0.12), y: 10 * (1 - k), blur: 6 * (1 - k) }); });
        // tab state changes while the face is edge on; the new face's parts rise in, 60 ms apart
        const vi = t >= TC2 ? 2 : t >= TC1 ? 1 : 0;
        TABS.forEach((el, i) => { el.style.color = i === vi ? C.PN_TX : C.PN_TX2; });
        const bl = barL(t), br = barR(t);
        css(tabbar, { left: px(Math.min(bl, br)), width: px(Math.abs(br - bl)) });
        V.forEach((v, i) => {
          on(v, i === vi);
          const a0 = [T.open + 0.46, TC1, TC2][i];
          VPARTS[i].forEach((el, j) => { const a = a0 + 0.06 * j, k = S(t - a, 20, 1); tf(el, { o: ramp(t, a, 0.1), y: 9 * (1 - k), blur: 5 * (1 - k) }); });
        });
        sensKnob.style.transform = `translateX(${f2(knobX(t))}px)`;
        const sk = ramp(t, T.sens, 0.1);
        sens.forEach((s, i) => { const a = i === 0 ? 1 - sk : i === 1 ? sk : 0; s.style.color = mixc(C.PN_TX2, C.PN_TX, a); s.style.fontWeight = a > 0.5 ? 600 : 500; });
        [[0, T.cut], [1, T.create], [2, -9]].forEach(([i, c]) => {
          const hov = c > 0 ? ramp(t, c - 0.28, 0.12) * (1 - ramp(t, c + 0.1, 0.2)) : 0;
          BTN[i].style.background = mixc(C.ACC, C.ACC_H, hov);
          BTN[i].style.boxShadow = `0 0 ${f2(8 + 14 * hov)}px ${rgba(C.ACC, 0.25 + 0.4 * hov)}`;
          tf(BTN[i], { s: 1 - 0.035 * bump(t, c - 0.03, 0.06) });
          tf(GLOW_BTN[i], { o: 0.55 * hov + 0.6 * bump(t, c, 0.12, 24, 6), blur: 10, s: 1 + 0.06 * bump(t, c, 0.12, 24, 6) });
        });
        const mkOn = ramp(t, T.toggle, 0.1), mkK = S(t - T.toggle, 24, 0.85);
        mk.style.background = mixc(C.PN_S3, C.ACC, mkOn); mk.style.borderColor = mixc(C.PN_LINE2, C.ACC, mkOn);
        mk.style.boxShadow = `0 0 ${f2(10 * mkOn)}px ${rgba(C.ACC, 0.6 * mkOn)}`;
        css(mkKnob, { right: px(2 + 12 * mkK), background: mixc('#BDBDBD', '#FFFFFF', mkOn) });
        const swk = ramp(t, T.swatch, 0.1);
        pill.style.background = mixc(SWATCHES[0], C.WARM, swk); pill.style.opacity = f2(0.4 + 0.6 * mkOn);
        rowc.style.opacity = f2(0.4 + 0.6 * mkOn);
        css(ring, { transform: `translateX(${f2(ringX(t))}px)`, boxShadow: `0 0 0 1.5px ${mixc(SWATCHES[0], C.WARM, swk)}, 0 0 10px ${rgba(C.WARM, 0.6 * swk)}` });
        sws.forEach((s, i) => tf(s, { s: 1 + 0.15 * (i === 4 ? bump(t, T.swatch - 0.02, 0.06) : 0) }));
        const at = activeTile(t), atk = T.tiles.map(c => ramp(t, c, 0.08));
        tiles.forEach((tl, i) => {
          const a = i === at ? (i === 0 ? 1 : atk[i]) : 0;
          tl.style.borderColor = mixc(C.PN_LINE, C.ACC, a); tl.style.boxShadow = a > 0.01 ? `0 0 0 ${f2(a)}px ${C.ACC}, 0 0 ${f2(14 * a)}px ${rgba(C.ACC, 0.5 * a)}` : 'none';
          vps[i].style.background = mixc(C.PN_BG, '#121A2B', a);
          smps[i].style.background = mixc(C.PN_S3, C.ACC, a);
          nms[i].style.color = mixc(C.PN_TX2, C.PN_TX, a); nms[i].style.fontWeight = a > 0.5 ? 600 : 500;
          tf(tl, { s: 1 - 0.03 * bump(t, T.tiles[i] - 0.03, 0.06) });
          tf(smps[i], SAMPLE[i]((((t - T.tab2) % 2.6) + 2.6) % 2.6 / 2.6));
        });
      } else on(pShadow, false);

      // morph rect: logo -> panel and panel -> logo
      const mOn = (t >= T.open && t < T.open + 0.55) || (t >= T.fold - 0.01 && t < T.logo2 + 0.03);
      if (tf(mPersp, { o: mOn ? 1 : 0 })) {
        const [mx, my, mw, mh, mr] = MT(t);
        const second = t > 10, kc = second ? 1 - ramp(t, T.fold + 0.12, 0.3) : ramp(t, T.open + 0.04, 0.3);
        tf(mPersp, { x: mx, y: my });
        tf(mTilt, { rx: second ? 22 * kick(t, T.fold, 12, 7, 0.2) : 16 * openK, ry: second ? 8 * kick(t, T.fold, 12, 7, 0.2) : -7 * openK });
        place(mR, -mw / 2, -mh / 2, mw, mh);
        css(mR, { borderRadius: px(mr), background: `linear-gradient(135deg, ${mixc(C.LOGO1, C.PN_BG, kc)}, ${mixc(C.LOGO2, C.PN_BG, kc)})`, border: `1px solid ${rgba(C.WHITE, 0.08 * kc)}`, boxShadow: `0 0 ${f2(60 * (1 - kc))}px ${rgba(C.BLUE, 0.6 * (1 - kc))}` });
        tf(mPulse, { o: second ? 0 : 1 - ramp(t, T.open, 0.14), blur: 8 * ramp(t, T.open, 0.14) });
      }

      // ---------- 4. front card ----------
      const fOn = (t >= T.cut + 0.04 && t < T.back + 0.4) || (t >= T.create + 0.04 && t < T.close2 + 0.4);
      if (tf(fPersp, { o: fOn ? 1 : 0 })) {
        const [cx, cy, cw, ch, cr] = fT(t);
        const first = t < 9.3, op = first ? T.cut : T.create, cl = first ? T.back : T.close2;
        tf(fPersp, { x: cx, y: cy, o: 1 - ramp(t, cl + 0.3, 0.08) });
        const flyK = first && t >= T.chk && t < T.back ? kick(t, T.chk, 14, 7, 0.14) : 0;
        const ry = 12 * kick(t, op + 0.05) - 10 * kick(t, cl) + 16 * flyK, rx = -8 * kick(t, op + 0.05) + 8 * kick(t, cl) - 10 * flyK;
        tf(fTilt, { ry, rx });
        place(fR, -cw / 2, -ch / 2, cw, ch);
        // colour: blue button -> dark card [-> glass check] -> blue button
        const DARK = first ? RGB('#1B1B1F') : RGB(PRBG), GL = [255, 255, 255, 0.13], ACCA = RGB(C.ACC);
        let bgc, glassK = 0;
        if (t < cl) {
          if (first && t >= T.chk) { glassK = ramp(t, T.chk, 0.25); bgc = mixa(DARK, GL, glassK); }
          else bgc = mixa(ACCA, DARK, ramp(t, op + 0.06, 0.22));
        } else {
          const from = first ? GL : DARK; glassK = first ? 1 - ramp(t, cl + 0.1, 0.18) : 0;
          bgc = mixa(from, ACCA, ramp(t, cl + 0.12, 0.18));
        }
        css(fR, { borderRadius: px(cr), background: bgc, border: `1px solid rgba(255,255,255,${f2(0.12 + 0.18 * glassK)})`, boxShadow: `inset 0 1.5px 1px rgba(255,255,255,${f2(0.22 + 0.45 * glassK)}), inset 0 0 26px rgba(255,255,255,${f2(0.1 * glassK)})` });
        fHi.style.opacity = f2(0.25 + 0.75 * glassK);
        fHi.style.background = `radial-gradient(70% 90% at ${f2(30 + ry * 2)}% -10%, rgba(255,255,255,0.22), rgba(255,255,255,0) 60%)`;
        place(fShadow, -cw / 2, -ch / 2 + 34, cw, ch); fShadow.style.borderRadius = px(cr);
        tf(fShadow, { o: ramp(t, op + 0.06, 0.22) * (1 - ramp(t, cl + 0.12, 0.18)), blur: 44 });
        on(tlC, first); on(prC, !first);
        on(chkS, first && t >= T.chk && t < T.back + 0.1);
        if (first) {
          const cin = ramp(t, op + 0.17, 0.2) * (1 - ramp(t, T.chk - 0.05, 0.12));
          tlRows.forEach((r, i) => { const a = op + 0.17 + 0.07 * i, k = S(t - a, 18, 1); tf(r, { o: cin * ramp(t, a, 0.12), y: 14 * (1 - k), blur: 6 * (1 - k) }); });
          let x = CX0;
          for (const s of segs) {
            const w = s.kind === 'g' ? s.w0 * (1 - S(t - s.tc, 16, 1)) : s.w0;
            css(s.v, { left: px(x), width: px(Math.max(0, w)) }); css(s.a, { left: px(x), width: px(Math.max(0, w)) });
            if (s.kind === 'g') {
              on(s.v, w > 0.5); on(s.a, w > 0.5); css(s.line, { width: px(Math.max(0, w)) });
              css(s.ov, { left: px(x), width: px(Math.max(0, w)) }); tf(s.ov, { o: clamp(w / 8, 0, 1) * (0.8 + 0.2 * Math.sin(t * 6 + s.x0)) });
            } else if (s.seam) {
              css(s.seam, { left: px(x - 1) }); css(s.flash, { left: px(x - 1.5) });
              tf(s.seam, { o: sp(t, s.tc + 0.1, 20) }); tf(s.flash, { o: 0.9 * bump(t, s.tc + 0.12, 0.04, 40, 9) });
            }
            x += w;
          }
          durV.inner.textContent = `${48 - Math.round(12 * closed(t))}:12`;
          chk.setAttribute('stroke-dashoffset', f2(chkL * (1 - S(t - T.chk - 0.12, 14, 1))));
          tf(chkS, { s: 0.7 + 0.3 * S(t - T.chk - 0.08, 18, 0.6), o: ramp(t, T.chk + 0.08, 0.1) * (1 - ramp(t, T.back - 0.05, 0.1)) });
        } else {
          const cin = ramp(t, op + 0.14, 0.2) * (1 - ramp(t, cl - 0.02, 0.1));
          prRows.forEach((r, i) => { const a = op + 0.14 + 0.07 * i, k = S(t - a, 18, 1); tf(r, { o: cin * ramp(t, a, 0.12), y: 14 * (1 - k), blur: 6 * (1 - k) }); });
          tf(vb1, { x: 90 * vnoise(t * 0.35, 71), y: 70 * vnoise(t * 0.3, 72) });
          tf(vb2, { x: 80 * vnoise(t * 0.3, 73), y: 90 * vnoise(t * 0.33, 74) });
          let pk = 0;
          T.words.forEach((tw, k) => { pk += bump(t, tw, 0.05, 30, 10); const u = sp(t, tw, 5); tf(orbRings[k], { s: 1 + 1.3 * u, o: t >= tw ? 0.7 * (1 - u) : 0 }); });
          tf(orb, { s: (1 + 0.03 * Math.sin(t * 2.4)) * (1 + 0.12 * pk) });
          capClips.forEach((g, k) => { const a = T.gen + 0.1 * k, kk = S(t - a, 20, 0.7); tf(g, { o: ramp(t, a, 0.08), y: -34 * (1 - kk), blur: 8 * (1 - S(t - a, 20, 1)) }); });
          const gl = seg(t, T.gen - 0.05, T.gen + 0.65);
          tf(genLine, { x: PX0 + PXW * E.io3(gl), o: t > T.gen - 0.05 && t < T.gen + 0.7 ? 1 : 0 });
          tf(phG, { x: phX(t), o: ramp(t, T.gen + 0.6, 0.12) });
          const secs = 3 + Math.max(0, t - T.play), ff = Math.floor((secs % 1) * 25);
          tcMon.inner.textContent = `00:00:0${Math.floor(secs)}:${String(ff).padStart(2, '0')}`;
        }
      }
      // "חסכת 12 דקות"
      blurIO(SV1, t, T.count[0] - 0.1, T.chk - 0.1);
      numG.inner.textContent = String(Math.round(12 * E.o3(seg(t, T.count[0], T.count[1]))));
      blurEl(numG, t, T.count[0] - 0.02, T.chk - 0.06, { s: 1 + 0.1 * bump(t, T.count[1], 0.05, 30, 12) });
      blurIO(SV2, t, T.count[0] + 0.06, T.chk - 0.04);
      // captions: heading, the program monitor caption groups, the marker on the spoken word
      blurIO(HD, t, T.create + 0.12, T.close2 - 0.15);
      const gB0 = T.play + 1.3;
      CAP.forEach((w, k) => {
        const inA = k < 3, a = inA ? T.play : gB0, b = inA ? gB0 : T.close2 - 0.05;
        tf(w.g, { o: ramp(t, a, 0.05) * (1 - ramp(t, b, 0.05)), s: 1 + 0.05 * bump(t, T.words[k], 0.05, 30, 12) });
      });
      if (tf(marker, { o: t >= T.play ? 1 - ramp(t, T.close2 - 0.05, 0.05) : 0 })) {
        const l = mkL(t), r = mkRt(t), k0 = S(t - T.play, 30, 0.8);
        const mw = (r - l) * k0, mh = cS * 1.18 * k0;
        place(marker, (l + r) / 2 - mw / 2, capY - mh / 2 + 3, mw, mh);
      }

      // ---------- 5. preview cards ----------
      PV.forEach((p, i) => {
        const c = T.tiles[i], c1 = T.tiles[i + 1] ?? T.fold;
        const live = t >= c - 0.01 && t < c1 + 0.35;
        if (!tf(p.persp, { o: live ? 1 : 0 })) { BV[i].forEach(w => tf(w.g, { o: 0 })); return; }
        const [x, y, w, h, r] = p.tk(t), ex = S(t - c1, 20, 1), tx = ramp(t, c1 - 0.02, 0.1);   // the old card sinks away fast; its text goes first
        tf(p.persp, { x, y: y - 50 * ex, o: 1 - ex });
        const rx = -16 * kick(t, c, 14, 7, 0.14) + 14 * ex, ry = 6 * kick(t, c, 14, 7, 0.14);
        tf(p.tilt, { rx, ry, s: 1 - 0.12 * ex, blur: 8 * ex });
        place(p.el, -w / 2, -h / 2, w, h); p.el.style.borderRadius = px(r);
        place(p.sh, -w / 2 + w * 0.04, -h / 2 + 30, w * 0.92, h); p.sh.style.borderRadius = px(r);
        tf(p.sh, { o: 1 - ex, blur: 30 });
        p.hi.style.background = `radial-gradient(70% 90% at ${f2(30 + ry * 3)}% -10%, rgba(255,255,255,0.38), rgba(255,255,255,0) 60%)`;
        // the text plays in the clicked style once the card has nearly landed
        BV[i].forEach((wd, j) => {
          const t0 = c + 0.2 + 0.06 * j;
          if (t < t0 - 0.01) { tf(wd.g, { o: 0 }); return; }
          const base = { o: 1 - tx, blur: 12 * tx, y: -50 * ex };
          if (i === 0) { const sc = 0.35 + 0.65 * S(t - t0, 17, 0.5); tf(wd.g, Object.assign(base, { s: sc, x: wd.cx * (sc - 1), o: base.o * ramp(t, t0, 0.07) })); }
          else if (i === 1) { const Y = tt => 110 * (1 - S(tt - t0, 19, 1)); tf(wd.g, Object.assign(base, { y: base.y + Y(t), sy: 1 + 0.12 * (1 - S(t - t0, 14, 1)), o: base.o * ramp(t, t0, 0.1), mb: [0, vel(Y, t)] })); }
          else if (i === 2) { const k = S(t - t0, 15, 1), sc = 0.6 + 0.4 * k; tf(wd.g, Object.assign(base, { s: sc, x: wd.cx * (sc - 1), blur: base.blur + 8 * (1 - k), o: base.o * ramp(t, t0, 0.12) })); }
          else tf(wd.g, Object.assign(base, { o: base.o * E.smooth(seg(t, t0, t0 + 0.4)) }));
        });
      });

      // ---------- 6. end card ----------
      if (tf(L2.g, { o: t >= T.logo2 ? 1 : 0 })) {
        bubScale(L2, 1 + 0.06 * kick(t, T.logo2, 18, 8, 0.05));
        L2.pulse.setAttribute('stroke-dasharray', `${L2.len} ${L2.len}`);
        L2.pulse.setAttribute('stroke-dashoffset', f2(L2.len * (1 - S(t - T.logo2 - 0.05, 11, 1))));
        L2.bar.style.opacity = sp(t, T.logo2 + 0.35, 18);
        tf(L2.glow, { o: 0.65 * sp(t, T.logo2, 6) * (0.88 + 0.12 * Math.sin((t - T.logo2) * 2.2)), blur: 46 });
      }
      blurIO(WM2, t, T.wm2, 99, 0.035);
      CH.forEach((G, i) => {
        const a = T.chips + 0.08 * i, k = S(t - a, 16, 0.75);
        tf(G.g, { o: ramp(t, a, 0.12), y: 40 * (1 - S(t - a, 16, 1)), s: 0.9 + 0.1 * k, blur: 10 * (1 - S(t - a, 16, 1)) });
        tf(G.sh, { o: 1, blur: 26 });
        glassHi(G, 14 * Math.sin((t - a) * 1.2) + 20 * (1 - k));
      });
      const ca = T.cta, ck = S(t - ca, 15, 0.72);
      if (tf(CTA.g, { o: ramp(t, ca, 0.14), y: 90 * (1 - S(t - ca, 15, 1)), s: 0.92 + 0.08 * ck, blur: 12 * (1 - S(t - ca, 15, 1)), rx: 18 * (1 - S(t - ca, 12, 1)) })) {
        tf(CTA.sh, { o: 1, blur: 26 });
        glassHi(CTA, 18 * Math.sin((t - ca) * 1.1));
        const ang = 120 + (t - ca) * 140;
        ring2.style.background = `conic-gradient(from ${f2(ang)}deg, rgba(255,255,255,0) 0deg, rgba(255,255,255,0) 250deg, ${rgba(C.ACC_T, 0.9)} 300deg, rgba(255,255,255,1) 330deg, rgba(255,255,255,0) 360deg)`;
        tf(shine, { x: lerp(-160, cbw + 60, E.io3(seg(t, 18.45, 19.15))), skx: -20, o: t >= 18.45 && t < 19.15 ? 1 : 0 });
      }
      tf(ctaGlow, { o: 0.5 * sp(t, ca + 0.1, 6) * (0.8 + 0.2 * Math.sin((t - ca) * 2.6)), blur: 40, y: 0 });
      blurEl(site, t, T.site);

      // ---------- cursor ----------
      const [cx, cy] = curT(t);
      let press = 1; for (const c of CLICKS) press -= 0.14 * bump(t, c - 0.04, 0.05);
      const co = Math.max(...curWin.map(([a, b]) => ramp(t, a, 0.12) * (1 - ramp(t, b - 0.12, 0.12))));
      tf(cur, { x: cx, y: cy, s: press, o: co });
    };
  });
})();
