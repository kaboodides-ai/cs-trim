// panel.js: the CS Trim panel, rebuilt from the plugin's own index.html and css/style.css (scoped under .pn,
// without CSS transitions: every change is driven from scene.js). Defines window.PANEL for scene.js.
window.PANEL = (() => {
  'use strict';
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;
  const PNW = 310;
  const BUBBLE = 'M184 116H328A100 100 0 0 1 428 216V256A100 100 0 0 1 328 356H224L152 404C141 411 128 402 132 389L144 349C106 333 84 298 84 256V216A100 100 0 0 1 184 116Z';
  const PULSE = [[134, 236], [186, 236], [212, 172], [250, 304], [280, 200], [298, 236], [378, 236]];
  const PULSE_D = 'M' + PULSE.map(p => p.join(' ')).join('L');
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
  return { PNW, PANEL_HTML, SWATCHES, STYLES, BUBBLE, PULSE, PULSE_D };
})();
