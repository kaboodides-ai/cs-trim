// scene.js v2: CS Trim promo in the style of the references: black, soft coloured light, the real plugin panel at the
// centre, one element that keeps changing shape, 3D tilts, letters that come in from a blur. 20 s at 120 BPM.
// music_edit.wav is the song from 4.022 s, so the drop lands on t = 4.0.
//   0-3      hook: a waveform with flat silences; "מתעצבנים על שתיקות בעריכה?" blurs in letter by letter
//   3-4      the waveform contracts into the pulse line of the logo
//   4-5      on the drop the bubble closes around it: the logo and "CS TRIM"
//   5-6.5    the bubble opens into the plugin panel (silence tab); the cursor picks "גבוה" and clicks "חיתוך שקט"
//   6.5-8.8  the button opens into a timeline, the silences close, "חסכת 12 דקות"
//   8.8-12.3 captions tab: marker on, orange swatch, "יצירת כתוביות"; the button opens into a video, words + gliding marker
//   12.3-15.8 animations tab: the four real styles; "בלחיצה אחת" replays in each
//   15.8-20  the panel folds back into the logo; "CS TRIM", "חינם · Mac · Windows", "הורדה: cstrim.site"
// World px: 0,0 is the frame centre. The panel is built at its real CSS size (310 px wide) and scaled by K.
(() => {
  'use strict';
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;
  const mixc = (a, b, k) => { const A = hex(a), B = hex(b); k = clamp(k, 0, 1); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; };
  const css = (el, o) => Object.assign(el.style, o);
  const px = v => f2(v) + 'px';
  const place = (el, x, y, w, h) => css(el, { left: px(x), top: px(y), width: px(w), height: px(h) });
  const ramp = (t, t0, d = 0.08) => clamp((t - t0) / d, 0, 1);
  const bump = (t, t0, hold = 0.06, a = 34, b = 13) => S(t - t0, a, 1) - S(t - t0 - hold, b, 1);   // 0 -> 1 -> 0
  const kick = (t, t0, a = 14, b = 7, d = 0.16) => S(t - t0, a, 1) - S(t - t0 - d, b, 1);          // a soft 0 -> 1 -> 0 for tilts
  const HB = { font: F.HEEBO, weight: 800, ls: -0.01 };
  const K = 2.2, PNW = 310;
  const TL_W = 920, TL_H = 440, VD_W = 680, VD_H = 980;

  const T = {
    t1: 0.3, t2: 0.8, tOut: 2.85, wave: 3.05, logo: 4.0, wm: 4.25, wmOut: 4.8, open: 5.0,
    sens: 6.0, cut: 6.5, gaps: 7.2, count: [7.35, 8.2], close1: 8.45,
    tab1: 8.9, toggle: 9.3, swatch: 9.65, create: 10.0, words: [10.4, 10.6, 10.8, 11.0, 11.2], close2: 12.3,
    tab2: 12.65, tiles: [13.0, 13.75, 14.5, 15.25], fold: 15.75, logo2: 16.25, wm2: 16.5, line: 17.0, cta: 17.5,
  };

  // ---------- Apple style text: every letter comes in from a blur, in reading order ----------
  // words: [[string, color, dir]] laid out right to left like row(); Latin words keep their own letter order.
  // o.ltr: a Latin line ("CS TRIM"): the first word sits on the LEFT
  function blurWords(parent, words, o) {
    const r = row(parent, (o.ltr ? words.slice().reverse() : words).map(w => w[0]), o);
    if (o.ltr) r.reverse();
    const spans = [];
    r.forEach((w, k) => {
      w.g.inner.textContent = '';
      w.g.inner.style.direction = words[k][2] || 'rtl';
      [...words[k][0]].forEach(ch => {
        const s = document.createElement('span'); s.textContent = ch;
        css(s, { display: 'inline-block', whiteSpace: 'pre', color: words[k][1] || o.color || C.WHITE });
        w.g.inner.appendChild(s); spans.push(s);
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
  // a whole element blurs in at t0 and out at t1
  const blurEl = (el, t, t0, t1 = 1e9, extra = {}) => {
    const k = S(t - t0, 16, 1), ko = ramp(t, t1, 0.16);
    return tf(el, Object.assign({ o: ramp(t, t0, 0.16) * (1 - ko), blur: 14 * (1 - k) + 12 * ko, y: 26 * (1 - k) - 14 * ko }, extra));
  };

  // ---------- the logo (from img/logo-mark.svg) ----------
  const BUBBLE = 'M184 116H328A100 100 0 0 1 428 216V256A100 100 0 0 1 328 356H224L152 404C141 411 128 402 132 389L144 349C106 333 84 298 84 256V216A100 100 0 0 1 184 116Z';
  const PULSE = [[134, 236], [186, 236], [212, 172], [250, 304], [280, 200], [298, 236], [378, 236]];
  const PULSE_D = 'M' + PULSE.map(p => p.join(' ')).join('L');
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

  // ---------- the panel's own styles (css/style.css of the plugin, scoped, without transitions) ----------
  const PST = document.createElement('style');
  PST.textContent = `
  .pn{position:absolute;width:${PNW}px;background:${C.PN_BG};border:1px solid ${C.PN_LINE};border-radius:12px;overflow:hidden;color:${C.PN_TX};font-family:Heebo;font-size:12px;font-weight:500;line-height:1.45;direction:rtl;box-sizing:border-box;padding:0 12px;-webkit-font-smoothing:antialiased}
  .pn *{box-sizing:border-box}
  .pn .hd{position:relative;display:flex;align-items:center;justify-content:space-between;height:44px}
  .pn .brand{display:flex;align-items:center;gap:7px}
  .pn .bname{font-size:13px;font-weight:700;letter-spacing:-0.01em;direction:ltr}
  .pn .acts{display:flex;gap:2px;align-items:center}
  .pn .ib{position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:${C.PN_TX2}}
  .pn .badge{position:absolute;top:1px;right:1px;min-width:13px;height:13px;border-radius:7px;background:${C.PN_S3};color:${C.PN_TX};font-size:8.5px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 3px;line-height:1}
  .pn .ctx{position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px;height:30px;padding:0 10px;margin-bottom:10px;background:${C.PN_S1};border:1px solid ${C.PN_LINE};border-radius:7px}
  .pn .seq{display:flex;align-items:center;gap:6px;font-size:11.5px;color:${C.PN_TX};white-space:nowrap}
  .pn .stat{display:inline-flex;align-items:center;gap:5px;color:${C.PN_TX2};font-size:11px}
  .pn .dot{width:6px;height:6px;border-radius:50%;background:${C.OK};box-shadow:0 0 0 2px ${rgba(C.OK, 0.12)}}
  .pn .tabs{position:relative;display:grid;grid-template-columns:repeat(3,1fr);margin-bottom:14px;border-bottom:1px solid ${C.PN_LINE}}
  .pn .tab{display:flex;align-items:center;justify-content:center;gap:5px;height:34px;color:${C.PN_TX2};font-size:12px;font-weight:600;white-space:nowrap}
  .pn .beta{font-size:9px;font-weight:600;line-height:1;padding:2px 4px;border-radius:3px;background:${C.PN_S2};color:${C.PN_TX3};direction:ltr}
  .pn .tabbar{position:absolute;bottom:-1px;left:0;height:2px;border-radius:2px 2px 0 0;background:${C.ACC}}
  .pn .views{position:relative}
  .pn .view{position:absolute;left:0;right:0;top:0}
  .pn .stitle{font-size:11px;font-weight:600;color:${C.PN_TX3};margin:0 2px 6px}
  .pn .sec{margin-bottom:14px}
  .pn .seg{position:relative;display:flex;gap:2px;padding:2px;background:${C.PN_BG};border:1px solid ${C.PN_LINE};border-radius:7px}
  .pn .seg>span{position:relative;flex:1 1 0;height:30px;display:flex;align-items:center;justify-content:center;padding:0 6px;color:${C.PN_TX2};font-size:12px;font-weight:500;white-space:nowrap}
  .pn .seg.sm>span{height:26px;font-size:11.5px;padding:0 10px}
  .pn .seg .knob{position:absolute;top:2px;bottom:2px;left:0;border-radius:5px;background:${C.PN_S3};box-shadow:0 1px 2px rgba(0,0,0,.35)}
  .pn .hint{color:${C.PN_TX3};font-size:11px;line-height:1.5;margin:6px 2px 0;white-space:nowrap}
  .pn .actions{position:relative;display:flex;flex-direction:column;gap:6px}
  .pn .btn{position:relative;width:100%;height:36px;display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid transparent;border-radius:7px;font-size:12.5px;font-weight:600;white-space:nowrap}
  .pn .bp{background:${C.ACC};color:#fff}
  .pn .bs{background:${C.PN_S2};border-color:${C.PN_LINE2};color:${C.PN_TX}}
  .pn .bglow{position:absolute;left:6px;right:6px;top:4px;height:36px;border-radius:9px;background:${C.ACC}}
  .pn .card{background:${C.PN_S1};border:1px solid ${C.PN_LINE};border-radius:10px;padding:0 10px}
  .pn .card>*+*{border-top:1px solid ${C.PN_LINE}}
  .pn .row{position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:42px;padding:6px 0;white-space:nowrap}
  .pn .row>label,.pn .hl>span:first-child{color:${C.PN_TX};font-size:12px;font-weight:500}
  .pn .hl{display:inline-flex;align-items:center;gap:7px}
  .pn .pill{padding:1px 6px;border-radius:3px;color:#111;font-size:10.5px;font-weight:700}
  .pn .sw{position:relative;width:30px;height:18px;border-radius:9px;border:1px solid ${C.PN_LINE2};background:${C.PN_S3}}
  .pn .sw.on{background:${C.ACC};border-color:${C.ACC}}
  .pn .sw>i{position:absolute;top:2px;right:2px;width:12px;height:12px;border-radius:50%;background:#BDBDBD}
  .pn .sw.on>i{right:14px;background:#fff}
  .pn .sl{flex:0 1 170px;display:flex;align-items:center;gap:8px}
  .pn .sbadge{flex-shrink:0;min-width:48px;height:22px;padding:0 6px;display:inline-flex;align-items:center;justify-content:center;background:${C.PN_S2};border-radius:5px;font-size:11px;font-weight:600}
  .pn .strk{position:relative;flex:1;height:4px;border-radius:2px;background:linear-gradient(to right,${C.ACC} 28.57%,${C.PN_S3} 28.57%)}
  .pn .sthumb{position:absolute;top:-5px;left:calc(28.57% - 7px);width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.5)}
  .pn .sws{position:relative;display:flex;align-items:center;gap:5px;direction:ltr}
  .pn .swc{position:relative;width:18px;height:18px;border-radius:50%}
  .pn .swc.custom{background:conic-gradient(#EF4444,#F59E0B,#10B981,#3B82F6,#8B5CF6,#EC4899,#EF4444);color:#fff;font-size:12px;font-weight:700;line-height:18px;text-align:center;text-shadow:0 0 3px rgba(0,0,0,.7)}
  .pn .ring{position:absolute;top:-3.5px;left:-3.5px;width:25px;height:25px;border-radius:50%}
  .pn .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  .pn .tile{position:relative;overflow:hidden;background:${C.PN_BG};border:1px solid ${C.PN_LINE};border-radius:10px}
  .pn .vp{height:110px;padding-bottom:18px;display:flex;align-items:center;justify-content:center}
  .pn .smp{padding:6px 16px;border-radius:6px;background:${C.PN_S3};color:#fff;font-size:16px;font-weight:700}
  .pn .nm{position:absolute;left:0;right:0;bottom:0;padding:5px 4px 6px;font-size:11.5px;line-height:1.3;color:${C.PN_TX2};text-align:center;background:linear-gradient(to top,rgba(0,0,0,.55),transparent)}
  .pn .ft{position:absolute;left:12px;right:12px;bottom:4px;height:36px;display:flex;align-items:center;justify-content:space-between;color:${C.PN_TX3};font-size:10.5px}
  .pn .cred{direction:ltr}
  .pn .ver{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 7px;border:1px solid ${C.PN_LINE};border-radius:11px;color:${C.PN_TX3};font-family:'JetBrains Mono';font-size:10px;direction:ltr}
  `;
  document.head.appendChild(PST);
  const ICON = (d, s = 15, w = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const MARK = `<svg width="20" height="20" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0E1117"/><path d="${BUBBLE}" fill="${C.LOGO1}"/><path d="${PULSE_D}" fill="none" stroke="#fff" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const SWATCHES = ['#FACC15', '#22C55E', '#2563EB', '#EC4899', C.WARM, '#A855F7'];
  const STYLES = ['פופ', 'החלקה למעלה', 'זום', 'עמעום'];
  const PANEL_HTML = `
  <div class="hd"><div class="brand">${MARK}<span class="bname">CS Trim</span></div>
    <div class="acts"><span class="ib">${ICON('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>')}</span><span class="ib">${ICON('<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>')}<span class="badge">4</span></span></div></div>
  <div class="ctx"><div class="seq"><span style="color:${C.PN_TX3};display:flex">${ICON('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20M7 4v5M12 4v5M17 4v5"/>', 13)}</span><span>ראיון פרק 3</span></div><div class="stat"><span class="dot"></span><span>מחובר</span></div></div>
  <div class="tabs"><div class="tab">חיתוך שקט</div><div class="tab">כתוביות</div><div class="tab">אנימציות<span class="beta">Beta</span></div><div class="tabbar"></div></div>
  <div class="views">
    <div class="view v0">
      <div class="sec"><div class="stitle">רגישות</div><div class="seg sens"><div class="knob"></div><span>רגיל</span><span>גבוה</span><span>אגרסיבי</span></div>
        <div class="hint">רגישות גבוהה יותר חותכת גם הפסקות קצרות בין משפטים.</div></div>
      <div class="actions"><div class="bglow"></div><div class="btn bp">חיתוך שקט</div><div class="btn bs">סימון שקט בלבד, בלי לחתוך</div></div>
    </div>
    <div class="view v1">
      <div class="sec"><div class="stitle">הגדרות</div><div class="card">
        <div class="row"><label>טווח</label><div class="seg sm"><div class="knob"></div><span>כל הסיקוונס</span><span>In / Out</span></div></div>
        <div class="row"><label>מילים בשורה</label><div class="sl"><span class="sbadge">3 מילים</span><div class="strk" dir="ltr"><div class="sthumb"></div></div></div></div>
        <div class="row"><label>סימני פיסוק</label><div class="sw on"><i></i></div></div>
      </div></div>
      <div class="sec"><div class="stitle">הדגשת מילים</div><div class="card">
        <div class="row"><span class="hl"><span>מרקר על המילה המדוברת</span><span class="pill">מרקר</span></span><div class="sw mk"><i></i></div></div>
        <div class="row rowc"><label>צבע</label><div class="sws"><div class="ring"></div>${SWATCHES.map(c => `<span class="swc" style="background:${c}"></span>`).join('')}<span class="swc custom">+</span></div></div>
      </div></div>
      <div class="actions"><div class="bglow"></div><div class="btn bp">יצירת כתוביות לכל הסיקוונס</div></div>
    </div>
    <div class="view v2">
      <div class="sec"><div class="stitle">סגנון</div><div class="grid">${STYLES.map(n => `<div class="tile"><div class="vp"><div class="smp">טקסט</div></div><span class="nm">${n}</span></div>`).join('')}</div></div>
      <div class="actions"><div class="bglow"></div><div class="btn bp">החל אנימציה</div></div>
    </div>
  </div>
  <div class="ft"><span class="cred">by Kaboodi</span><span class="ver">v1.0.14 ${ICON('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>', 11, 2)}</span></div>`;

  scene('main', 0, DUR, { bg: C.INK }, (root) => {
    // ================= background: soft coloured light on black (parallax 0.35) =================
    const bg = grp(root, W / 2, H / 2);
    const fog = (col, a, size) => box(bg, 0, 0, size, size, { borderRadius: '50%', background: `radial-gradient(closest-side, ${rgba(col, a)}, ${rgba(col, a * 0.38)} 45%, ${rgba(col, 0)} 100%)` });
    const fA = fog(C.VIOLET, 0.42, 1500), fB = fog(C.BLUE, 0.34, 1300), fC = fog(C.LOGO2, 0.3, 1100);
    const L1Y = -150, L2Y = -330;
    const fAp = track([-300, -620], [[3.2, [-140, L1Y - 60]], [T.open, [260, -560]], [T.tab1, [-280, -520]], [T.tab2, [280, -480]], [T.fold, [-120, L2Y - 40]]], 4, 1);
    const fBp = track([320, 420], [[3.2, [120, L1Y + 80]], [T.open, [-300, 420]], [T.tab1, [300, 380]], [T.tab2, [-260, 460]], [T.fold, [140, L2Y + 160]]], 4, 1);
    const fCp = track([0, 900], [[3.6, [0, L1Y]], [T.open, [0, 200]], [T.fold, [0, L2Y]]], 4, 1);
    const fogK = track(0.55, [[3.4, 1, 3, 1], [T.open, 0.8, 4, 1], [T.fold, 1, 3, 1]]);

    // ================= camera: slow pushes and a drift (it never stops) =================
    const cam = grp(root, W / 2, H / 2);
    const camZ = track(1, [[0, 1.05, 1.4, 1], [3.0, 0.99, 5, 1], [T.logo, 1.05, 1.8, 1], [T.open, 1.0, 5, 1], [T.fold, 1.0, 6, 1], [T.logo2, 1.05, 1.2, 1]]);
    const drift = t => [18 * vnoise(t * 0.16 + 0.3, 4), 14 * vnoise(t * 0.13 + 0.7, 9), 0.3 * vnoise(t * 0.1 + 0.2, 13)];

    // ================= 1. hook: waveform + title =================
    const tS = Math.min(124, fit('שתיקות בעריכה?', HB, 860));
    const TT1 = blurWords(cam, [['מתעצבנים'], ['על']], Object.assign({}, HB, { size: tS, y: -230, gap: tS * 0.24 }));
    const TT2 = blurWords(cam, [['שתיקות', C.WARM], ['בעריכה?']], Object.assign({}, HB, { size: tS, y: -230 + tS * 1.16, gap: tS * 0.24 }));
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
    const wave = svgEl('path', waveS, { fill: 'none', stroke: C.WHITE, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const drawK = t => E.o3(seg(t, -0.3, 0.75));   // already drawing on frame 0
    sfx(T.t1, 'tick', 0.3); sfx(T.t2, 'pop', 0.4); sfx(T.tOut, 'swish', 0.3); sfx(3.45, 'rise', 0.45);

    // ================= 2. logo lockup on the drop =================
    const burst = box(cam, 0, L1.body[1], 300, 300, { borderRadius: '50%', border: `2px solid ${rgba(C.LOGO1, 0.8)}`, boxSizing: 'border-box' });
    const WM1 = blurWords(cam, [['CS', C.WHITE, 'ltr'], ['TRIM', C.BLUE, 'ltr']], { font: F.HEEBO, weight: 800, ls: 0.01, size: 118, y: L1Y + 260, gap: 30, ltr: true });
    sfx(T.logo, 'sparkle', 0.7); sfx(T.wm, 'tick', 0.3);

    // ================= 3. the panel =================
    const pnEl = div(null, {}, 'pn');
    pnEl.innerHTML = PANEL_HTML;
    const q = s => pnEl.querySelector(s), qa = s => [...pnEl.querySelectorAll(s)];
    // the morph rect (logo <-> panel), under the panel
    const mPersp = grp(cam, 0, 0); mPersp.style.perspective = '2400px';
    const mTilt = grp(mPersp, 0, 0);
    const mR = div(mTilt, { overflow: 'hidden', boxSizing: 'border-box' });
    const mPulse = svgEl('svg', mR, { viewBox: '84 116 344 240', width: '100%', height: '100%' });
    mPulse.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
    svgEl('path', mPulse, { d: PULSE_D, fill: 'none', stroke: '#fff', 'stroke-width': 24, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    // panel hierarchy: pPersp (perspective, at the panel centre) > pTilt (tilt, recede) > pScale (K) > pnEl (310 px wide)
    const pShadow = div(cam, { borderRadius: '30px', background: 'rgba(0,0,0,0.6)' });
    const pPersp = grp(cam, 0, 0); pPersp.style.perspective = '2400px';
    const pTilt = grp(pPersp, 0, 0), pScale = grp(pTilt, 0, 0);
    pScale.appendChild(pnEl);
    css(pnEl, { left: px(-PNW / 2), top: '0px', height: '600px' });
    const hd = q('.hd'), ctx = q('.ctx'), tabs = q('.tabs'), views = q('.views'), ft = q('.ft');
    const V = qa('.view'), TABS = qa('.tab'), tabbar = q('.tabbar');
    const loc = el => { let x = 0, y = 0; while (el && el !== pnEl) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; } return [x, y]; };
    const rectOf = el => { const [x, y] = loc(el); return { x, y, w: el.offsetWidth, h: el.offsetHeight }; };
    const topH = loc(views)[1], VH = V.map(v => v.offsetHeight), PH = VH.map(h => topH + h + 14 + 40);
    const PTOP0 = -Math.round(K * PH[0] / 2) - 30, PTOP1 = -500;
    const PTOP = track(PTOP0, [[T.tab1, PTOP1, 12, 0.95]]);
    const PHt = track(PH[0], [[T.tab1, PH[1], 14, 0.9], [T.tab2, PH[2], 14, 0.9]]);
    const world = (el, ptop, fx = 0.5, fy = 0.5) => { const r = rectOf(el); return [K * (r.x + r.w * fx - PNW / 2), ptop + K * (r.y + r.h * fy)]; };
    const wrect = (el, ptop) => { const r = rectOf(el); return [K * (r.x + r.w / 2 - PNW / 2), ptop + K * (r.y + r.h / 2), K * r.w, K * r.h, 7 * K]; };
    const panelRect = (i, ptop) => [0, ptop + K * PH[i] / 2, K * PNW, K * PH[i], 12 * K];
    report('panel heights', PH.map(h => Math.round(h * K)).join(' / '));
    // segmented "רגישות": the knob glides from רגיל to גבוה
    const sens = qa('.sens > span'), sensKnob = q('.sens .knob');
    const sensR = sens.map(s => rectOf(s)), sensP = rectOf(q('.sens'));
    const knobX = track(sensR[0].x - sensP.x - 1, [[T.sens, sensR[1].x - sensP.x - 1, 22, 0.85]]);
    css(sensKnob, { width: px(sensR[0].w) });
    const segSm = q('.seg.sm'), smK = q('.seg.sm .knob'), smS = qa('.seg.sm > span');
    const smR = rectOf(smS[0]), smP = rectOf(segSm);
    css(smK, { left: px(smR.x - smP.x - 1), width: px(smR.w) }); smS[0].style.color = C.PN_TX; smS[0].style.fontWeight = 600;
    // tab indicator: 18% inset under the active tab, the leading edge on a faster spring
    const tabR = TABS.map(el => rectOf(el)), tabsP = rectOf(tabs);
    const barEdges = i => [tabR[i].x - tabsP.x + tabR[i].w * 0.18, tabR[i].x - tabsP.x + tabR[i].w * 0.82];
    const E0 = barEdges(0), E1 = barEdges(1), E2 = barEdges(2);
    const barL = track(E0[0], [[T.tab1, E1[0], 30, 0.9], [T.tab2, E2[0], 30, 0.9]]);
    const barR = track(E0[1], [[T.tab1, E1[1], 15, 0.9], [T.tab2, E2[1], 15, 0.9]]);
    // buttons
    const BTN = V.map(v => v.querySelector('.bp')), GLOW = V.map(v => v.querySelector('.bglow'));
    // captions view parts
    const mk = q('.sw.mk'), mkKnob = q('.sw.mk > i'), pill = q('.pill'), rowc = q('.rowc'), sws = qa('.swc'), ring = q('.ring');
    const swR = sws.map(s => rectOf(s)), swP = rectOf(q('.sws'));
    const ringX = track(swR[0].x - swP.x, [[T.swatch, swR[4].x - swP.x, 20, 0.85]]);
    // animation tiles
    const tiles = qa('.tile'), smps = qa('.smp'), nms = qa('.nm'), vps = qa('.vp');
    // world positions the cursor needs (panel at rest)
    const P_SENS = world(sens[1], PTOP0), P_CUT = world(BTN[0], PTOP0, 0.62, 0.6);
    const P_TAB1 = world(TABS[1], PTOP1), P_TOG = world(mk, PTOP1), P_SW = world(sws[4], PTOP1), P_CREATE = world(BTN[1], PTOP1, 0.62, 0.6);
    const P_TAB2 = world(TABS[2], PTOP1), P_TILES = tiles.map(el => world(el, PTOP1, 0.6, 0.45));
    const BTN0R = wrect(BTN[0], PTOP0), BTN1R = wrect(BTN[1], PTOP1);
    const RC = track(0, [[T.cut + 0.05, 1, 9, 1], [T.close1, 0, 10, 1], [T.create + 0.05, 1, 9, 1], [T.close2, 0, 10, 1]]);
    sfx(T.open, 'whoosh', 0.4);
    [T.sens, T.cut, T.tab1, T.toggle, T.swatch, T.create, T.tab2, ...T.tiles].forEach((c, i) => sfx(c, 'click', i === 1 || i === 5 ? 0.9 : 0.6));

    // ================= 4. the front card: button -> timeline -> button -> video -> button =================
    const TLR = [0, 40, TL_W, TL_H, 26], VDR = [0, 70, VD_W, VD_H, 34];
    const fPersp = grp(cam, 0, 0); fPersp.style.perspective = '2200px';
    const fTilt = grp(fPersp, 0, 0);
    const fShadow = div(fTilt, { background: 'rgba(0,0,0,0.6)' });
    const fR = div(fTilt, { overflow: 'hidden', boxSizing: 'border-box' });
    const center = (w, h) => ({ left: '50%', top: '50%', width: px(w), height: px(h), marginLeft: px(-w / 2), marginTop: px(-h / 2) });
    const tlC = div(fR, center(TL_W, TL_H)), vdC = div(fR, center(VD_W, VD_H));
    const fT = track(BTN0R, [[T.cut + 0.05, TLR, 11, 0.9], [T.close1, BTN0R, 13, 0.95], [T.create - 0.2, BTN1R, 400, 1], [T.create + 0.05, VDR, 11, 0.9], [T.close2, BTN1R, 13, 0.95]]);
    // --- timeline (card-local px) ---
    const MONO = { font: F.MONO, weight: 500, color: C.PN_TX2, dir: 'ltr' };
    const tlRows = [0, 1, 2, 3].map(() => grp(tlC, 0, 0));
    [36, 58, 80].forEach(x => box(tlRows[0], x, 40, 13, 13, { borderRadius: '50%', background: 'rgba(255,255,255,0.16)' }));
    txt(tlRows[0], 'ראיון פרק 3', { font: F.HEEBO, weight: 600, size: 26, color: C.PN_TX, x: TL_W - 36, y: 41, align: 'r' });
    txt(tlRows[0], 'משך', { font: F.HEEBO, weight: 500, size: 24, color: C.PN_TX3, x: 520, y: 41 });
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
    let x0 = CX0, gi = 0;
    const segs = SEG.map(([kind, w0], k) => {
      const ends = k === 0 ? '10px 0 0 10px' : k === SEG.length - 1 ? '0 10px 10px 0' : '0';
      const s = { kind, w0, x0 };
      s.v = rect(tlRows[2], x0, 124, w0, 92, { background: vFill, backgroundPosition: `${-(x0 - CX0)}px 0`, borderRadius: ends, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)' });
      s.a = rect(tlRows[3], x0, 232, w0, 160, { background: rgba(C.ACC, 0.14), borderRadius: ends, boxShadow: `inset 0 1px 0 ${rgba(C.ACC, 0.4)}`, overflow: 'hidden' });
      if (kind === 's') {
        const sv = svgBox(s.a, 0, 0, w0, 160), n = Math.floor((w0 - 6) / 6);
        for (let i = 0; i < n; i++) {
          const u = (i + 0.5) / n, env = Math.pow(Math.sin(Math.PI * u), 0.55) * (0.62 + 0.38 * Math.abs(Math.sin(i * 0.83 + k * 1.7)));
          const h = 4 + 116 * env * (0.4 + 0.6 * hash(i * 7.3 + k * 31));
          svgEl('rect', sv, { x: 4 + 6 * i, y: 80 - h / 2, width: 3, height: h, rx: 1.5, fill: C.ACC_T });
        }
        if (k > 0) {
          s.seam = rect(tlRows[3], x0 - 1, 124, 2, 268, { background: C.INK });
          s.flash = rect(tlRows[3], x0 - 1.5, 116, 3, 284, { background: C.WHITE, boxShadow: `0 0 14px ${rgba(C.WHITE, 0.8)}` });
        }
      } else {
        s.tc = T.gaps + 0.07 * gi++;
        s.line = rect(s.a, 0, 79, w0, 2, { background: rgba(C.WARM, 0.75) });
        s.ov = rect(tlRows[3], x0, 118, w0, 280, { borderRadius: '10px', boxSizing: 'border-box', border: `1.5px solid ${rgba(C.WARM, 0.85)}`, background: rgba(C.WARM, 0.16) });
        sfx(s.tc + 0.05, 'tick', 0.4);
      }
      x0 += w0;
      return s;
    });
    txt(tlRows[2], 'ראיון', { font: F.HEEBO, weight: 500, size: 19, color: C.WHITE, x: CX0 + 12, y: 142, align: 'l', css: { opacity: 0.85 } });
    segs.forEach((s, k) => { if (s.seam) s.tc = segs[k - 1].tc; });
    const GAPS = segs.filter(s => s.kind === 'g'), GSUM = GAPS.reduce((a, s) => a + s.w0, 0);
    const closed = t => GAPS.reduce((a, s) => a + s.w0 * S(t - s.tc, 16, 1), 0) / GSUM;
    // "חסכת 12 דקות"
    const SV1 = blurWords(cam, [['חסכת']], Object.assign({}, HB, { size: 96, y: -560 }));
    const s2 = 176, o2 = Object.assign({}, HB, { weight: 900, size: s2 });
    const wN = measure('12', o2).w, wD = measure('דקות', o2).w, tot2 = wN + s2 * 0.24 + wD;
    const numG = txt(cam, '0', Object.assign({}, o2, { x: tot2 / 2 - wN / 2, y: -395, color: C.WARM }));
    const SV2 = blurWords(cam, [['דקות']], Object.assign({}, o2, { x: -tot2 / 2 + wD / 2, y: -395 }));
    for (let k = 1; k <= 12; k++) sfx(T.count[0] + (T.count[1] - T.count[0]) * (1 - Math.cbrt(1 - (k - 0.5) / 12)), 'count', 0.28);
    sfx(T.count[1], 'success', 0.55);
    // --- video (card-local px) ---
    const vBase = div(vdC, { left: '0', top: '0', width: '100%', height: '100%', background: `linear-gradient(160deg, ${mixc(C.INK, C.VIOLET, 0.3)}, ${mixc(C.INK, C.LOGO2, 0.22)} 60%, ${C.INK})` });
    const blob = (col, a, size, x, y) => box(vdC, x, y, size, size, { borderRadius: '50%', background: `radial-gradient(closest-side, ${rgba(col, a)}, ${rgba(col, 0)})` });
    const vb1 = blob(C.VIOLET, 0.75, 820, VD_W * 0.35, VD_H * 0.3), vb2 = blob(C.BLUE, 0.55, 760, VD_W * 0.7, VD_H * 0.62);
    const orbG = grp(vdC, VD_W / 2, VD_H * 0.36);
    const orbRings = T.words.map(() => box(orbG, 0, 0, 220, 220, { borderRadius: '50%', border: `2px solid ${rgba(C.WHITE, 0.5)}`, boxSizing: 'border-box' }));
    const orb = box(orbG, 0, 0, 220, 220, { borderRadius: '50%', background: `radial-gradient(circle at 40% 35%, ${rgba(C.WHITE, 0.55)}, ${rgba(C.VIOLET, 0.55)} 45%, ${rgba(C.BLUE, 0.15)} 75%, ${rgba(C.BLUE, 0)})`, boxShadow: `0 0 80px ${rgba(C.VIOLET, 0.55)}` });
    rect(vdC, 0, VD_H / 2, VD_W, VD_H / 2, { background: `linear-gradient(180deg, ${rgba(C.INK, 0)}, ${rgba(C.INK, 0.62)})` });
    rect(vdC, 40, VD_H - 40, VD_W - 80, 6, { borderRadius: '3px', background: 'rgba(255,255,255,0.18)' });
    const barF = rect(vdC, 40, VD_H - 40, 0, 6, { borderRadius: '3px', background: rgba(C.WHITE, 0.85) });
    const HD = blurWords(cam, [['כתוביות'], ['AI', C.BLUE, 'ltr'], ['בעברית']], Object.assign({}, HB, { size: 92, y: -620, gap: 24 }));
    const cS = 90, CO = Object.assign({}, HB, { size: cS, color: C.WHITE, gap: cS * 0.27 });
    const marker = div(cam, { borderRadius: '16px', background: C.WARM, boxShadow: `0 10px 40px ${rgba(C.WARM, 0.35)}` });
    const CAP = [...row(cam, ['כל', 'מילה', 'נדלקת'], Object.assign({}, CO, { y: 300 })), ...row(cam, ['בדיוק', 'בזמן'], Object.assign({}, CO, { y: 300 + cS * 1.2 }))];
    CAP.forEach((w, k) => { w.y = k < 3 ? 300 : 300 + cS * 1.2; sfx(T.words[k], 'pop', 0.35); });
    const mkPad = 18, mkEdge = k => [CAP[k].cx - CAP[k].w / 2 - mkPad, CAP[k].cx + CAP[k].w / 2 + mkPad];
    const mkKeys = side => CAP.slice(1).map((w, i) => {
      const k = i + 1, movingLeft = CAP[k].cx < CAP[k - 1].cx, lead = movingLeft ? side === 0 : side === 1;
      return [T.words[k], mkEdge(k)[side], lead ? 30 : 15, 0.9];
    });
    const mkL = track(mkEdge(0)[0], mkKeys(0)), mkRt = track(mkEdge(0)[1], mkKeys(1));
    const mkY = track(CAP[0].y, CAP.slice(1).map((w, i) => [T.words[i + 1], w.y, 22, 0.9]));

    // ================= 5. "בלחיצה אחת" in the four real styles =================
    const bS = Math.min(128, fit('בלחיצה אחת', HB, 820)), BO = Object.assign({}, HB, { size: bS, y: -628, color: C.WHITE, gap: bS * 0.24 });
    const BV = STYLES.map(() => { const r = row(cam, ['בלחיצה', 'אחת'], BO); r[1].g.inner.style.color = C.WARM; return r; });
    sfx(T.tiles[0] + 0.05, 'pop', 0.4); sfx(T.tiles[1] + 0.05, 'swish', 0.25); sfx(T.tiles[2] + 0.05, 'tick', 0.35);

    // ================= 6. end card =================
    const L2 = makeLogo(cam, L2Y, 520, 'lgB');
    const MT2 = track(L1.body, [[T.open, panelRect(0, PTOP0), 10, 0.9], [15.5, panelRect(2, PTOP1), 400, 1], [T.fold, L2.body, 11, 0.92]]);
    const WM2 = blurWords(cam, [['CS', C.WHITE, 'ltr'], ['TRIM', C.BLUE, 'ltr']], { font: F.HEEBO, weight: 800, ls: 0.01, size: 150, y: -30, gap: 38, ltr: true });
    const lnS = Math.min(84, fit('חינם · Mac · Windows', { font: F.HEEBO, weight: 600 }, 760));
    const ln = txt(cam, '', { font: F.HEEBO, weight: 600, size: lnS, y: 130, color: C.PN_TX2 });
    ln.inner.innerHTML = `<span style="color:${C.WHITE};font-weight:800">חינם</span> · Mac · Windows`;
    const cO = { font: F.HEEBO, weight: 700, size: 62, color: C.WHITE };
    const ctaT = 'הורדה: cstrim.site', cbw = measure(ctaT, cO).w + 150, cbh = 132;
    const cta = grp(cam, 0, 320);
    const ctaGlow = box(cta, 0, 10, cbw, cbh, { borderRadius: px(cbh / 2), background: `linear-gradient(90deg, ${C.VIOLET}, ${C.ACC})` });
    const ctaB = box(cta, 0, 0, cbw, cbh, { borderRadius: px(cbh / 2), padding: '2.5px', boxSizing: 'border-box', background: `linear-gradient(90deg, ${C.VIOLET}, ${C.ACC}, ${C.LOGO1})` });
    const ctaIn = div(ctaB, { position: 'relative', width: '100%', height: '100%', borderRadius: px(cbh / 2), overflow: 'hidden', background: `linear-gradient(180deg, ${mixc(C.INK, C.ACC, 0.22)}, ${mixc(C.INK, C.VIOLET, 0.12)})` }, '');
    const shine = rect(ctaIn, 0, -20, 90, cbh + 40, { background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.32), rgba(255,255,255,0))' });
    const ctaTx = txt(cta, '', Object.assign({}, cO, { y: 2 }));
    ctaTx.inner.innerHTML = `הורדה: <span style="color:${C.ACC_T}">cstrim.site</span>`;
    sfx(T.fold, 'whoosh', 0.4); sfx(T.logo2, 'sparkle', 0.8); sfx(T.wm2, 'tick', 0.35); sfx(T.line, 'tick', 0.3); sfx(T.cta, 'pop', 0.6); sfx(18.4, 'sparkle', 0.22);

    // ================= cursor =================
    const cur = cursor(cam, 50, C.WHITE, C.INK);
    const tip = p => [p[0] + 8, p[1] + 6];
    const curT = track([470, 760], [
      [5.6, tip(P_SENS), 12, 0.95], [6.18, tip(P_CUT), 13, 0.95], [6.62, [470, 620], 9, 1],
      [8.5, tip(P_TAB1), 12, 0.95], [9.0, tip(P_TOG), 13, 0.95], [9.38, tip(P_SW), 14, 0.95], [9.72, tip(P_CREATE), 13, 0.95], [10.1, [470, 640], 9, 1],
      [12.3, tip(P_TAB2), 12, 0.95], ...T.tiles.map((c, i) => [c - 0.3, tip(P_TILES[i]), 13, 0.95]), [15.45, [480, 720], 8, 1],
    ]);
    const CLICKS = [T.sens, T.cut, T.tab1, T.toggle, T.swatch, T.create, T.tab2, ...T.tiles];
    const curWin = [[5.55, 6.62], [8.45, 10.08], [12.25, 15.45]];

    // ================= film grain (static, over everything) =================
    const gctx = canvas2d(root, 0, 0, W, H);
    const img = gctx.createImageData(W, H), R = rng(7);
    for (let i = 0; i < img.data.length; i += 4) { const v = R() < 0.5 ? 0 : 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = Math.floor(R() * 10); }
    gctx.putImageData(img, 0, 0);

    // tile sample pills: the plugin's own keyframes (2.6 s cycle), as functions of t
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
      // camera + parallax
      const z = camZ(t), [dx, dy, dr] = drift(t);
      tf(cam, { x: dx, y: dy, s: z, r: dr });
      tf(bg, { x: dx * 0.35, y: dy * 0.35, s: 1 + (z - 1) * 0.35 });
      const fk = fogK(t);
      [[fA, fAp, 21], [fB, fBp, 25], [fC, fCp, 29]].forEach(([el, p, sd], i) => {
        const [x, y] = p(t);
        tf(el, { x: x + 34 * vnoise(t * 0.2, sd), y: y + 34 * vnoise(t * 0.17, sd + 1), o: fk * (i === 2 ? 0.5 + 0.5 * sp(t, 3.4, 4) : 1) * (0.92 + 0.08 * Math.sin(t * 1.3 + i)) });
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
          const X = lerp(lerp(WV.x0, WV.x1, u), qx, wk), Y = lerp(WV.y + waveY(u, t), qy, wk);
          d += (i ? 'L' : 'M') + f2(X) + ' ' + f2(Y);
        }
        wave.setAttribute('d', d || 'M0 0');
        wave.setAttribute('stroke-width', f2(lerp(4.5, 24 * L1.sc, wk)));
      }
      gapGlows.forEach((g, i) => tf(g, { o: (dk > GAPF[i][1] ? 1 : 0) * 0.85 * (0.75 + 0.25 * Math.sin(t * 5 + i)) * (1 - ramp(t, T.wave - 0.05, 0.3)), blur: 9 }));

      // ---------- 2. logo lockup ----------
      const l1o = t >= T.logo && t < T.open + 0.08 ? 1 - ramp(t, T.open, 0.08) : 0;
      if (tf(L1.g, { o: l1o })) {
        bubScale(L1, 0.55 + 0.45 * S(t - T.logo, 15, 0.62));
        tf(L1.glow, { o: 0.65 * sp(t, T.logo, 7), blur: 44, s: 1 + 0.03 * Math.sin((t - T.logo) * 3) });
        L1.bar.style.opacity = sp(t, 4.2, 18);
      }
      const bk = sp(t, T.logo, 5);
      tf(burst, { s: 0.6 + 1.9 * bk, o: t >= T.logo ? 0.8 * (1 - bk) : 0 });
      blurIO(WM1, t, T.wm, T.wmOut, 0.035);

      // ---------- 3. panel ----------
      const ptop = PTOP(t), ph = PHt(t), recede = RC(t);
      const openK = kick(t, T.open, 14, 8, 0.18), foldK = S(t - T.fold, 12, 1);
      const pcy = ptop + K * ph / 2;
      const pOn = t >= T.open + 0.25 && t < T.fold + 0.16;
      tf(pPersp, { x: 0, y: pcy, o: pOn ? 1 : 0 });
      if (pOn) {
        tf(pTilt, { rx: 16 * openK + 20 * recede + 18 * foldK, ry: -7 * openK, s: (1 - 0.17 * recede) * (1 - 0.3 * foldK), y: 90 * recede, o: ramp(t, T.open + 0.3, 0.12) * (1 - 0.68 * recede) * (1 - ramp(t, T.fold + 0.02, 0.12)), blur: 9 * recede + 10 * ramp(t, T.fold, 0.14) });
        tf(pScale, { s: K, y: -K * ph / 2 });
        pnEl.style.height = px(ph);
        place(pShadow, -K * PNW / 2, pcy - K * ph / 2 + 40, K * PNW, K * ph);
        tf(pShadow, { o: 0.9 * ramp(t, T.open + 0.3, 0.2) * (1 - recede * 0.6) * (1 - ramp(t, T.fold, 0.12)), blur: 50 });
        // entrance stagger, 70 ms apart
        [hd, ctx, tabs, views, ft].forEach((el, i) => { const a = T.open + 0.32 + 0.07 * i, k = S(t - a, 18, 1); tf(el, { o: ramp(t, a, 0.12), y: 10 * (1 - k), blur: 6 * (1 - k) }); });
        // tabs
        const tk1 = ramp(t, T.tab1, 0.12), tk2 = ramp(t, T.tab2, 0.12);
        TABS.forEach((el, i) => { const a = [1 - tk1, tk1 * (1 - tk2), tk2][i]; el.style.color = mixc(C.PN_TX2, C.PN_TX, a); });
        const bl = barL(t), br = barR(t);
        css(tabbar, { left: px(Math.min(bl, br)), width: px(Math.abs(br - bl)) });
        // views: cross fade with a short blur and a sideways move (towards the new tab)
        const VW = [[T.open, T.tab1], [T.tab1 + 0.06, T.tab2], [T.tab2 + 0.06, 99]];
        V.forEach((v, i) => {
          const [a, b] = VW[i], ki = i ? S(t - a, 20, 1) : 1, ko = ramp(t, b, 0.1);
          tf(v, { o: (i ? ramp(t, a, 0.12) : 1) * (1 - ko), x: -16 * (1 - ki) + 16 * ko, blur: 6 * (1 - ki) + 6 * ko });
        });
        // silence tab: sensitivity knob
        sensKnob.style.transform = `translateX(${f2(knobX(t))}px)`;
        const sk = ramp(t, T.sens, 0.1);
        sens.forEach((s, i) => { const a = i === 0 ? 1 - sk : i === 1 ? sk : 0; s.style.color = mixc(C.PN_TX2, C.PN_TX, a); s.style.fontWeight = a > 0.5 ? 600 : 500; });
        // primary buttons: hover glow and press
        [[0, T.cut], [1, T.create], [2, -9]].forEach(([i, c]) => {
          const hov = c > 0 ? ramp(t, c - 0.28, 0.12) * (1 - ramp(t, c + 0.1, 0.2)) : 0;
          BTN[i].style.background = mixc(C.ACC, C.ACC_H, hov);
          tf(BTN[i], { s: 1 - 0.035 * bump(t, c - 0.03, 0.06) });
          tf(GLOW[i], { o: 0.55 * hov + 0.6 * bump(t, c, 0.12, 24, 6), blur: 10, s: 1 + 0.06 * bump(t, c, 0.12, 24, 6) });
        });
        // captions tab: marker switch, swatch ring, pill colour
        const mkOn = ramp(t, T.toggle, 0.1), mkK = S(t - T.toggle, 24, 0.85);
        mk.style.background = mixc(C.PN_S3, C.ACC, mkOn); mk.style.borderColor = mixc(C.PN_LINE2, C.ACC, mkOn);
        css(mkKnob, { right: px(2 + 12 * mkK), background: mixc('#BDBDBD', '#FFFFFF', mkOn) });
        const swk = ramp(t, T.swatch, 0.1);
        pill.style.background = mixc(SWATCHES[0], C.WARM, swk); pill.style.opacity = f2(0.4 + 0.6 * mkOn);
        rowc.style.opacity = f2(0.4 + 0.6 * mkOn);
        css(ring, { transform: `translateX(${f2(ringX(t))}px)`, boxShadow: `0 0 0 1.5px ${mixc(SWATCHES[0], C.WARM, swk)}` });
        sws.forEach((s, i) => tf(s, { s: 1 + 0.15 * (i === 4 ? bump(t, T.swatch - 0.02, 0.06) : 0) }));
        // animations tab: tiles
        const at = activeTile(t), atk = T.tiles.map(c => ramp(t, c, 0.08));
        tiles.forEach((tl, i) => {
          const a = i === at ? (i === 0 ? 1 : atk[i]) : 0;
          tl.style.borderColor = mixc(C.PN_LINE, C.ACC, a); tl.style.boxShadow = a > 0.01 ? `0 0 0 ${f2(a)}px ${C.ACC}` : 'none';
          vps[i].style.background = mixc(C.PN_BG, '#121A2B', a);
          smps[i].style.background = mixc(C.PN_S3, C.ACC, a);
          nms[i].style.color = mixc(C.PN_TX2, C.PN_TX, a); nms[i].style.fontWeight = a > 0.5 ? 600 : 500;
          tf(tl, { s: 1 - 0.03 * bump(t, T.tiles[i] - 0.03, 0.06) });
          const u = (((t - T.tab2) % 2.6) + 2.6) % 2.6 / 2.6;
          tf(smps[i], SAMPLE[i](u));
        });
      } else on(pShadow, false);

      // morph rect: logo -> panel (5.0-5.55) and panel -> logo (15.75-16.25)
      const mOn = (t >= T.open && t < T.open + 0.55) || (t >= T.fold - 0.01 && t < T.logo2 + 0.03);
      if (tf(mPersp, { o: mOn ? 1 : 0 })) {
        const [mx, my, mw, mh, mr] = MT2(t);
        const second = t > 10, kc = second ? 1 - ramp(t, T.fold + 0.12, 0.3) : ramp(t, T.open + 0.04, 0.3);
        tf(mPersp, { x: mx, y: my });
        tf(mTilt, { rx: second ? 22 * kick(t, T.fold, 12, 7, 0.2) : 16 * openK, ry: second ? 8 * kick(t, T.fold, 12, 7, 0.2) : -7 * openK });
        place(mR, -mw / 2, -mh / 2, mw, mh);
        css(mR, { borderRadius: px(mr), background: `linear-gradient(135deg, ${mixc(C.LOGO1, C.PN_BG, kc)}, ${mixc(C.LOGO2, C.PN_BG, kc)})`, border: `1px solid ${rgba(C.WHITE, 0.08 * kc)}` });
        tf(mPulse, { o: second ? 0 : 1 - ramp(t, T.open, 0.14), blur: 8 * ramp(t, T.open, 0.14) });
      }

      // ---------- 4. front card ----------
      const fOn = (t >= T.cut + 0.04 && t < T.close1 + 0.4) || (t >= T.create + 0.04 && t < T.close2 + 0.4);
      if (tf(fPersp, { o: fOn ? 1 : 0 })) {
        const [cx, cy, cw, ch, cr] = fT(t);
        const first = t < 9.5, op = first ? T.cut : T.create, cl = first ? T.close1 : T.close2;
        const kc = ramp(t, op + 0.06, 0.22) * (1 - ramp(t, cl + 0.12, 0.18));
        tf(fPersp, { x: cx, y: cy, o: 1 - ramp(t, cl + 0.3, 0.08) });
        tf(fTilt, { ry: 12 * kick(t, op + 0.05) - 10 * kick(t, cl), rx: -8 * kick(t, op + 0.05) + 8 * kick(t, cl) });
        place(fR, -cw / 2, -ch / 2, cw, ch);
        css(fR, { borderRadius: px(cr), background: mixc(C.ACC, '#1B1B1F', kc), border: `1px solid ${rgba(C.WHITE, 0.09 * kc)}` });
        place(fShadow, -cw / 2, -ch / 2 + 34, cw, ch); fShadow.style.borderRadius = px(cr);
        tf(fShadow, { o: kc, blur: 44 });
        const cin = ramp(t, op + 0.17, 0.2) * (1 - ramp(t, cl - 0.02, 0.1));
        on(tlC, first); on(vdC, !first);
        if (first) {
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
        } else {
          tf(vdC, { o: ramp(t, op + 0.14, 0.2) * (1 - ramp(t, cl - 0.02, 0.1)) });
          tf(vb1, { x: 90 * vnoise(t * 0.35, 71), y: 70 * vnoise(t * 0.3, 72) });
          tf(vb2, { x: 80 * vnoise(t * 0.3, 73), y: 90 * vnoise(t * 0.33, 74) });
          let pk = 0;
          T.words.forEach((tw, k) => { pk += bump(t, tw, 0.05, 30, 10); const u = sp(t, tw, 5); tf(orbRings[k], { s: 1 + 1.3 * u, o: t >= tw ? 0.7 * (1 - u) : 0 }); });
          tf(orb, { s: (1 + 0.03 * Math.sin(t * 2.4)) * (1 + 0.12 * pk) });
          barF.style.width = px((VD_W - 80) * seg(t, T.create + 0.3, T.close2));
        }
      }
      // "חסכת 12 דקות"
      blurIO(SV1, t, T.count[0] - 0.1, T.close1 - 0.1);
      numG.inner.textContent = String(Math.round(12 * E.o3(seg(t, T.count[0], T.count[1]))));
      blurEl(numG, t, T.count[0] - 0.02, T.close1 - 0.06, { s: 1 + 0.1 * bump(t, T.count[1], 0.05, 30, 12) });
      blurIO(SV2, t, T.count[0] + 0.06, T.close1 - 0.04);
      // captions heading, words and the gliding marker
      blurIO(HD, t, T.create + 0.12, T.close2 - 0.15);
      CAP.forEach((w, k) => blurEl(w.g, t, T.words[k], T.close2 - 0.12 + 0.03 * k, { s: 1 + 0.08 * bump(t, T.words[k], 0.06, 30, 12) }));
      if (tf(marker, { o: t >= T.words[0] ? 1 - ramp(t, T.close2 - 0.1, 0.12) : 0 })) {
        const l = mkL(t), r = mkRt(t), y = mkY(t), k0 = S(t - T.words[0], 22, 0.8);
        const mw = (r - l) * k0, mh = cS * 1.12 * k0, mcx = (l + r) / 2;
        place(marker, mcx - mw / 2, y - mh / 2 + 4, mw, mh);
      }

      // ---------- 5. "בלחיצה אחת" in the clicked style ----------
      BV.forEach((ws, i) => {
        const c = T.tiles[i], c1 = T.tiles[i + 1] ?? T.fold;
        ws.forEach((w, j) => {
          const t0 = c + 0.05 + 0.06 * j, ex = ramp(t, c1 - 0.02, 0.1);
          if (t < t0 - 0.01 || t > c1 + 0.1) { tf(w.g, { o: 0 }); return; }
          const base = { o: 1 - ex, blur: 10 * ex };
          // pop and zoom scale the whole line about its centre (the gap scales too, so the words never touch)
          if (i === 0) { const sc = 0.35 + 0.65 * S(t - t0, 17, 0.5); tf(w.g, Object.assign(base, { s: sc, x: w.cx * (sc - 1), o: base.o * ramp(t, t0, 0.07) })); }
          else if (i === 1) { const Y = tt => 110 * (1 - S(tt - t0, 19, 1)); tf(w.g, Object.assign(base, { y: Y(t), sy: 1 + 0.12 * (1 - S(t - t0, 14, 1)), o: base.o * ramp(t, t0, 0.1), mb: [0, vel(Y, t)] })); }
          else if (i === 2) { const k = S(t - t0, 15, 1), sc = 0.6 + 0.4 * k; tf(w.g, Object.assign(base, { s: sc, x: w.cx * (sc - 1), blur: base.blur + 8 * (1 - k), o: base.o * ramp(t, t0, 0.12) })); }
          else tf(w.g, Object.assign(base, { o: base.o * E.smooth(seg(t, t0, t0 + 0.4)) }));
        });
      });

      // ---------- 6. end card ----------
      if (tf(L2.g, { o: t >= T.logo2 ? 1 : 0 })) {
        bubScale(L2, 1 + 0.06 * kick(t, T.logo2, 18, 8, 0.05));
        L2.pulse.setAttribute('stroke-dasharray', `${L2.len} ${L2.len}`);
        L2.pulse.setAttribute('stroke-dashoffset', f2(L2.len * (1 - S(t - T.logo2 - 0.05, 11, 1))));
        L2.bar.style.opacity = sp(t, 16.6, 18);
        tf(L2.glow, { o: 0.6 * sp(t, T.logo2, 6) * (0.88 + 0.12 * Math.sin((t - T.logo2) * 2.2)), blur: 46 });
      }
      blurIO(WM2, t, T.wm2, 99, 0.035);
      blurEl(ln, t, T.line);
      if (tf(cta, { s: 0.9 + 0.1 * S(t - T.cta, 16, 0.7), o: ramp(t, T.cta, 0.12), blur: 10 * (1 - S(t - T.cta, 16, 1)) })) {
        tf(ctaGlow, { o: 0.55 * sp(t, T.cta, 7) * (0.8 + 0.2 * Math.sin((t - T.cta) * 2.6)), blur: 30 });
        tf(shine, { x: lerp(-140, cbw + 60, E.io3(seg(t, 18.4, 19.1))), skx: -20, o: t >= 18.4 && t < 19.1 ? 1 : 0 });
      }

      // ---------- cursor ----------
      const [cx, cy] = curT(t);
      let press = 1; for (const c of CLICKS) press -= 0.14 * bump(t, c - 0.04, 0.05);
      const co = Math.max(...curWin.map(([a, b]) => ramp(t, a, 0.12) * (1 - ramp(t, b - 0.12, 0.12))));
      tf(cur, { x: cx, y: cy, s: press, o: co });
    };
  });
})();
