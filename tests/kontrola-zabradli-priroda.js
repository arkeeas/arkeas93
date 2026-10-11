"use strict";
/* Kontrola řady Příroda (laserové scény na ořez, motiv po polích):
   - plech v každém poli, zvolený motiv a tloušťka, uzavřené těleso, objem = (obrys − výřezy) × t
   - výřezy jen uvnitř okraje 25 mm, nekříží se samy ani navzájem, ořez na okraji počítá plochu správně (kontrola mřížkou)
   - nejužší můstek, největší otvor ≤ 110 mm, hlavní zvíře celé v poli pro každý posun
   - schodiště a vysoké pole se nedají poptat (varování „bad“), tloušťka mimo rozmezí motivu taky ne
   - DXF: obrys + výřezy jako uzavřené křivky; STEP projde validátorem
   Použití: node tests/kontrola-zabradli-priroda.js */
require("../core.js"); require("../gen.js");
["strom", "bunky", "jelen", "medved", "smrky", "los", "motyl", "motyl-a", "motyl-b"].forEach((m) => require("../assets/zabradli/motiv-" + m + ".js"));
require("fs").readdirSync(__dirname + "/../assets/zabradli/schody").forEach((f) => require("../assets/zabradli/schody/" + f));
require("../zabradli-core.js");
const Z = globalThis.Zabradli, G = globalThis.Generator, { validate } = require("./validate-step.js");
const P = Z.PANEL;
let fails = 0;
const fail = (lab, t) => { fails++; console.log("CHYBA " + lab + ": " + t); };
const area = (pl) => { let a = 0; pl.forEach((p, i) => { const q = pl[(i + 1) % pl.length]; a += p[0] * q[1] - q[0] * p[1]; }); return a / 2; };
function segDist(p, a, b) { const ab = [b[0] - a[0], b[1] - a[1]], L2 = ab[0] * ab[0] + ab[1] * ab[1]; let t = L2 ? ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * ab[0], p[1] - a[1] - t * ab[1]); }
function polyDist(p, pl) { let d = Infinity; for (let i = 0; i < pl.length; i++) d = Math.min(d, segDist(p, pl[i], pl[(i + 1) % pl.length])); return d; }
function inside(p, pl) { let c = false; for (let i = 0, j = pl.length - 1; i < pl.length; j = i++) { const a = pl[i], b = pl[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
const bb = (pl) => [Math.min(...pl.map((q) => q[0])), Math.min(...pl.map((q) => q[1])), Math.max(...pl.map((q) => q[0])), Math.max(...pl.map((q) => q[1]))];
const X = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < -1e-9 && o(c, d, a) * o(c, d, b) < -1e-9; };
function selfX(pl) { const n = pl.length; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (X(pl[i], pl[(i + 1) % n], pl[j], pl[(j + 1) % n])) return true; } return false; }
function pairX(h, g) { for (let i = 0; i < h.length; i++) for (let j = 0; j < g.length; j++) if (X(h[i], h[(i + 1) % h.length], g[j], g[(j + 1) % g.length])) return true; return false; }
/* nejužší můstek mezi blízkými výřezy (vrcholy proti hranám) a největší koule (mřížka 3 mm) */
function webBall(holes) {
  const boxes = holes.map(bb); let web = Infinity, ball = 0;
  holes.forEach((h, i) => {
    const b = boxes[i];
    for (let x = b[0]; x <= b[2]; x += 3) for (let y = b[1]; y <= b[3]; y += 3) if (inside([x, y], h)) ball = Math.max(ball, 2 * polyDist([x, y], h));
    holes.forEach((g, j) => {
      if (j <= i) return; const a = boxes[i], c = boxes[j];
      if (a[0] - 10 > c[2] || c[0] - 10 > a[2] || a[1] - 10 > c[3] || c[1] - 10 > a[3]) return;
      if (pairX(h, g)) web = -1;
      h.forEach((p) => { web = Math.min(web, polyDist(p, g)); }); g.forEach((p) => { web = Math.min(web, polyDist(p, h)); });
    });
  });
  return { web, ball };
}
/* plocha ořezu: u výřezů, které okraj protíná, plocha kusů z clipRect = plocha průniku spočítaná mřížkou 0,5 mm;
   a součet ploch výřezů plechu = součet ořezaných ploch všech výřezů motivu (data jdou do plechu celá) */
function innerPlanes(inner) {
  const ccw = area(inner) > 0;
  return inner.map((a, i) => { const b = inner[(i + 1) % inner.length], e = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(e[0], e[1]);
    return [(q) => (ccw ? 1 : -1) * (e[0] * (q[1] - a[1]) - e[1] * (q[0] - a[0])) / L, [e[0] / L, e[1] / L]]; });
}
function clipCheck(m) {
  const pn = m.pn, V = pn.variant || pn.motif, inner = pn.inner, planes = innerPlanes(inner);
  let bad = 0, tot = 0, sumClip = 0;
  V.holes.forEach((f) => {
    const pl = []; for (let i = 0; i < f.length; i += 3) pl.push(pn.map(f[i], f[i + 1]));
    const b = bb(pl), ib = bb(inner);
    if (b[2] < ib[0] || b[0] > ib[2] || b[3] < ib[1] || b[1] > ib[3]) return;
    const pieces = Z.clipPlanes(pl, planes).filter((q) => q.length > 2 && Math.abs(area(q)) > 10);
    const pa = pieces.reduce((a, q) => a + Math.abs(area(q)), 0); sumClip += pa;
    if (pl.every((q) => planes.every(([f]) => f(q) >= 0))) return;                // celý uvnitř
    let cnt = 0;
    for (let x = b[0] + 0.13; x < b[2]; x += 0.5) for (let y = b[1] + 0.11; y < b[3]; y += 0.5) if (inside([x, y], pl) && planes.every(([f]) => f([x, y]) >= 0)) cnt++;
    tot++; if (Math.abs(cnt * 0.25 - pa) > 0.03 * pa + 25) bad++;
  });
  const sumPanel = pn.holesXY.reduce((a, q) => a + Math.abs(area(q)), 0);
  // drobné kusy u okraje, které by nechaly úzký můstek, konfigurátor záměrně vynechá nebo výřez u okraje ustřihne dál – nanejvýš 3 % plochy
  if (sumPanel > sumClip + 1 || sumClip - sumPanel > 0.03 * sumClip) { bad += 1000; console.log('     plocha výřezů ' + V.id + (pn.mirror ? ' zrcadlo' : '') + ': plech ' + sumPanel.toFixed(0) + ' / ořez ' + sumClip.toFixed(0)); }
  return { bad, tot };
}
const base = { vypln: "laser", rada: "priroda" };
const CASES = [
  ["rovné 3 m, výchozí", { segs: [{ L: 3000, rise: 0 }] }],
  ["tři motivy, posuny 0/½/1, z boku", { segs: [{ L: 3900, rise: 0 }], postPitch: 1300, pole: [{ m: "jelen", p: 0 }, { m: "medved", p: 1 }, { m: "smrky", p: 0.5 }] }],
  ["motýl v botanickém motivu", { segs: [{ L: 3000, rise: 0 }], motiv: "motyl", pole: [{ m: "motyl" }, { m: "motyl" }] }],
  ["motýl A z první předlohy", { segs: [{ L: 3000, rise: 0 }], motiv: "motyl-a", pole: [{ m: "motyl-a" }, { m: "motyl-a" }] }],
  ["motýl B z druhé předlohy", { segs: [{ L: 3000, rise: 0 }], motiv: "motyl-b", pole: [{ m: "motyl-b" }, { m: "motyl-b" }] }],
  ...[25, 27.5, 30, 32.5, 35, 37.5, 40].map((deg) => ["motýl na schodech " + deg + "°", {
    segs: [{ L: 2600, rise: Math.round(2600 * Math.tan(deg * Math.PI / 180)), steps: 9 }], motiv: "motyl", pole: [{ m: "motyl" }, { m: "motyl" }]
  }]),
  ...["motyl-a", "motyl-b"].flatMap((id) => [25, 27.5, 30, 32.5, 35, 37.5, 40].map((deg) => [id + " na schodech " + deg + "°", {
    segs: [{ L: 2600, rise: Math.round(2600 * Math.tan(deg * Math.PI / 180)), steps: 9 }], motiv: id, pole: [{ m: id }, { m: id }]
  }])),
  ["smrky posun 0 a 1, patky, plech 3", { segs: [{ L: 2600, rise: 0 }], postPitch: 1300, anchor: "patka", plech: 3, pole: [{ m: "smrky", p: 0 }, { m: "smrky", p: 1 }] }],
  ["rozteč 700, čelo, plech 6", { segs: [{ L: 2100, rise: 0 }], postPitch: 700, anchor: "celo", plech: 6, pole: [{ m: "medved" }, { m: "jelen" }, { m: "smrky" }] }],
  ["los, posun 0 a 1, plech 5", { segs: [{ L: 2600, rise: 0 }], postPitch: 1300, plech: 5, pole: [{ m: "los", p: 0 }, { m: "los", p: 1 }] }],
  ["schody 30° nahoru", { segs: [{ L: 2600, rise: 1500, steps: 9 }], anchor: "patka", postPitch: 1100, pole: [{ m: "los", p: 0.3 }, { m: "smrky" }, { m: "los", p: 1 }] }],
  ["schody 35° dolů (zrcadlo)", { segs: [{ L: 2400, rise: -1700, steps: 9 }], pole: [{ m: "los", p: 1 }, { m: "smrky", p: 0 }, { m: "los", p: 0 }] }],
  ["schody 40° nahoru", { segs: [{ L: 2400, rise: 2014, steps: 11 }], pole: [{ m: "los", p: 0.5 }, { m: "smrky", p: 1 }, { m: "los" }] }],
  ["schody + podesta + roh", { segs: [{ L: 2380, rise: 1500, steps: 9 }, { L: 2000, rise: 0, turn: 90 }, { L: 1500, rise: 0 }], anchor: "patka", pole: [{ m: "smrky" }, { m: "los" }, { m: "los", p: 0.9 }, { m: "jelen" }, { m: "medved", p: 0.4 }, { m: "jelen", p: 1 }, { m: "smrky" }] }],
  ["roh L, bez madla", { segs: [{ L: 2500, rise: 0, turn: 90 }, { L: 2000, rise: 0 }], madlo: false, pole: [{ m: "jelen", p: 0.2 }, { m: "smrky", p: 0.8 }, { m: "medved" }, { m: "jelen", p: 1 }, { m: "smrky" }] }]
];
CASES.forEach(([lab, c], ci) => {
  if (process.env.CASE && lab.indexOf(process.env.CASE) < 0) return;
  const t0 = Date.now(), A = Z.analyze(Object.assign({}, base, c)), lay = A.lay, cfg = A.cfg;
  const panels = lay.members.filter((m) => m.kind === "panel");
  if (cfg.rada !== "priroda") fail(lab, "konfigurace není Příroda");
  if (panels.length !== lay.fields.length || lay.panels.some((p) => !p.ok)) fail(lab, "plechů " + panels.length + " na " + lay.fields.length + " polí: " + lay.panels.filter((p) => !p.ok).map((p) => p.why).join(","));
  if (A.warns.some((w) => w.lvl === "bad")) fail(lab, "nečekané varování: " + A.warns.filter((w) => w.lvl === "bad").map((w) => w.t).join(" | "));
  const want = Z.fieldsOf(cfg);
  let minWeb = Infinity, maxBall = 0, clipBad = 0, clipTot = 0;
  panels.forEach((m, i) => {
    const pn = m.pn, M = pn.motif;
    if (M.id !== want[i].m) fail(lab, "pole " + (i + 1) + " má motiv " + M.id + " místo " + want[i].m);
    if (m.t !== cfg.plech) fail(lab, "plech " + m.t + " mm místo " + cfg.plech);
    const s = m.solid;
    if (!G.checkClosed(s.verts, s.faces)) fail(lab, "plech " + (i + 1) + " není uzavřené těleso");
    const hs = Z.panelHoles(m, P.tol3d), net = (Math.abs(area(m.outline)) - hs.reduce((a, h) => a + Math.abs(area(h)), 0)) * m.t;
    if (Math.abs(Z.volume(s) - net) > 1e-6 * net + 1) fail(lab, "objem plechu nesedí");
    const pls = innerPlanes(pn.inner);
    if (hs.some((h) => h.some((q) => pls.some(([f]) => f(q) < -1e-6)))) fail(lab, "výřez zasahuje do okraje " + P.border + " mm");
    const X0 = pn.inner[0][0], X1 = pn.inner[1][0];
    if (m.pn.tan && !m.pn.variant) fail(lab, "šikmé pole bez šikmé verze motivu");
    if (m.pn.tan && (m.pn.mirror !== m.pn.tan < 0)) fail(lab, "zrcadlo nesedí se směrem schodů");
    if (hs.some(selfX)) fail(lab, "výřez se kříží sám se sebou");
    const r = webBall(hs);
    if (r.web < 0) fail(lab, "pole " + (i + 1) + ": výřezy se navzájem kříží");
    minWeb = Math.min(minWeb, r.web); maxBall = Math.max(maxBall, r.ball);
    if (r.ball > 110 + 1) fail(lab, "otvor Ø" + r.ball.toFixed(0) + " mm");
    (M.anim || []).filter((a) => a[2]).forEach((a) => {
      const xs = [pn.map(a[0], 0)[0], pn.map(a[1], 0)[0]], xa = Math.min(...xs), xb = Math.max(...xs);
      if (xa < X0 - 1 || xb > X1 + 1) fail(lab, "pole " + (i + 1) + ": hlavní zvíře " + M.lab + " je uříznuté (" + xa.toFixed(0) + "–" + xb.toFixed(0) + " mimo " + X0.toFixed(0) + "–" + X1.toFixed(0) + ")");
    });
    const cc = clipCheck(m); clipBad += cc.bad; clipTot += cc.tot;
  });
  if (clipBad) fail(lab, "ořez na okraji: " + clipBad + " z " + clipTot + " bodů nesedí");
  if (minWeb < P.webTarget * P.sMin - 0.6) fail(lab, "můstek " + minWeb.toFixed(1) + " mm");
  A.rows.filter((r) => r.kind === "panel").forEach((r) => {
    const d = Z.panelDxf(r.part), txt = G.dxf(Object.assign({ poz: r.poz }, d));
    const nPoly = (txt.match(/\nPOLYLINE\n/g) || []).length;
    if (nPoly !== d.polys.length || d.polys.length !== r.part.pn.holesXY.length) fail(lab, "DXF: " + nPoly + " výřezů místo " + r.part.pn.holesXY.length);
    if (Math.min(...d.poly.flat()) < -1e-6) fail(lab, "DXF má záporné souřadnice");
    if (!/_plech\d_motiv-(jelen|medved|smrky|los|motyl(?:-a|-b)?)(@\d+)?_/.test(r.file)) fail(lab, "název DXF " + r.file);
  });
  if (ci === 1) { const st = validate(G.stepFile("priroda", lay.members.map((m) => m.solid)), "priroda"); if (st.errs.length) fail(lab, "STEP: " + st.errs.slice(0, 2).join("; ")); }
  console.log((fails ? "…   " : "OK   ") + lab.padEnd(38) + " polí " + panels.length + "  plech " + Array.from(new Set(panels.map((m) => Math.round(m.w) + "×" + Math.round(m.l)))).join(", ") + " × " + cfg.plech +
    "  můstek " + minWeb.toFixed(1) + "  otvor Ø" + maxBall.toFixed(0) + "  ořez " + clipBad + "/" + clipTot + "  řez " + A.laserM.toFixed(1) + " m  (" + (Date.now() - t0) + " ms)");
});
// zákazy
const nope = (lab, c, re) => { const A = Z.analyze(Object.assign({}, base, c)); if (!A.warns.some((w) => w.lvl === "bad" && re.test(w.t))) fail(lab, "chybí blokující varování"); else console.log("OK   zákaz: " + lab); };
nope("sklon 20°", { segs: [{ L: 3000, rise: 1092, steps: 8 }], motiv: "los" }, /jiný sklon/);
nope("sklon 45°", { segs: [{ L: 2000, rise: 2000, steps: 11 }], motiv: "smrky" }, /jiný sklon/);
nope("jelen na schodech", { segs: [{ L: 2600, rise: 1500, steps: 9 }], pole: [{ m: "jelen" }, { m: "los" }, { m: "los" }] }, /jen motivy/);
nope("medvěd na schodech", { segs: [{ L: 2600, rise: 1500, steps: 9 }], pole: [{ m: "los" }, { m: "medved" }, { m: "los" }] }, /jen motivy/);
nope("výška 1200 z boku", { segs: [{ L: 3000, rise: 0 }], vyska: 1200 }, /moc vysoké/);
// tloušťka: rozmezí z motivů, nabídka a doporučení
const rg = Z.plechRange(["jelen", "medved", "smrky"]);
if (rg.min !== 3 || rg.max !== 6 || rg.rec !== 5) fail("tloušťka", JSON.stringify(rg));
const rgL = Z.plechRange(["jelen", "los"]);
if (rgL.max !== 5 || rgL.ok.indexOf(6) >= 0) fail("tloušťka", "Los je jemnější – plech nejvýš 5 mm: " + JSON.stringify(rgL));
if (!Z.MOTIFS.some((m) => m.id === "motyl" && m.lab === "Motýl C" && m.rada === "priroda")) fail("katalog", "Motýl C není volbou řady Příroda nebo se změnilo původní ID");
["motyl-a", "motyl-b"].forEach((id) => {
  if (!Z.MOTIFS.some((m) => m.id === id && /^Motýl [AB]$/.test(m.lab) && m.rada === "priroda")) fail("katalog", id + " není volbou řady Příroda");
});
[25, 27.5, 30, 32.5, 35, 37.5, 40].forEach((deg) => {
  const v = globalThis.ZabradliMotivy["motyl@" + Math.round(deg * 10)];
  if (!v || v.base !== "motyl" || v.animFit !== true || v.web < 8 - 1e-6 || v.ball > 110 || !v.holes.length)
    fail("motýl – schody " + deg + "°", "chybí použitelná předpočítaná varianta");
});
["motyl-a", "motyl-b"].forEach((id) => [25, 27.5, 30, 32.5, 35, 37.5, 40].forEach((deg) => {
  const v = globalThis.ZabradliMotivy[id + "@" + Math.round(deg * 10)];
  if (!v || v.base !== id || v.animFit !== true || v.web < 8 - 1e-6 || v.ball > 110 || !v.holes.length)
    fail(id + " – schody " + deg + "°", "chybí použitelná předpočítaná varianta");
}));
nope("los s plechem 6", { segs: [{ L: 2600, rise: 0 }], postPitch: 1300, plech: 6, pole: [{ m: "los" }, { m: "jelen" }] }, /nejde pro vybrané motivy/);
if (Z.normalize(Object.assign({}, base, { plech: 8 })).plech !== P.tDef) fail("tloušťka", "nepovolená tloušťka se nevrátila na výchozí");
// ořez polygonu: konkávní „U“ přes hranu se rozpadne na dva kusy bez mostu po hraně
const U = [[0, 0], [30, 0], [30, 40], [20, 40], [20, 10], [10, 10], [10, 40], [0, 40]];
const cut = Z.clipRect(U, -5, -5, 50, 25);
if (cut.length !== 1 || Math.abs(Math.abs(area(cut[0])) - (30 * 10 + 2 * 10 * 15)) > 1e-6) fail("clipRect", "U zespodu: " + cut.length + " kusů, plocha " + (cut[0] && area(cut[0])));
const cut2 = Z.clipRect(U, -5, 15, 50, 60);
if (cut2.length !== 2 || cut2.some((q) => Math.abs(Math.abs(area(q)) - 250) > 1e-6)) fail("clipRect", "U shora: " + cut2.length + " kusů " + cut2.map((q) => area(q)).join(","));
// ostatní výplně beze změny
const std = Z.analyze({ segs: [{ L: 3000, rise: 0 }], sloupky: true });
if (std.lay.members.some((m) => m.kind === "panel")) fail("standard", "výplň se změnila");
const ab = Z.analyze({ vypln: "laser", segs: [{ L: 3000, rise: 0 }] });
if (ab.cfg.rada !== "abstrakt" || ab.lay.members.filter((m) => m.kind === "panel").some((m) => m.pn.crop || m.pn.motif.id !== "strom")) fail("laser", "abstraktní motiv se změnil");
const appHtml = require("fs").readFileSync(__dirname + "/../zabradli.html", "utf8");
if (!/function motylChoice\(/.test(appHtml) || !/data-motyl-variant/.test(appHtml)) fail("ovládání motýla", "chybí velká karta motýla s volbami A/B/C");
if (/id="prAllMotylPreview"/.test(appHtml) || !/\.motyl-variants \{ display: flex; flex-direction: column/.test(appHtml)) fail("ovládání motýla", "A/B/C nemá být vedle samostatného náhledu a pod sebou");
if (/data-motif-thumb/.test(appHtml)) fail("ovládání motýla", "v kartách se stále opakují velké náhledy A/B/C");
console.log(fails ? "\n" + fails + " chyb" : "\nPříroda: vše v pořádku");
process.exit(fails ? 1 : 0);
