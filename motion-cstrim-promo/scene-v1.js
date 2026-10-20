// scene.js: CS Trim promo, 20 s at 120 BPM. music_edit.wav is the song from 4.022 s, so the drop lands on t = 4.0.
//   0-3   hook: a timeline full of silences, title "מתעצבנים על שתיקות בעריכה?"
//   3-7   the cursor clicks "חיתוך שתיקות", a scan line finds the gaps, on the drop they close (ripple), "חסכת 12 דקות"
//   7-12  match cut: one clip grows into a video window, the caption builds word by word, the spoken word in coral
//   12-16 the window folds into a row of animation presets; each click replays "בלחיצה אחת" in that style
//   16-20 everything converges into a point of light, the logo, "חינם · Mac · Windows", the download button
// Every element is placed in world px: 0,0 is the frame centre. The camera (cam) drifts slowly the whole time;
// background glows move at 0.35 of it and the foreground bokeh at 1.7 of it (parallax).
(() => {
  'use strict';
  const V = H > W;
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;
  const mixc = (a, b, k) => { const A = hex(a), B = hex(b); k = clamp(k, 0, 1); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; };
  const css = (el, o) => Object.assign(el.style, o);
  const px = v => f2(v) + 'px';
  const place = (el, x, y, w, h) => css(el, { left: px(x), top: px(y), width: px(w), height: px(h) });
  const ramp = (t, t0, d = 0.08) => clamp((t - t0) / d, 0, 1);
  const bump = (t, t0, hold = 0.06, a = 34, b = 13) => S(t - t0, a, 1) - S(t - t0 - hold, b, 1);   // 0 -> 1 -> 0
  const HB = { font: F.HEEBO, weight: 900, ls: -0.015 };
  const UI = { font: F.RUBIK, weight: 500, color: C.GREY };
  const MONO = { font: F.MONO, weight: 500, color: C.GREY, dir: 'ltr' };
  // a word that rises in at t0 and leaves (up, fading, a little blur) at t1
  const leave = (t, t1, d = 0.13) => { const k = ramp(t, t1, d); return { o: 1 - k, y: -28 * E.o2(k), blur: 7 * k }; };
  const wordIO = (g, t, t0, t1, dist = 40, extra = {}) => {
    const r = rise(t, t0, dist), l = leave(t, t1);
    return tf(g, Object.assign({ y: r.y + l.y, o: r.o * l.o, blur: l.blur }, extra));
  };
  // frosted glass card: a blurred dark copy behind it (soft shadow), a translucent fill, a hairline border, a top highlight
  function glass(parent, x, y, w, h, r) {
    const sh = rect(parent, x, y + 26, w, h, { borderRadius: px(r), background: 'rgba(0,0,0,0.5)', filter: 'blur(36px)' });
    const g = rect(parent, x, y, w, h, {
      borderRadius: px(r), boxSizing: 'border-box', overflow: 'hidden',
      background: `linear-gradient(180deg, rgba(255,255,255,0.085), rgba(255,255,255,0.03)), ${rgba(C.INK2, 0.55)}`,
      border: '1.5px solid rgba(255,255,255,0.11)', backdropFilter: 'blur(26px) saturate(140%)',
    });
    rect(g, r * 0.7, 0, w - r * 1.4, 1.5, { background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.34), rgba(255,255,255,0))' });
    return { sh, g };
  }

  // ---------- layout (vertical) ----------
  const LY = {
    titleY: -460, panelY: 240, saveY: [-460, -290],
    win: [0, 60, 760, 1000, 48], headY: -585, capY: 300,
    bigY: -170, pre: [0, 290, 820, 210, 40],
    logoY: -330, wordY: -30, lineY: 130, btnY: 320,
  };

  // ---------- timing (beats are 0.5 s; the drop is beat 8) ----------
  const T_TITLE = [0.25, 0.5, 0.75, 1.0];
  const T_CLICK = 3.5, T_SCAN = [3.55, 4.0], T_CUT = 4.0, T_SAVE = 4.4, T_COUNT = [4.5, 5.5];
  const T_MATCH = 6.45, T_WORDS = [7.5, 8.0, 8.5, 9.0, 9.5], T_WORDS_END = 10.0, T_OUT3 = 11.55;
  const T_STYLES = [12.0, 12.75, 13.5, 14.25, 15.0], T_CONV = 15.55, T_LOGO = 16.0;

  scene('main', 0, DUR, { bg: C.INK }, (root) => {
    // ================= background: glows, a faint grid (parallax 0.35) =================
    const bg = grp(root, W / 2, H / 2);
    const grid = box(bg, 0, 0, 2200, 2900, {
      backgroundImage: 'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
      backgroundSize: '96px 96px', backgroundPosition: '-1px -1px',
      WebkitMaskImage: 'radial-gradient(closest-side, #000 15%, rgba(0,0,0,0) 100%)', maskImage: 'radial-gradient(closest-side, #000 15%, rgba(0,0,0,0) 100%)',
    });
    const glow = (col, a, size) => box(bg, 0, 0, size, size, {
      borderRadius: '50%', background: `radial-gradient(closest-side, ${rgba(col, a)}, ${rgba(col, a * 0.4)} 45%, ${rgba(col, 0)} 100%)`,
    });
    const gA = glow(C.VIOLET, 0.42, 1500), gB = glow(C.BLUE, 0.34, 1300);
    const gAp = track([-280, -560], [[2.9, [-320, -520]], [T_MATCH, [-260, -140]], [T_OUT3, [240, -240]], [T_CONV, [-90, LY.logoY]]], 5, 1);
    const gBp = track([300, 320], [[2.9, [280, 160]], [T_MATCH, [280, 440]], [T_OUT3, [-260, 380]], [T_CONV, [130, LY.logoY + 180]]], 5, 1);

    // ================= camera =================
    const cam = grp(root, W / 2, H / 2);
    // 3.0-4.2 the camera centres the timeline while it is cut, then gives the top of the frame back to the headline
    const camZ = track(1, [[2.95, 1.06, 6, 1], [4.2, 1.0, 6, 1], [T_OUT3, 1.03, 6, 1], [T_CONV - 0.05, 1.0, 5, 1]]);
    const camY = track(0, [[2.95, -LY.panelY * 1.04, 6, 1], [4.2, 0, 6, 1]]);
    const drift = t => [24 * vnoise(t * 0.16 + 0.3, 4), 18 * vnoise(t * 0.13 + 0.7, 9), 0.35 * vnoise(t * 0.1 + 0.2, 13)];

    // ================= scene 1: title =================
    const tS = Math.min(150, fit('שתיקות בעריכה?', HB, 860));
    const TL = [
      ...row(cam, ['מתעצבנים', 'על'], Object.assign({}, HB, { size: tS, y: LY.titleY, color: C.WHITE, gap: tS * 0.24 })),
      ...row(cam, ['שתיקות', 'בעריכה?'], Object.assign({}, HB, { size: tS, y: LY.titleY + tS * 1.14, color: C.WHITE, gap: tS * 0.24 })),
    ];
    TL[2].g.inner.style.color = C.CORAL;
    T_TITLE.forEach((t0, i) => sfx(t0, i === 2 ? 'pop' : 'tick', i === 2 ? 0.55 : 0.4));

    // ================= scenes 1-2: the timeline panel =================
    const PW = 900, PH = 452, PX0 = -PW / 2, PY0 = LY.panelY - PH / 2;   // panel top-left in world px
    const panel = grp(cam, 0, LY.panelY);
    const pin = grp(panel, -PW / 2, -PH / 2);                             // panel-local origin (top-left)
    glass(pin, 0, 0, PW, PH, 34);
    const gH = grp(pin, 0, 0), gR = grp(pin, 0, 0), gT = grp(pin, 0, 0), gV = grp(pin, 0, 0), gA1 = grp(pin, 0, 0), gO = grp(pin, 0, 0);
    // header: window dots, playhead timecode, duration, the cut button (RTL: button on the right)
    [34, 56, 78].forEach(x => box(gH, x, 42, 13, 13, { borderRadius: '50%', background: 'rgba(255,255,255,0.16)' }));
    const tc = txt(gH, '00:00:00:00', Object.assign({}, MONO, { x: 104, y: 43, size: 21, align: 'l' }));
    txt(gH, 'משך', Object.assign({}, UI, { x: 512, y: 43, size: 23 }));
    const durV = txt(gH, '48:12', Object.assign({}, MONO, { x: 446, y: 43, size: 23, color: C.WHITE }));
    const bTxt = 'חיתוך שתיקות', bO = { font: F.RUBIK, weight: 600, size: 25, color: C.WHITE };
    const btw = measure(bTxt, bO).w, bcw = 22 + 10 + btw, bw = bcw + 44, bh = 52;
    const bcx = PW - 28 - bw / 2;
    const btnG = grp(gH, bcx, 42);
    const btnGlow = box(btnG, 0, 8, bw - 20, bh, { borderRadius: px(bh / 2), background: C.VIOLET, filter: 'blur(18px)' });
    box(btnG, 0, 0, bw, bh, { borderRadius: px(bh / 2), background: `linear-gradient(135deg, ${C.VIOLET}, ${C.BLUE})`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' });
    icon(btnG, P.star4, bcw / 2 - 11, 0, 22, C.WHITE, 1.6, C.WHITE);
    txt(btnG, bTxt, Object.assign({}, bO, { x: bcw / 2 - 32 - btw / 2, y: 1 }));
    const ring = box(btnG, 0, 0, bw, bh, { borderRadius: px(bh / 2), border: `2px solid ${rgba(C.VIOLET, 0.9)}`, boxSizing: 'border-box' });
    const BTN = [PX0 + bcx, PY0 + 42];   // button centre in world px
    rect(gH, 0, 84, PW, 1, { background: 'rgba(255,255,255,0.07)' });
    // ruler
    const CX0 = 100, CW = 770;            // content area: x 100..870 = 48:12 of footage
    for (let k = 0; k <= 35; k++) rect(gR, CX0 + 22 * k, k % 5 ? 112 : 104, 1.5, k % 5 ? 8 : 16, { background: 'rgba(255,255,255,0.2)' });
    [0, 8, 16, 24, 32, 40].forEach(m => txt(gR, `${String(m).padStart(2, '0')}:00`, Object.assign({}, MONO, { x: CX0 + CW * m / 48.2 + 6, y: 101, size: 14, align: 'l', css: { opacity: 0.75 } })));
    // track headers
    [['V1', 190], ['A1', 338]].forEach(([s, y]) => {
      box(gT, 50, y, 54, 40, { borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', boxSizing: 'border-box' });
      txt(gT, s, Object.assign({}, MONO, { x: 50, y: y + 1, size: 17 }));
    });
    // segments: speech (s) and silence (g); the silences close on the drop and everything after them ripples left
    const SEG = [['s', 120], ['g', 66], ['s', 90], ['g', 52], ['s', 140], ['g', 76], ['s', 70], ['g', 56], ['s', 100]];
    const vFill = `repeating-linear-gradient(90deg, rgba(255,255,255,0) 0 52px, rgba(255,255,255,0.09) 52px 54px), linear-gradient(180deg, ${rgba(C.VIOLET, 0.64)}, ${rgba(C.VIOLET, 0.40)})`;
    let x0 = CX0, gi = 0;
    const segs = SEG.map(([kind, w0], k) => {
      const ends = k === 0 ? '10px 0 0 10px' : k === SEG.length - 1 ? '0 10px 10px 0' : '0';
      const s = { kind, w0, x0 };
      s.v = rect(gV, x0, 140, w0, 100, { background: vFill, backgroundPosition: `${-(x0 - CX0)}px 0`, borderRadius: ends, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)' });
      s.a = rect(gA1, x0, 256, w0, 164, { background: rgba(C.BLUE, 0.12), borderRadius: ends, boxShadow: `inset 0 1px 0 ${rgba(C.BLUE, 0.35)}`, overflow: 'hidden' });
      if (kind === 's') {
        const sv = svgBox(s.a, 0, 0, w0, 164), n = Math.floor((w0 - 6) / 6);
        for (let i = 0; i < n; i++) {
          const u = (i + 0.5) / n, env = Math.pow(Math.sin(Math.PI * u), 0.55) * (0.62 + 0.38 * Math.abs(Math.sin(i * 0.83 + k * 1.7)));
          const h = 4 + 118 * env * (0.4 + 0.6 * hash(i * 7.3 + k * 31));
          svgEl('rect', sv, { x: 4 + 6 * i, y: 82 - h / 2, width: 3, height: h, rx: 1.5, fill: C.BLUE });
        }
        if (k > 0) {   // the cut point: a dark seam and a white flash when the gap before it closes
          s.seam = rect(gO, x0 - 1, 140, 2, 280, { background: C.INK });
          s.flash = rect(gO, x0 - 1.5, 132, 3, 296, { background: C.WHITE, boxShadow: `0 0 14px ${rgba(C.WHITE, 0.8)}` });
        }
      } else {
        s.gi = gi++;
        s.tc = T_CUT + 0.07 * s.gi;
        s.line = rect(s.a, 0, 81, w0, 2, { background: rgba(C.CORAL, 0.7) });
        s.ov = rect(gO, x0, 134, w0, 292, { borderRadius: '10px', boxSizing: 'border-box' });
      }
      x0 += w0;
      return s;
    });
    txt(gV, 'ראיון', { font: F.RUBIK, weight: 500, size: 19, color: C.WHITE, x: CX0 + 12, y: 158, align: 'l', css: { opacity: 0.85 } });
    const GAPS = segs.filter(s => s.kind === 'g'), GSUM = GAPS.reduce((a, s) => a + s.w0, 0);
    // pair each speech segment after a gap with that gap (for the seam timing)
    segs.forEach((s, k) => { if (s.seam) s.tc = segs[k - 1].tc; });
    // the scan line (3.55..4.0) and the moment it passes each gap
    const scanX = t => CX0 + CW * E.io3(seg(t, T_SCAN[0], T_SCAN[1]));
    GAPS.forEach(s => {
      const xc = s.x0 + s.w0 / 2; let a = 0, b = 1;
      for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (CX0 + CW * E.io3(m) < xc) a = m; else b = m; }
      s.tg = lerp(T_SCAN[0], T_SCAN[1], a);
      sfx(s.tg, 'tick', 0.3);
      sfx(s.tc + 0.05, 'tick', 0.4);
    });
    const gS = grp(pin, 0, 0);
    rect(gS, -12, 132, 24, 296, { background: rgba(C.VIOLET, 0.7), filter: 'blur(12px)' });
    rect(gS, -1.5, 132, 3, 296, { background: `linear-gradient(180deg, ${rgba(C.WHITE, 0)}, ${C.WHITE} 30%, ${C.WHITE} 70%, ${rgba(C.WHITE, 0)})` });
    // playhead
    const gP = grp(pin, 0, 0);
    rect(gP, -1, 96, 2, 330, { background: rgba(C.WHITE, 0.9) });
    const phS = svgBox(gP, -9, 92, 18, 18);
    svgEl('path', phS, { d: 'M1 1H17V10L9 17L1 10Z', fill: C.WHITE });
    const phX = t => CX0 + 30 + 300 * (1 - Math.exp(-t / 1.8));
    // the saved minutes counter is driven by how much of the silence has closed
    const closed = t => GAPS.reduce((a, s) => a + s.w0 * S(t - s.tc, 16, 1), 0) / GSUM;
    sfx(T_CLICK, 'click', 0.9);
    sfx(T_CUT, 'whoosh', 0.5);

    // ================= scene 2: "חסכת 12 דקות" =================
    const s1 = 104, s2 = Math.min(200, fit('12 דקות', HB, 640));
    const sv1 = txt(cam, 'חסכת', Object.assign({}, HB, { weight: 800, size: s1, y: LY.saveY[0], color: C.WHITE }));
    const o2 = Object.assign({}, HB, { size: s2 });
    const wN = measure('12', o2).w, wD = measure('דקות', o2).w, gap2 = s2 * 0.24, tot2 = wN + gap2 + wD;
    const numG = txt(cam, '0', Object.assign({}, o2, { x: tot2 / 2 - wN / 2, y: LY.saveY[1], color: C.CORAL }));
    const dakG = txt(cam, 'דקות', Object.assign({}, o2, { x: -tot2 / 2 + wD / 2, y: LY.saveY[1], color: C.WHITE }));
    const countK = t => 12 * E.o3(seg(t, T_COUNT[0], T_COUNT[1]));
    for (let k = 1; k <= 12; k++) sfx(T_COUNT[0] + (T_COUNT[1] - T_COUNT[0]) * (1 - Math.cbrt(1 - (k - 0.5) / 12)), 'count', 0.3);
    sfx(T_COUNT[1], 'success', 0.6);

    // ================= scenes 3-4 live inside g4, which converges into the logo at 15.55 =================
    const g4 = grp(cam, 0, LY.logoY), C3 = grp(g4, 0, -LY.logoY);
    // the morph box: clip -> video window -> preset panel
    const clip = segs[4];                                       // the third speech clip, after the ripple
    const clipX = PX0 + CX0 + 120 + 90, clipY = PY0 + 140;
    const MB0 = [clipX + clip.w0 / 2, clipY + 50, clip.w0, 100, 0];
    const mbT = track(MB0, [[T_MATCH, LY.win, 9, 0.92], [T_OUT3 + 0.05, LY.pre, 10, 0.9]]);
    const mShadow = div(C3, { borderRadius: '40px', background: 'rgba(0,0,0,0.55)', filter: 'blur(40px)' });
    const winGlow = div(C3, { borderRadius: '50%', background: `radial-gradient(closest-side, ${rgba(C.VIOLET, 0.5)}, ${rgba(C.VIOLET, 0)})` });
    const mbox = div(C3, { overflow: 'hidden', boxSizing: 'border-box', backdropFilter: 'blur(26px) saturate(140%)' });
    const full = { left: '0', top: '0', width: '100%', height: '100%' };
    const lClip = div(mbox, Object.assign({ background: vFill }, full));
    const lVid = div(mbox, Object.assign({ background: `linear-gradient(160deg, ${mixc(C.INK, C.VIOLET, 0.28)}, ${mixc(C.INK, C.BLUE, 0.18)} 60%, ${C.INK})` }, full));
    const blob = (col, a, size, l, tp) => div(lVid, { left: l, top: tp, width: px(size), height: px(size), marginLeft: px(-size / 2), marginTop: px(-size / 2), borderRadius: '50%', background: `radial-gradient(closest-side, ${rgba(col, a)}, ${rgba(col, 0)})` });
    const bl1 = blob(C.VIOLET, 0.75, 820, '35%', '30%'), bl2 = blob(C.BLUE, 0.6, 760, '70%', '62%'), bl3 = blob(C.WHITE, 0.10, 520, '50%', '40%');
    // a voice orb in the middle of the video: it breathes with every spoken word (no people)
    const orbG = div(lVid, { left: '50%', top: '36%', width: '0', height: '0' });
    const orbRings = [0, 1, 2, 3, 4].map(() => box(orbG, 0, 0, 220, 220, { borderRadius: '50%', border: `2px solid ${rgba(C.WHITE, 0.5)}`, boxSizing: 'border-box' }));
    const orb = box(orbG, 0, 0, 220, 220, { borderRadius: '50%', background: `radial-gradient(circle at 40% 35%, ${rgba(C.WHITE, 0.55)}, ${rgba(C.VIOLET, 0.55)} 45%, ${rgba(C.BLUE, 0.15)} 75%, ${rgba(C.BLUE, 0)})`, boxShadow: `0 0 80px ${rgba(C.VIOLET, 0.55)}` });
    div(lVid, { left: '0', top: '50%', width: '100%', height: '50%', background: `linear-gradient(180deg, ${rgba(C.INK, 0)}, ${rgba(C.INK, 0.6)})` });
    const barT = div(lVid, { left: '40px', bottom: '34px', top: 'auto', width: 'calc(100% - 80px)', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.18)' });
    const barF = div(barT, { left: '0', top: '0', height: '6px', borderRadius: '3px', background: rgba(C.WHITE, 0.85) });
    const lGlass = div(mbox, Object.assign({ background: `linear-gradient(180deg, rgba(255,255,255,0.085), rgba(255,255,255,0.03)), ${rgba(C.INK2, 0.55)}` }, full));
    const mBorder = div(mbox, Object.assign({ boxSizing: 'border-box', border: '1.5px solid rgba(255,255,255,0.12)' }, full));
    sfx(T_MATCH, 'whoosh', 0.45);

    // scene 3 heading and caption
    const HD = Object.assign({}, HB, { weight: 800 });
    const hdS = Math.min(96, fit('כתוביות AI בעברית', HD, 800));
    const HDW = row(C3, ['כתוביות', 'AI', 'בעברית'], Object.assign({}, HD, { size: hdS, y: LY.headY, color: C.WHITE, gap: hdS * 0.26 }));
    css(HDW[1].g.inner, { background: `linear-gradient(90deg, ${C.VIOLET}, ${C.BLUE})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', padding: '0 4px' });
    const cS = 98, CO = Object.assign({}, HB, { size: cS, color: C.WHITE, gap: cS * 0.26 });
    const CAP = [
      ...row(C3, ['כל', 'מילה', 'נדלקת'], Object.assign({}, CO, { y: LY.capY })),
      ...row(C3, ['בדיוק', 'בזמן'], Object.assign({}, CO, { y: LY.capY + cS * 1.16 })),
    ];
    CAP.forEach((w, k) => { w.g.inner.style.textShadow = '0 6px 28px rgba(0,0,0,0.45)'; sfx(T_WORDS[k], 'pop', 0.4); });

    // scene 4: presets panel tiles, and five copies of "בלחיצה אחת", one per animation style
    const [PCX, PCY] = LY.pre;
    const TW = 146, TH = 150, TG = 12, TX = i => (5 * TW + 4 * TG) / 2 - TW / 2 - i * (TW + TG);
    const NAMES = ['החלקה', 'טשטוש', 'הגדלה', 'קפיצה', 'אותיות'];
    const GL = { font: F.HEEBO, weight: 800, size: 46, color: C.WHITE };
    const tiles = NAMES.map((name, i) => {
      const g = grp(C3, PCX + TX(i), PCY);
      const bgT = box(g, 0, 0, TW, TH, { borderRadius: '22px', boxSizing: 'border-box' });
      const pv = grp(g, 0, -20);
      if (i === 0) { [[50, -8, 22], [56, 6, 14]].forEach(([x, y, w]) => box(pv, x, y, w, 4, { borderRadius: '2px', background: 'rgba(255,255,255,0.35)' })); txt(pv, 'אב', Object.assign({}, GL, { x: -6 })); }
      if (i === 1) txt(pv, 'אב', Object.assign({}, GL, { css: { filter: 'blur(3px)' } }));
      if (i === 2) { box(pv, 0, 0, 78, 60, { borderRadius: '10px', border: '1.5px solid rgba(255,255,255,0.28)', boxSizing: 'border-box' }); txt(pv, 'אב', Object.assign({}, GL, { size: 32 })); }
      if (i === 3) { box(pv, 0, 30, 46, 8, { borderRadius: '50%', background: 'rgba(255,255,255,0.18)' }); txt(pv, 'אב', Object.assign({}, GL, { y: -10 })); }
      if (i === 4) { txt(pv, 'א', Object.assign({}, GL, { x: 14 })); txt(pv, 'ב', Object.assign({}, GL, { x: -16, y: 10, css: { opacity: 0.45 } })); }
      const lab = txt(g, name, Object.assign({}, UI, { size: 25, y: 44 }));
      return { g, bgT, lab };
    });
    const BIG = Object.assign({}, HB, { size: Math.min(210, fit('בלחיצה אחת', HB, 840)), y: LY.bigY, color: C.WHITE });
    BIG.gap = BIG.size * 0.24;
    const BV = [0, 1, 2, 3].map(() => { const r = row(C3, ['בלחיצה', 'אחת'], BIG); r[1].g.inner.style.color = C.CORAL; return r; });
    // the letter-by-letter copy: one letters() group per word, at the same places as the word copies
    const BL = BV[0].map((w, k) => { const g = letters(C3, k ? 'אחת' : 'בלחיצה', Object.assign({}, BIG, { x: w.cx })); if (k) g.spans.forEach(s => { s.style.color = C.CORAL; }); return g; });
    const BLS = BL.flatMap(g => g.spans);
    T_STYLES.forEach(c => sfx(c, 'click', 0.7));
    sfx(T_OUT3, 'swish', 0.4);

    // ================= scene 5: the logo =================
    const logoG = grp(cam, 0, LY.logoY);
    const BUBBLE = 'M184 116H328A100 100 0 0 1 428 216V256A100 100 0 0 1 328 356H224L152 404C141 411 128 402 132 389L144 349C106 333 84 298 84 256V216A100 100 0 0 1 184 116Z';
    const LS = 520;
    const lgGlow = svgEl('svg', logoG, { viewBox: '0 0 512 512', width: LS, height: LS });
    lgGlow.style.cssText = `position:absolute;left:${-LS / 2}px;top:${-LS / 2}px;overflow:visible;filter:blur(46px)`;
    svgEl('path', lgGlow, { d: BUBBLE, fill: C.BLUE });
    const lg = svgEl('svg', logoG, { viewBox: '0 0 512 512', width: LS, height: LS });
    lg.style.cssText = `position:absolute;left:${-LS / 2}px;top:${-LS / 2}px;overflow:visible`;
    const defs = svgEl('defs', lg), lgr = svgEl('linearGradient', defs, { id: 'csBlueM', x1: 0, y1: 0, x2: 1, y2: 1 });
    svgEl('stop', lgr, { offset: 0, 'stop-color': C.LOGO1 }); svgEl('stop', lgr, { offset: 1, 'stop-color': C.LOGO2 });
    svgEl('path', lg, { d: BUBBLE, fill: 'url(#csBlueM)' });
    const pulse = svgEl('path', lg, { d: 'M134 236H186L212 172L250 304L280 200L298 236H378', fill: 'none', stroke: '#fff', 'stroke-width': 24, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const pulseL = pulse.getTotalLength();
    pulse.setAttribute('stroke-dasharray', `${pulseL} ${pulseL}`);
    const barL = svgEl('path', lg, { d: 'M298 288H350', stroke: '#fff', 'stroke-opacity': 0.55, 'stroke-width': 24, 'stroke-linecap': 'round' });
    const dotG = grp(cam, 0, LY.logoY);
    const dotGlow = box(dotG, 0, 0, 260, 260, { borderRadius: '50%', background: `radial-gradient(closest-side, ${rgba(C.LOGO1, 0.9)}, ${rgba(C.BLUE, 0.35)} 40%, ${rgba(C.BLUE, 0)})` });
    const dot = box(dotG, 0, 0, 30, 30, { borderRadius: '50%', background: C.WHITE, boxShadow: `0 0 30px ${C.WHITE}` });
    const wm = txt(cam, '', { font: F.HEEBO, weight: 800, size: 150, dir: 'ltr', ls: 0.01, y: LY.wordY, color: C.WHITE });
    wm.inner.innerHTML = `CS <span style="color:${C.BLUE}">TRIM</span>`;
    const lnS = Math.min(84, fit('חינם · Mac · Windows', { font: F.HEEBO, weight: 600 }, 760));
    const ln = txt(cam, '', { font: F.HEEBO, weight: 600, size: lnS, y: LY.lineY, color: C.GREY });
    ln.inner.innerHTML = `<span style="color:${C.WHITE};font-weight:800">חינם</span> · Mac · Windows`;
    const cO = { font: F.HEEBO, weight: 700, size: 64, color: C.WHITE };
    const ctaT = 'הורדה: cstrim.site', ctw = measure(ctaT, cO).w, cbw = ctw + 140, cbh = 136;
    const cta = grp(cam, 0, LY.btnY);
    const ctaGlow = box(cta, 0, 18, cbw - 40, cbh, { borderRadius: px(cbh / 2), background: `linear-gradient(90deg, ${C.VIOLET}, ${C.BLUE})`, filter: 'blur(34px)' });
    const ctaB = box(cta, 0, 0, cbw, cbh, { borderRadius: px(cbh / 2), overflow: 'hidden', background: `linear-gradient(135deg, ${C.VIOLET}, ${C.BLUE})`, boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.4)' });
    const shine = rect(ctaB, 0, -20, 90, cbh + 40, { background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.45), rgba(255,255,255,0))', transform: 'skewX(-20deg)' });
    txt(cta, ctaT, Object.assign({}, cO, { y: 2 }));
    sfx(T_CONV - 0.15, 'rise', 0.45);
    sfx(T_LOGO, 'sparkle', 0.8);
    sfx(16.5, 'tick', 0.4);
    sfx(17.0, 'tick', 0.35);
    sfx(17.5, 'pop', 0.6);
    sfx(18.4, 'sparkle', 0.25);

    // ================= cursor (above everything in the camera) =================
    const cur = cursor(cam, 54, C.WHITE, C.INK);
    const TILE_AT = i => [PCX + TX(i) + 48, PCY - 30];   // top right of the tile, so the cursor never covers the label
    const curT = track([440, 980], [
      [2.78, [BTN[0] + 22, BTN[1] + 10], 11, 0.95], [3.72, [440, 560], 8, 1],
      [11.2, [430, 820], 30, 1], [11.62, TILE_AT(0), 12, 0.95],
      ...T_STYLES.slice(1).map((c, i) => [c - 0.33, TILE_AT(i + 1), 13, 0.95]),
    ]);
    const CLICKS = [T_CLICK, ...T_STYLES];

    // ================= foreground bokeh (parallax 1.7, soft depth of field) =================
    const fg = grp(root, W / 2, H / 2);
    const BOK = [[-470, -820, 60, C.VIOLET, 0.16, 22], [470, -640, 40, C.BLUE, 0.14, 16], [-505, 260, 52, C.BLUE, 0.12, 20],
      [495, 720, 72, C.VIOLET, 0.13, 26], [-390, 870, 34, C.WHITE, 0.08, 14], [430, -920, 28, C.WHITE, 0.08, 12], [520, 140, 26, C.VIOLET, 0.12, 12]];
    const bok = BOK.map(([x, y, r, col, a]) => box(fg, x, y, 2.6 * r, 2.6 * r, { borderRadius: '50%', background: `radial-gradient(closest-side, ${rgba(col, a)}, ${rgba(col, a * 0.6)} 55%, ${rgba(col, 0)})` }));

    // ================= film grain (static, over everything) =================
    const gctx = canvas2d(root, 0, 0, W, H);
    const img = gctx.createImageData(W, H), R = rng(7);
    for (let i = 0; i < img.data.length; i += 4) { const v = R() < 0.5 ? 0 : 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = Math.floor(R() * 10); }
    gctx.putImageData(img, 0, 0);

    // =====================================================================================
    return t => {
      // camera and parallax layers
      const z = camZ(t) * (1 + 0.03 * t / DUR), [dx, dy, dr] = drift(t);
      tf(cam, { x: dx, y: dy + camY(t), s: z, r: dr });
      tf(bg, { x: dx * 0.35, y: dy * 0.35, s: 1 + (z - 1) * 0.35 });
      tf(fg, { x: dx * 1.7, y: dy * 1.7, s: 1 + (z - 1) * 1.7 });
      tf(grid, { o: 0.9 + 0.1 * Math.sin(t * 0.9) });
      const [ax, ay] = gAp(t), [bx, by] = gBp(t);
      tf(gA, { x: ax + 30 * vnoise(t * 0.2, 21), y: ay + 30 * vnoise(t * 0.17, 23), o: 0.92 + 0.08 * Math.sin(t * 1.3) });
      tf(gB, { x: bx + 30 * vnoise(t * 0.18, 25), y: by + 30 * vnoise(t * 0.21, 27), s: 1 - 0.25 * sp(t, T_CONV, 5) });
      bok.forEach((b, i) => tf(b, { x: 40 * vnoise(t * 0.12 + i, 40 + i), y: 50 * vnoise(t * 0.1 + i, 60 + i), o: 1 - 0.6 * sp(t, T_CONV, 6), blur: BOK[i][5] }));

      // ---------- scene 1 title ----------
      TL.forEach((w, i) => wordIO(w.g, t, T_TITLE[i], 3.0 + 0.045 * i, 44));

      // ---------- panel ----------
      const pIn = sp(t, -0.2, 13);
      const pOut = S(t - T_MATCH, 7, 1);
      if (tf(panel, { s: (0.965 + 0.035 * pIn) * (1 + 0.3 * pOut), y: 24 * (1 - pIn), o: ramp(t, -0.16, 0.24) * (1 - ramp(t, T_MATCH + 0.05, 0.35)), blur: 13 * pOut })) {
        [gH, gR, gT, gV, gA1, gO].forEach((g, i) => { const d = 0.07 * i - 0.14; tf(g, { y: 16 * (1 - sp(t, d, 18)), o: ramp(t, d, 0.16) }); });
        // segments ripple
        let x = CX0;
        const det = s => sp(t, s.tg, 30);
        for (const s of segs) {
          const w = s.kind === 'g' ? s.w0 * (1 - S(t - s.tc, 16, 1)) : s.w0;
          css(s.v, { left: px(x), width: px(Math.max(0, w)) }); css(s.a, { left: px(x), width: px(Math.max(0, w)) });
          if (s.kind === 'g') {
            const vis_ = clamp(w / 8, 0, 1);
            on(s.v, w > 0.5); on(s.a, w > 0.5);
            css(s.line, { width: px(Math.max(0, w)) });
            const k = det(s);
            css(s.ov, { left: px(x), width: px(Math.max(0, w)), background: rgba(C.CORAL, lerp(0.10, 0.24, k)), border: `1.5px solid ${rgba(C.CORAL, lerp(0.7, 1, k))}` });
            tf(s.ov, { o: vis_ });
          } else if (s.seam) {
            css(s.seam, { left: px(x - 1) }); css(s.flash, { left: px(x - 1.5) });
            tf(s.seam, { o: sp(t, s.tc + 0.1, 20) });
            tf(s.flash, { o: 0.9 * bump(t, s.tc + 0.12, 0.04, 40, 9) });
          }
          x += w;
        }
        on(clip.v, t < T_MATCH);
        // header: timecode, duration, button
        const ph = phX(t), secs = (ph - CX0) / CW * 2892;
        const ff = Math.floor((secs % 1) * 25), ss = Math.floor(secs) % 60, mm = Math.floor(secs / 60);
        tc.inner.textContent = `00:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
        tf(gP, { x: ph, o: ramp(t, 0.3, 0.12) * (1 - ramp(t, 3.3, 0.12)) });
        durV.inner.textContent = `${48 - Math.round(12 * closed(t))}:12`;
        tf(btnG, { s: 1 - 0.07 * bump(t, T_CLICK - 0.04, 0.06) });
        tf(btnGlow, { o: 0.45 + 0.35 * bump(t, T_CLICK, 0.25, 20, 5), blur: 18 });
        const rk = sp(t, T_CLICK, 9);
        tf(ring, { s: 1 + 0.35 * rk, o: t >= T_CLICK ? 1 - rk : 0 });
        tf(gS, { x: scanX(t), o: ramp(t, T_SCAN[0], 0.05) * (1 - ramp(t, T_SCAN[1] - 0.02, 0.07)) });
      }

      // ---------- scene 2 "חסכת 12 דקות" ----------
      wordIO(sv1, t, T_SAVE, T_MATCH - 0.05, 40);
      const n = Math.round(countK(t));
      numG.inner.textContent = String(n);
      wordIO(numG, t, T_SAVE + 0.07, T_MATCH, 40, { s: 1 + 0.1 * bump(t, T_COUNT[1], 0.05, 30, 12) });
      wordIO(dakG, t, T_SAVE + 0.14, T_MATCH + 0.05, 40);

      // ---------- morph box ----------
      const [mx, my, mw, mh, mr] = mbT(t);
      const mOn = t >= T_MATCH && t < T_CONV + 0.5;
      if (on(mbox, mOn)) {
        place(mbox, mx - mw / 2, my - mh / 2, mw, mh); mbox.style.borderRadius = px(mr);
        place(mShadow, mx - mw / 2, my - mh / 2 + 30, mw, mh); mShadow.style.borderRadius = px(mr);
        tf(mShadow, { o: ramp(t, T_MATCH + 0.1, 0.3), blur: 40 });   // tf owns the filter: the blur goes here
        tf(lClip, { o: 1 - ramp(t, T_MATCH + 0.1, 0.3) });
        tf(lVid, { o: ramp(t, T_MATCH + 0.15, 0.35) * (1 - ramp(t, T_OUT3 + 0.05, 0.25)) });
        tf(lGlass, { o: ramp(t, T_OUT3 + 0.1, 0.25) });
        tf(mBorder, { o: ramp(t, T_MATCH + 0.15, 0.3) });
        place(winGlow, mx - mw * 0.8, my - mh * 0.75, mw * 1.6, mh * 1.5);
        tf(winGlow, { o: 0.55 * ramp(t, T_MATCH + 0.2, 0.4) * (1 - ramp(t, T_OUT3, 0.3)) });
        // video content
        tf(bl1, { x: 90 * vnoise(t * 0.35, 71), y: 70 * vnoise(t * 0.3, 72) });
        tf(bl2, { x: 80 * vnoise(t * 0.3, 73), y: 90 * vnoise(t * 0.33, 74) });
        tf(bl3, { x: 60 * vnoise(t * 0.4, 75), y: 40 * vnoise(t * 0.36, 76) });
        let pulseK = 0;
        T_WORDS.forEach((tw, k) => {
          pulseK += bump(t, tw, 0.05, 30, 10);
          const u = sp(t, tw, 5);
          tf(orbRings[k], { s: 1 + 1.3 * u, o: t >= tw ? 0.7 * (1 - u) : 0 });
        });
        tf(orb, { s: (1 + 0.03 * Math.sin(t * 2.4)) * (1 + 0.12 * pulseK) });
        barF.style.width = f2(100 * seg(t, 7.0, 12.0)) + '%';
      } else { on(mShadow, false); on(winGlow, false); }

      // ---------- scene 3 heading + caption ----------
      HDW.forEach((w, i) => wordIO(w.g, t, 6.95 + 0.07 * i, T_OUT3 - 0.12 + 0.04 * i, 36));
      CAP.forEach((w, k) => {
        const t0 = T_WORDS[k], t1 = k < 4 ? T_WORDS[k + 1] : T_WORDS_END;
        const act = ramp(t, t0, 0.05) * (1 - ramp(t, t1, 0.14));
        w.g.inner.style.color = mixc(C.WHITE, C.CORAL, act);
        w.g.inner.style.textShadow = `0 6px 28px rgba(0,0,0,0.45), 0 0 34px ${rgba(C.CORAL, 0.45 * act)}`;
        wordIO(w.g, t, t0, T_OUT3 - 0.1 + 0.035 * k, 26, { s: 1 + 0.13 * bump(t, t0, 0.07, 30, 12) });
      });

      // ---------- scene 4 tiles + styles ----------
      tiles.forEach((tl, i) => {
        const c = T_STYLES[i], cn = T_STYLES[i + 1] ?? T_CONV;
        const act = ramp(t, c, 0.06) * (1 - ramp(t, cn, 0.08));
        css(tl.bgT, { background: `linear-gradient(${rgba(C.VIOLET, 0.22 * act)}, ${rgba(C.VIOLET, 0.22 * act)}), rgba(255,255,255,0.045)`, border: `1.5px solid ${act > 0.01 ? rgba(C.VIOLET, 0.25 + 0.65 * act) : 'rgba(255,255,255,0.09)'}` });
        tl.lab.inner.style.color = mixc(C.GREY, C.WHITE, act);
        const r = rise(t, 11.82 + 0.07 * i, 30);
        tf(tl.g, { y: r.y, o: r.o, s: 1 - 0.06 * bump(t, c - 0.03, 0.06) });
      });
      const exitK = (t, c1) => ramp(t, c1 - 0.03, 0.09);
      BV.forEach((ws, i) => {
        const c = T_STYLES[i], c1 = T_STYLES[i + 1];
        ws.forEach((w, j) => {
          const t0 = c + 0.06 + 0.07 * j, ex = exitK(t, c1), base = { o: t >= t0 ? 1 - ex : 0, blur: 8 * ex, s: 1 - 0.03 * ex };
          if (t < t0 - 0.01 || t > c1 + 0.08) { tf(w.g, { o: 0 }); return; }
          if (i === 0) {   // both words slide in together from the right; the second on a slightly softer spring, never overlapping
            const X = tt => 140 * (1 - S(tt - c - 0.06, j ? 18 : 22, 1));
            tf(w.g, Object.assign(base, { x: X(t), o: base.o * ramp(t, t0, 0.1), mb: [vel(X, t), 0] }));
          } else if (i === 1) {
            const k = S(t - t0, 15, 1);
            tf(w.g, Object.assign(base, { blur: 26 * (1 - k) + base.blur, o: base.o * ramp(t, t0, 0.16), s: base.s * (1 + 0.07 * (1 - k)) }));
          } else if (i === 2) {
            tf(w.g, Object.assign(base, { s: base.s * (0.35 + 0.65 * S(t - t0, 18, 0.75)), o: base.o * ramp(t, t0, 0.08) }));
          } else {
            const Y = tt => -230 * Math.abs(1 - S(tt - t0, 15, 0.32));
            tf(w.g, Object.assign(base, { y: Y(t), o: base.o * ramp(t, t0, 0.08), mb: [0, vel(Y, t)] }));
          }
        });
      });
      const c4 = T_STYLES[4];
      BL.forEach(g => tf(g, { o: t >= c4 ? 1 : 0 }));
      if (t >= c4) BLS.forEach((s, j) => { const r = rise(t, c4 + 0.06 + 0.04 * j, 34); tf(s, { y: r.y, o: r.o }); });

      // ---------- converge (15.55) ----------
      const cv = S(t - T_CONV, 12, 1);
      tf(g4, { s: 1 - 0.82 * cv, o: 1 - ramp(t, T_CONV + 0.08, 0.27), blur: 12 * cv });
      tf(dotG, { o: ramp(t, T_CONV + 0.05, 0.2) * (1 - ramp(t, T_LOGO + 0.05, 0.3)), s: (0.3 + 0.9 * sp(t, T_CONV, 10)) * (1 + 2.2 * sp(t, T_LOGO, 9)) });
      tf(dot, { s: 1 - 0.6 * sp(t, T_LOGO, 12) });

      // ---------- logo end card ----------
      const lk = S(t - T_LOGO, 13, 0.72);
      if (tf(logoG, { s: 0.25 + 0.75 * lk, o: ramp(t, T_LOGO, 0.1) })) {
        tf(lgGlow, { o: 0.6 * sp(t, T_LOGO, 7) * (0.88 + 0.12 * Math.sin((t - T_LOGO) * 2.2)), blur: 46 });
        pulse.setAttribute('stroke-dashoffset', f2(pulseL * (1 - S(t - 16.12, 11, 1))));
        barL.style.transformOrigin = '298px 288px';
        barL.style.transform = `scaleX(${f2(S(t - 16.5, 16, 0.85))})`;
        barL.style.opacity = t >= 16.5 ? 1 : 0;
      }
      wordIO(wm, t, 16.5, 99, 40);
      wordIO(ln, t, 17.0, 99, 36);
      const ck = S(t - 17.5, 16, 0.7);
      if (tf(cta, { s: 0.88 + 0.12 * ck, o: ramp(t, 17.5, 0.1) })) {
        tf(ctaGlow, { o: 0.45 * sp(t, 17.5, 8) * (0.85 + 0.15 * Math.sin((t - 17.5) * 2.6)), blur: 34 });
        tf(shine, { x: lerp(-140, cbw + 60, E.io3(seg(t, 18.4, 19.1))), skx: -20, o: t >= 18.4 && t < 19.1 ? 1 : 0 });
      }

      // ---------- cursor ----------
      const [cx, cy] = curT(t);
      let press = 1; for (const c of CLICKS) press -= 0.14 * bump(t, c - 0.04, 0.05);
      const co = Math.max(ramp(t, 2.8, 0.12) * (1 - ramp(t, 3.7, 0.15)), ramp(t, 11.5, 0.12) * (1 - ramp(t, T_CONV - 0.1, 0.15)));
      tf(cur, { x: cx, y: cy, s: press, o: co });
    };
  });
})();
