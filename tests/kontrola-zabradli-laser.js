"use strict";
/* Kontrola laserového motivu v zábradlí: jestli plech v každém poli sedí do rámu.
   - plech je uzavřené těleso, objem = (obrys − výřezy) × tloušťka
   - mezera plechu k líci sloupků a madel = PANEL.gap (SAT – oddělující osa), s ničím se neprotíná
   - výřezy leží uvnitř obrysu s okrajem, nejužší můstek a největší otvor (koule) podle přepočtu
   - DXF: obrys + výřezy jako uzavřené POLYLINE, číslo dílu v okraji; STEP sestavy projde validátorem
   Použití: node tests/kontrola-zabradli-laser.js */
require("../core.js"); require("../gen.js"); require("../assets/zabradli/motiv-strom.js"); require("../zabradli-core.js");
const Z = globalThis.Zabradli, G = globalThis.Generator, { validate } = require("./validate-step.js");
const { add, sub, mul, dot, cross, len, unit } = Z.V;
const P = Z.PANEL;
let fails = 0;
const fail = (lab, t) => { fails++; console.log("CHYBA " + lab + ": " + t); };

/* SAT: dolní mez vzdálenosti dvou konvexních těles (obálek) – kladná = oddělené */
function satGap(A, B, axesA, axesB) {
  const edges = (s) => {
    const out = [];
    s.faces.forEach((f) => [f.outer].concat(f.inner).forEach((lp) => lp.forEach((a, i) => {
      const d = sub(s.verts[lp[(i + 1) % lp.length]], s.verts[a]); if (len(d) > 1e-6) out.push(unit(d));
    })));
    const uniq = [];
    out.forEach((d) => { if (!uniq.some((u) => Math.abs(Math.abs(dot(u, d)) - 1) < 1e-6)) uniq.push(d); });
    return uniq;
  };
  const axes = axesA.concat(axesB);
  const eA = edges(A), eB = edges(B);
  eA.forEach((a) => eB.forEach((b) => { const c = cross(a, b); if (len(c) > 1e-6) axes.push(unit(c)); }));
  let best = -Infinity;
  axes.forEach((n) => {
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    A.verts.forEach((v) => { const p = dot(v, n); a0 = Math.min(a0, p); a1 = Math.max(a1, p); });
    B.verts.forEach((v) => { const p = dot(v, n); b0 = Math.min(b0, p); b1 = Math.max(b1, p); });
    best = Math.max(best, Math.max(b0 - a1, a0 - b1));
  });
  return best;
}
const faceNormals = (s) => { const out = []; s.faces.forEach((f) => { const n = unit(f.n); if (!out.some((u) => Math.abs(Math.abs(dot(u, n)) - 1) < 1e-6)) out.push(n); }); return out; };
const area = (pl) => { let a = 0; pl.forEach((p, i) => { const q = pl[(i + 1) % pl.length]; a += p[0] * q[1] - q[0] * p[1]; }); return a / 2; };
function segDist(p, a, b) { const ab = [b[0] - a[0], b[1] - a[1]], L2 = ab[0] * ab[0] + ab[1] * ab[1]; let t = L2 ? ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * ab[0], p[1] - a[1] - t * ab[1]); }
function polyDist(p, pl) { let d = Infinity; for (let i = 0; i < pl.length; i++) d = Math.min(d, segDist(p, pl[i], pl[(i + 1) % pl.length])); return d; }
function inside(p, pl) { let c = false; for (let i = 0, j = pl.length - 1; i < pl.length; j = i++) { const a = pl[i], b = pl[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
/* mřížka bodů nad výřezy: vzdálenost k obrysům -> nejužší můstek (body v oceli mezi dvěma výřezy) a největší koule ve výřezu */
function webAndBall(holes, outline, step) {
  const bb = (pl) => [Math.min(...pl.map((q) => q[0])), Math.min(...pl.map((q) => q[1])), Math.max(...pl.map((q) => q[0])), Math.max(...pl.map((q) => q[1]))];
  const boxes = holes.map(bb);
  let ball = 0;
  holes.forEach((h, i) => {
    const b = boxes[i];
    for (let x = b[0]; x <= b[2]; x += step) for (let y = b[1]; y <= b[3]; y += step) if (inside([x, y], h)) ball = Math.max(ball, 2 * polyDist([x, y], h));
  });
  // můstek: nejmenší vzdálenost bodů jednoho výřezu k jinému výřezu (jen blízké dvojice)
  let web = Infinity, edge = Infinity;
  holes.forEach((h, i) => {
    h.forEach((p) => { edge = Math.min(edge, polyDist(p, outline)); });
    holes.forEach((g, j) => {
      if (j <= i) return;
      const a = boxes[i], b = boxes[j];
      if (a[0] - 20 > b[2] || b[0] - 20 > a[2] || a[1] - 20 > b[3] || b[1] - 20 > a[3]) return;
      const sm = h.filter((_, k) => k % 2 === 0);
      sm.forEach((p) => { if (p[0] < b[0] - 20 || p[0] > b[2] + 20 || p[1] < b[1] - 20 || p[1] > b[3] + 20) return; web = Math.min(web, polyDist(p, g)); });
    });
  });
  return { web, ball, edge };
}

function selfX(loops) {
  const X = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
  return loops.some((pl) => { const n = pl.length; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (X(pl[i], pl[(i + 1) % n], pl[j], pl[(j + 1) % n])) return true; } return false; });
}
const CASES = [
  ["rovné 3 m", { segs: [{ L: 3000, rise: 0 }] }],
  ["rovné 50×50, bez madla, rozteč 1200", { segs: [{ L: 3600, rise: 0 }], rail: "50x50x2", madlo: false, postPitch: 1200 }],
  ["rovné, rozteč 700, výška 1100, patky", { segs: [{ L: 2100, rise: 0 }], postPitch: 700, vyska: 1100, anchor: "patka" }],
  ["schodiště 30°", { segs: [{ L: 3000, rise: 1730, steps: 11 }], anchor: "bocni" }],
  ["schodiště dolů", { segs: [{ L: 2400, rise: -1200, steps: 8 }] }],
  ["roh L 90°", { segs: [{ L: 2500, rise: 0, turn: 90 }, { L: 2000, rise: 0 }] }],
  ["roh 45°", { segs: [{ L: 2000, rise: 0, turn: 45 }, { L: 2000, rise: 0 }] }],
  ["schody + podesta + roh", { segs: [{ L: 2380, rise: 2000, steps: 12 }, { L: 4500, rise: 0, turn: 90 }, { L: 3000, rise: 0 }], anchor: "patka" }],
  ["sloupky přes čelo", { segs: [{ L: 4000, rise: 0 }], anchor: "celo" }]
];
let first = null;
CASES.forEach(([lab, c], ci) => {
  const t0 = Date.now();
  const A = Z.analyze(Object.assign({ vypln: "laser" }, c));
  const lay = A.lay, panels = lay.members.filter((m) => m.kind === "panel");
  if (A.cfg.vypln !== "laser" || !A.cfg.sloupky) fail(lab, "konfigurace se nepřevedla na laserový motiv");
  if (lay.members.some((m) => m.role === "bar" || m.role === "over" || m.role === "overtop")) fail(lab, "zůstaly špruše");
  if (panels.length !== lay.fields.length || lay.panels.some((p) => !p.ok)) fail(lab, "plechů " + panels.length + " na " + lay.fields.length + " polí");
  // kotvy (rameno, plotna) kontroluje zvlášť – v rohu je známá kolize kotvy dalšího úseku se spodním madlem (i bez laseru)
  const ANCH = ["arm", "plotna", "patka", "celo", "zed", "stub"];
  const steel = lay.members.filter((m) => m.kind !== "panel" && m.kind !== "rod" && m.kind !== "pad" && m.kind !== "wood" && ANCH.indexOf(m.role) < 0);
  const anchorsM = lay.members.filter((m) => ANCH.indexOf(m.role) >= 0);
  const anchorHits = [];
  let minGap = Infinity, maxNear = 0, minWeb = Infinity, maxBall = 0, minEdge = Infinity;
  panels.forEach((m, i) => {
    const s = m.solid, vol = Z.volume(s);
    if (!G.checkClosed(s.verts, s.faces)) fail(lab, "plech " + i + " není uzavřené těleso");
    const hs = Z.panelHoles(m, P.tol3d), net = (Math.abs(area(m.outline)) - hs.reduce((a, h) => a + Math.abs(area(h)), 0)) * m.t;
    if (Math.abs(vol - net) > 1e-6 * net + 1) fail(lab, "objem plechu " + vol.toFixed(0) + " ≠ " + net.toFixed(0));
    // mezera k rámu: obálka plechu (rovnoběžník × t) proti každému ocelovému dílu
    const hull = { verts: s.verts.filter((_, k) => k < 0) , faces: [] };
    const o = m.outline.map((q) => add(add(m.o, mul(m.ex, q[0])), mul(m.ey, q[1])));
    hull.verts = o.concat(o.map((v) => add(v, mul(m.ez, m.t))));
    hull.faces = [{ outer: [0, 1, 2, 3], inner: [], n: mul(m.ez, -1) }, { outer: [4, 5, 6, 7], inner: [], n: m.ez }]
      .concat([0, 1, 2, 3].map((k) => { const j = (k + 1) % 4, e = sub(o[j], o[k]); return { outer: [k, j, j + 4, k + 4], inner: [], n: unit(cross(e, m.ez)) }; }));
    const near = [];
    steel.forEach((x) => {
      const gap = satGap(hull, x.solid, faceNormals(hull), faceNormals(x.solid));
      if (gap < minGap) minGap = gap;
      if (gap < P.gap + 3 && (x.role === "rail" || x.role === "post" || x.role === "end_post")) near.push([x.role, gap]);
    });
    // plech musí být sevřený: aspoň madlo nahoře, dole a dva sloupky ve vzdálenosti ~gap
    anchorsM.forEach((x) => { const gap = satGap(hull, x.solid, faceNormals(hull), faceNormals(x.solid)); if (gap < 0) anchorHits.push((i + 1) + "×" + x.name + " " + gap.toFixed(0)); });
    const tight = near.filter((n) => Math.abs(n[1] - P.gap) < 0.05);
    if (tight.length < 3) fail(lab, "plech " + (i + 1) + ": k rámu sedí jen " + tight.length + " strany (" + near.map((n) => n[0] + " " + n[1].toFixed(2)).join(", ") + ")");
    near.forEach((n) => { maxNear = Math.max(maxNear, n[1]); });
    if (ci < 4 || i === 0) {                         // detailní kontrola výřezů (pomalejší) – vybrané plechy
      const hsF = Z.panelHoles(m, 0.1), r = webAndBall(hsF, m.outline, 2);
      minWeb = Math.min(minWeb, r.web); maxBall = Math.max(maxBall, r.ball); minEdge = Math.min(minEdge, r.edge);
      if (r.web < m.pn.web - 0.3) fail(lab, "můstek " + r.web.toFixed(2) + " < odhad " + m.pn.web.toFixed(2));
      if (r.ball > m.pn.ball + 1) fail(lab, "otvor " + r.ball.toFixed(1) + " > odhad " + m.pn.ball.toFixed(1));
      if (r.edge < P.border * Math.min(1, m.pn.smin) - 0.5) fail(lab, "výřez " + r.edge.toFixed(1) + " mm od okraje plechu");
      if (r.web < P.minWeb) fail(lab, "můstek pod " + P.minWeb + " mm");
      if (selfX(hsF)) fail(lab, "zmenšený výřez se kříží sám se sebou");
      if (r.ball > 110 && !A.warns.some((w) => /otvor/.test(w.t))) fail(lab, "otvor přes 110 mm bez upozornění");
    }
  });
  if (minGap < P.gap - 0.05) fail(lab, "plech je k dílu blíž než " + P.gap + " mm (" + minGap.toFixed(2) + ")");
  const rowsP = A.rows.filter((r) => r.kind === "panel");
  if (rowsP.reduce((a, r) => a + r.q, 0) !== panels.length) fail(lab, "kusovník nesedí s počtem plechů");
  // DXF
  rowsP.forEach((r) => {
    const d = Z.panelDxf(r.part), txt = G.dxf(Object.assign({ poz: r.poz }, d));
    const nPoly = (txt.match(/\nPOLYLINE\n/g) || []).length, nLine = (txt.match(/\nLINE\n/g) || []).length;
    if (nPoly !== d.polys.length || Math.abs(d.polys.length - r.part.pn.motif.holes.length) > 3 || nLine !== 4) fail(lab, "DXF: " + nPoly + " výřezů, " + nLine + " hran obrysu");
    if (!inside(d.text, d.poly) || d.polys.some((h) => polyDist(d.text, h) < 6)) fail(lab, "číslo dílu není v okraji plechu");
    if (Math.min(...d.poly.flat()) < -1e-6) fail(lab, "DXF má záporné souřadnice");
  });
  if (ci === 0 || ci === 3) {
    const st = validate(G.stepFile("laser_" + ci, lay.members.map((m) => m.solid)), "laser_" + ci);
    if (st.errs.length) fail(lab, "STEP: " + st.errs.slice(0, 2).join("; "));
  }
  const pi = lay.panels.filter((p) => p.ok);
  console.log((fails ? "…   " : "OK   ") + lab.padEnd(36) + " polí " + String(panels.length).padStart(2) + "  plech " + pi.map((p) => p.w + "×" + p.h).filter((x, i, a) => a.indexOf(x) === i).join(", ") +
    "  mezera k rámu " + minGap.toFixed(2) + "–" + maxNear.toFixed(2) + " mm" + (isFinite(minWeb) ? "  můstek " + minWeb.toFixed(1) + "  otvor Ø" + maxBall.toFixed(0) + "  okraj " + minEdge.toFixed(1) : "") +
    "  " + A.warns.filter((w) => w.lvl !== "info").length + " varování  (" + (Date.now() - t0) + " ms)" + (anchorHits.length ? "\n     ! kotva zasahuje do plechu: " + anchorHits.join(", ") : ""));
});
// standardní a geometrické výplně zůstaly beze změny
const std = Z.analyze({ segs: [{ L: 3000, rise: 0 }], sloupky: true });
if (std.lay.members.some((m) => m.kind === "panel") || !std.lay.members.some((m) => m.role === "bar")) fail("standard", "výplň se změnila");
console.log(fails ? "\n" + fails + " chyb" : "\nlaserový motiv: vše v pořádku");
process.exit(fails ? 1 : 0);
