/*
 * Kontrola zábradlí (zabradli-core.js) bez CAD:
 *   1. vzor akce 01 – délky a úhly rámu proti kusovníku vzoru (railing.py / SolidWorks),
 *   2. vzor akce 02 – pole, rámy, vložky, madla, kotvy proti railing_b.py,
 *   3. všechny typy × tvary × kotvení × strany × profily: uzavřená tělesa, platný STEP dílů i sestavy,
 *      zámky jen v rovné části stěny rámu (mimo rádius ~2,4 t), drážka uvnitř stěny.
 *   node tests/kontrola-zabradli.js [-v]
 */
"use strict";
const path = require("path");
const ROOT = path.join(__dirname, "..");
require(path.join(ROOT, "core.js")); require(path.join(ROOT, "gen.js")); require(path.join(ROOT, "zabradli-core.js"));
const { validate } = require("./validate-step.js");
const G = globalThis.Generator, Z = globalThis.Zabradli, V = Z.V;
const verbose = process.argv.includes("-v");
let bad = 0;
const fail = (t) => { bad++; console.log("CHYBA " + t); };

/* 1. akce 01 */
{
  const lay = Z.layoutA([[0, 2000, 0], [0, 0, 0], [-2000, 0, 0], [-5464.1, 0, -2000]], { locks: false });
  const got = {};
  lay.members.filter((m) => m.kind === "tube").forEach((m) => { const k = m.role + " " + Math.round(m.L) + " " + m.a1 + "/" + m.a2; got[k] = (got[k] || 0) + 1; });
  const want = { "rail 2040 45/45": 2, "rail 2025 45/15": 2, "rail 4017 15/30": 1, "rail 4029 15/60": 1, "end_post 1040 45/45": 1, "end_post 1046 60/30": 1, "post 964 0/0": 3, "post 970 0/0": 1, "post 977 30/30": 2 };
  const ok = JSON.stringify(Object.keys(want).sort().map((k) => [k, want[k]])) === JSON.stringify(Object.keys(got).sort().map((k) => [k, got[k]]));
  if (!ok) fail("akce 01: kusovník rámu nesedí se vzorem " + JSON.stringify(got)); else console.log("OK    akce 01 – rám odpovídá vzoru (24,1 m jeklu)");
  const nb = lay.members.filter((m) => m.kind === "bar").length;
  if (nb !== 62) fail("akce 01: " + nb + " pásovin místo 62");
}

/* 2. akce 02 */
{
  const lay = Z.layoutB([[-2383.5, 0, -2000], [0, 0, 0], [4500, 0, 0], [4500, 3000, 0]], { arm_len: 250 });
  const fl = lay.fields.map((f) => Math.round(f.L)).join(",");
  const arms = lay.members.filter((m) => m.role === "arm").length, ins = lay.members.filter((m) => m.role === "insert").length;
  const hr = lay.members.filter((m) => m.role === "handrail").map((m) => Math.round(m.L)).join(",");
  const bars = lay.members.filter((m) => m.role === "bar").length;
  if (fl !== "1343,1317,1291,1369,1369,1306,1257,1361" || arms !== 15 || ins !== 14 || hr !== "3120,4548,3040" || bars !== 87) fail("akce 02: " + [fl, arms, ins, hr, bars].join(" | "));
  else console.log("OK    akce 02 – pole, kotvy (15), vložky (14), madla a špruše (87) odpovídají railing_b.py");
}

/* 3. matice konfigurací */
function check(cfg) {
  const A = Z.analyze(cfg), errs = [];
  A.lay.members.forEach((m, i) => {
    if (!G.checkClosed(m.solid.verts, m.solid.faces)) errs.push((m.poz || "") + " " + (m.name || m.role) + ": těleso není uzavřené");
  });
  A.rows.filter((r) => r.part).forEach((r) => {
    if (r.kind === "wood") return;
    const res = validate(G.stepFile(r.poz, [Z.toLocal(r.part)]), r.poz);
    res.errs.slice(0, 2).forEach((e) => errs.push(r.poz + " " + r.name + ": " + e));
    if (Z.volume(r.part.solid) <= 0) errs.push(r.poz + ": nulový objem");
  });
  const bodies = A.lay.members.map((m) => m.solid);
  validate(G.stepFile("sestava", bodies), "sestava").errs.slice(0, 3).forEach((e) => errs.push("sestava: " + e));
  // zámky: drážka napříč ≤ rovná část stěny, celá mezi řezy rámu
  A.lay.members.filter((m) => m.kind === "tube" && m.holes.length).forEach((m) => {
    const flat = 2 * m.h1 - 2 * 2.4 * m.t;
    m.holes.forEach((h) => {
      const xs = h.pts.map((p) => V.dot(V.sub(p, m.p0), m.e1));
      const w = Math.max(...xs) - Math.min(...xs), c = (Math.max(...xs) + Math.min(...xs)) / 2;
      if (w > flat + 1e-6 || Math.abs(c) > 1e-6) errs.push(m.name + ": drážka " + w.toFixed(1) + " mm mimo rovnou část stěny (" + flat.toFixed(1) + ")");
      const onAx = (p) => V.add(p, V.mul(h.dir, V.dot(V.sub(m.p0, p), m.e2) / V.dot(h.dir, m.e2)));   // průmět do roviny osy rámu ve směru průchodu
      const ax = h.pts.map((p) => V.dot(V.sub(onAx(p), m.p0), m.d));
      const lo = V.dot(V.sub(m.cut0.p, m.p0), m.d), hi = V.dot(V.sub(m.cut1.p, m.p0), m.d);
      if (Math.min(...ax) < lo + m.t || Math.max(...ax) > hi - m.t) errs.push(m.name + ": drážka přetéká přes konec rámu");
    });
  });
  if (A.locks.ok !== A.lay.members.some((m) => m.kind === "tube" && m.holes.length)) errs.push("pravidlo zámků nesedí s modelem");
  // spoj špruší: počty drážek, zámečků a kusů podle režimu
  const jt = A.locks, c = A.cfg, bars = A.parts.filter((m) => m.role === "bar"), nB = bars.length;
  const holes = A.lay.members.filter((m) => m.role === "rail").reduce((a, m) => a + m.holes.length, 0);
  const tabsN = A.parts.reduce((a, m) => a + (m.tabs || 0), 0);
  const over = A.parts.filter((m) => m.role === "over").length, overT = A.parts.filter((m) => m.role === "overtop").length;
  if (jt.mode === "drazka") {
    if (holes !== nB * ((c.overBot ? 2 : 1) + (c.overTop ? 2 : 1))) errs.push("drážka: " + holes + " drážek na " + nB + " špruší");
    if (over || overT || tabsN) errs.push("drážka: přesah má být jedním kusem bez zámečků");
  } else {
    if (over !== (c.overBot ? nB : 0) || overT !== (c.overTop ? nB : 0)) errs.push(jt.mode + ": přesahy " + over + "/" + overT + " na " + nB + " špruší");
    if (jt.mode === "zamek") {
      if (tabsN !== holes || tabsN !== 2 * nB + over + overT) errs.push("zámečky: " + tabsN + " zámečků, " + holes + " drážek");
      if (jt.tw + 2 * 0.5 > jt.flat) errs.push("zámeček " + jt.tw + " mm se nevejde do rovné části stěny");
    } else if (holes || tabsN) errs.push("na tupo: v rámu jsou drážky");
  }
  if (jt.cls === "sirsi" && jt.mode !== "zamek") errs.push("širší špruše musí mít zámečky");
  // zámeček nevyčnívá: konec zámečku leží mezi vnějším a vnitřním lícem stěny rámu (lícuje s vnitřním)
  A.parts.filter((m) => m.tabs).forEach((m) => [[m.tab0, m.cut0], [m.tab1, m.cut1]].forEach(([tb, cu]) => {
    if (!tb) return;
    const depth = Math.abs(V.dot(V.sub(tb.p, cu.p), V.unit(tb.n)));
    if (Math.abs(depth - jt.rail.t) > 1e-6) errs.push(m.name + ": zámeček " + depth.toFixed(2) + " mm místo stěny " + jt.rail.t);
  }));
  if (!(A.price > 0)) errs.push("cena nevyšla");
  // řezný plán: každý kus jekl/pásoviny právě jednou, žádná tyč přes délku
  const R = A.R, plan = Z.cutPlan(A), want = A.rows.filter((r) => r.kind === "tube" || r.kind === "bar").reduce((a, r) => a + r.q * A.cfg.qty, 0);
  const got = plan.reduce((a, g) => a + g.bars.reduce((b, x) => b + x.pieces.length, 0) + g.over.length, 0);
  if (got !== want) errs.push("řezný plán: " + got + " kusů místo " + want);
  plan.forEach((g) => g.bars.forEach((b) => { const L = b.pieces.reduce((a, p) => a + p.L, 0) + (b.pieces.length - 1) * g.kerf + g.end; if (L > R.tycDelka + 1e-6) errs.push("řezný plán: tyč " + g.prof + " přeplněná " + L.toFixed(1)); }));
  // svislé díly (špruše, sloupky) se v půdorysu nesmí překrývat – hlavně v rozích
  const rect = (m) => ({ c: [m.p0[0], m.p0[1]], a: [[m.e1[0], m.e1[1]], [m.e2[0], m.e2[1]]], h: [m.h1, m.h2] });
  const ov = (P, Q) => [...P.a, ...Q.a].every((n) => {
    const pr = (R) => Math.abs(R.a[0][0] * n[0] + R.a[0][1] * n[1]) * R.h[0] + Math.abs(R.a[1][0] * n[0] + R.a[1][1] * n[1]) * R.h[1];
    return Math.abs((P.c[0] - Q.c[0]) * n[0] + (P.c[1] - Q.c[1]) * n[1]) < pr(P) + pr(Q) - 0.01;
  });
  const vert = A.parts.filter((m) => ["bar", "post", "end_post"].includes(m.role) && Math.abs(m.d[2]) > 0.99).map(rect);
  for (let i = 0; i < vert.length; i++) for (let j = i + 1; j < vert.length; j++) if (ov(vert[i], vert[j])) { errs.push("svislé díly se v půdorysu překrývají"); i = vert.length; break; }
  // kotvy: jen na povolených místech, počet ramen = počet kotev
  const an = A.lay.anch;
  if (an && cfg.anchor === "bocni") {
    if (an.used.some((x) => an.cand.indexOf(x) < 0)) errs.push("kotva mimo povolené místo");
    const arms = A.parts.filter((m) => m.role === "arm").length;
    if (arms !== an.used.length) errs.push("ramen " + arms + ", kotev " + an.used.length);
  }
  kotveni(A, errs);
  return { A, errs };
}
/* kotvení: patky stojí na podlaze / stupni (žádný schod do nich nezasahuje, kotva ≥ 50 mm od hrany),
   plotna přes čelo celá pod podlahou / stupni, nožky dosedají na plotny, ke každé plotně 2 kotvy, podložky jen pod plotnami na čele / zdi */
function kotveni(A, errs) {
  const c = A.cfg, lay = A.lay, mem = lay.members, segs = lay.segs, R = Z.routePoints(c.segs);
  const floors = (p) => {                                           // výšky podlahy pod bodem půdorysu (všechny úseky, které ho obsahují)
    const out = [];
    c.segs.forEach((sg, k) => {
      const a = R[k], b = R[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], Lh = Math.hypot(dx, dy);
      const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / Lh, q = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / Lh;
      if (t < -1e-6 || t > Lh + 1e-6 || q > 100) return;
      if (!sg.rise) { out.push(a[2]); return; }
      const nt = (sg.steps || Math.max(2, Math.round(Math.abs(sg.rise) / 175) + 1)) - 1, i = Math.max(0, Math.min(nt - 1, Math.floor(t / Lh * nt + 1e-9)));
      out.push(a[2] + (sg.rise * i + Math.min(0, sg.rise)) / nt);
    });
    return out;
  };
  const plates = mem.filter((m) => m.kind === "plate"), rods = mem.filter((m) => m.kind === "rod"), pads = mem.filter((m) => m.kind === "pad");
  if (rods.length !== 2 * plates.length) errs.push("kotev " + rods.length + " na " + plates.length + " ploten");
  const vertical = plates.filter((m) => ["plotna", "celo", "zed"].includes(m.role)).length;
  if (pads.length !== (c.podlozka && Z.padAllowed(c) ? vertical : 0)) errs.push("podložek " + pads.length + ", ploten na čele / zdi " + vertical);
  const stubs = mem.filter((m) => m.role === "stub");
  plates.filter((m) => m.role === "patka").forEach((m) => {
    const zf = m.o[2];
    for (let u = -m.w / 2; u <= m.w / 2 + 1e-6; u += 5) {
      const f = floors(V.add(m.o, V.mul(m.ex, u)));
      if (f.length && Math.max(...f) > zf + 0.5) { errs.push("patka zasahuje do schodu (" + Math.round(Math.max(...f) - zf) + " mm)"); return; }
    }
    // za koncem trasy podlahu neznáme – na rovině ji bereme jako pokračující (patka na konci lícuje s koncovým sloupkem)
    // na konci schodiště nahoře (hrana podesty) podesta za koncem pokračuje ve stejné výšce
    const flatEnd = [[0, 0, -1], [R.length - 1, c.segs.length - 1, 1]].some(([i, k, sg]) => (!c.segs[k].rise || c.segs[k].rise * sg > 0) && Math.hypot(m.o[0] - R[i][0], m.o[1] - R[i][1]) < 200);
    for (const u of [-50, 0, 50]) { const f = floors(V.add(m.o, V.mul(m.ex, u))); if (!(f.some((z) => Math.abs(z - zf) < 0.5) || (!f.length && flatEnd))) { errs.push("kotva patky není 50 mm od hrany podlahy / stupně"); return; } }
    if (c.segs.some((sg) => sg.rise) && !stubs.some((st) => Math.abs(st.p0[2] - (zf + m.t)) < 0.01 && Math.hypot(st.p0[0] - m.o[0], st.p0[1] - m.o[1]) < m.w / 2)) errs.push("patka bez nožky");
  });
  plates.filter((m) => m.role === "celo").forEach((m) => {
    const top = m.o[2] + m.l / 2;
    for (let u = -m.w / 2; u <= m.w / 2 + 1e-6; u += 5) { const f = floors(V.add(m.o, V.mul(m.ex, u))); if (f.length && top > Math.min(...f) - 24.99) { errs.push("plotna přes čelo není pod podlahou / stupni"); return; } }
    if (!stubs.some((st) => Math.abs(st.p0[2] - (m.o[2] - m.l / 2)) < 0.01 && Math.hypot(st.p0[0] - m.o[0], st.p0[1] - m.o[1]) < m.w / 2 + 25)) errs.push("plotna přes čelo bez nožky");
  });
  if (c.anchor !== "bez") {
    const zw = plates.filter((m) => m.role === "zed").length, ends = (c.zed.start ? 1 : 0) + (c.zed.end ? 1 : 0);
    if (zw < ends || zw > 2 * ends) errs.push("ploten ke zdi " + zw + " na " + ends + " konce u zdi");
    if (ends && A.kotvy.pts.length && ((c.zed.start && A.kotvy.ends[0] > 1e-6) || (c.zed.end && A.kotvy.ends[1] > 1e-6))) errs.push("konec u zdi se nepočítá jako ukotvený");
  }
  if (c.anchor === "patka" || c.anchor === "celo") {
    const used = A.lay.anch.used, want = plates.filter((m) => m.role === c.anchor).length;
    if (used.length !== want) errs.push("kotev v pásu " + used.length + ", ploten " + want);
  }
}
let n = 0;
const run = (cfg, quiet) => {
  const nc = Z.normalize(cfg);
  if (nc.anchor !== cfg.anchor) return;                      // patka jen u typu A na rovině
  const { A, errs } = check(cfg); n++;
  const lab = cfg.typ + " " + (cfg.preset || "") + " " + cfg.anchor + " " + cfg.side + " " + [nc.rail, nc.bar, A.locks.mode, "přesah " + nc.overTop + "/" + nc.overBot, nc.madlo ? "madlo" : ""].join(" ") + " – " + A.parts.length + " dílů, " + A.rows.length + " pozic";
  if (errs.length) { fail(lab); errs.slice(0, 5).forEach((e) => console.log("   - " + e)); }
  else if (verbose && !quiet) console.log("OK    " + lab);
};
// a) všechny tvary × kotvení × strany se vzorovými profily
for (const typ of ["A", "B"]) for (const pr of Z.PRESETS) for (const anchor of ["bocni", "patka", "bez"]) for (const side of ["L", "R"])
  for (const madlo of typ === "B" ? [true, false] : [false])
    run({ typ, preset: pr.id, segs: pr.segs, anchor, side, madlo, vyska: typ === "A" ? 1050 : 1000 });
// b) rám × špruše × spoj × přesahy na tvarech s rohem a se schodištěm
for (const typ of ["A", "B"]) for (const rail of Z.RAILS[typ]) for (const bar of Z.BARS) for (const join of ["tupo", "zamek"])
  for (const [overTop, overBot] of [[0, 0], [0, 150], [120, 0], [120, 200]]) for (const pid of ["schodypod"]) for (const anchor of ["bocni"]) {
    const pr = Z.PRESETS.find((p) => p.id === pid);
    run({ typ, preset: pid, segs: pr.segs, anchor, side: "L", madlo: typ === "B" && !overTop, rail: rail.id, bar: bar.id, join, overTop, overBot, vyska: 1000 }, true);
  }
// c) sloupky + dřevěné madlo, rozteč sloupků, rozteč kotev a ručně zadané kotvy
for (const pid of ["L", "schodypod"]) for (const postPitch of [600, 1500]) for (const kotvy of [{}, { kotvyRoztec: 700 }, { kotvyPos: [0, 333, 1500, 2600, 9999] }]) for (const sloupky of [true, false]) {
  const pr = Z.PRESETS.find((p) => p.id === pid);
  run(Object.assign({ typ: sloupky ? "A" : "B", sloupky, preset: pid, segs: pr.segs, anchor: "bocni", side: "R", madlo: true, postPitch }, kotvy), true);
}
// e) vlastní úhly rohů (vnitřní úhel 60–179°), široká i úzká špruše
for (const turn of [30, 75, 120, -60, -120]) for (const sloupky of [true, false]) for (const bar of ["20x5", "60x10"])
  run({ typ: sloupky ? "A" : "B", sloupky, preset: "uhel" + turn, segs: [{ L: 3000, rise: 0, turn, custom: true }, { L: 2500, rise: 0, turn: -turn / 2, custom: true }, { L: 2000, rise: 0 }], anchor: "bocni", side: "L", madlo: true, bar }, true);
// f) kotvení shora / přes čelo (i na schodišti), konce ke zdi, podložky – se sloupky i bez
for (const pr of Z.PRESETS) for (const anchor of ["patka", "celo", "bocni"]) for (const side of ["L", "R"]) for (const zed of [{}, { start: true }, { start: true, end: true }]) for (const podlozka of [false, true]) for (const sloupky of anchor === "bocni" ? [true, false] : [true]) {
  const segs = pr.segs.map((x) => Object.assign({}, x, x.rise ? { steps: 11 } : {}));
  run({ typ: sloupky ? "A" : "B", sloupky, preset: pr.id + " zeď " + JSON.stringify(zed) + (podlozka ? " podložka" : ""), segs, anchor, side, zed, podlozka, madlo: true, postPitch: 1000 }, true);
}
// g) schodiště dolů, rozteč sloupků, úzké stupně
for (const anchor of ["patka", "celo"]) for (const postPitch of [600, 1500]) for (const steps of [8, 13])
  run({ typ: "A", sloupky: true, preset: "dolu" + steps, segs: [{ L: 1500, rise: 0, turn: -90 }, { L: 2400, rise: -1500, steps, turn: 90 }, { L: 1200, rise: 0 }], anchor, side: "L", madlo: false, postPitch, zed: { end: true } }, true);
{
  const A = Z.analyze({ sloupky: true, anchor: "patka", segs: [{ L: 3000, rise: 1800 }] });
  if (!A.warns.some((w) => w.lvl === "bad" && /počet schodů/.test(w.t))) fail("patky na schodišti bez počtu schodů nehlásí chybu");
  const B = Z.analyze({ sloupky: true, anchor: "patka", segs: [{ L: 3000, rise: 1800, steps: 11 }] });
  if (B.warns.some((w) => w.lvl === "bad")) fail("patky na schodišti s počtem schodů hlásí chybu: " + B.warns.filter((w) => w.lvl === "bad").map((w) => w.t).join("; "));
  const C = Z.analyze({ sloupky: false, anchor: "celo" });
  if (C.cfg.anchor !== "bocni") fail("přes čelo bez sloupků má spadnout na kotvení z boku");
  console.log("OK    kotvení shora a přes čelo – počet schodů, jen se sloupky");
}
// d) stavba z bloků: trasa ze změřených bloků, kontrola měření
{
  const st = { on: true, start: "zed", end: "volny", deska: 180, bloky: [{ t: "schody", n: 12, h: 172, g: 280, H: 2064, turn: 90 }, { t: "hrana", A: 4480, B: 4484, turn: 90, C: 1414 }, { t: "hrana", A: 3000, B: 3004 }] };
  const A = Z.analyze({ stavba: st, anchor: "bocni" });
  const sg = A.cfg.segs.map((x) => [x.L, x.rise, x.turn].join("/")).join(" ");
  if (sg !== "3080/1892/90 4482/0/90 3002/0/0") fail("stavba: trasa " + sg);
  if (A.meas.missing.length || A.meas.remeasure.some((m) => m.lvl !== "info")) fail("stavba: změřená a sedící stavba hlásí " + JSON.stringify(A.meas));
  const chyby = Z.analyze({ stavba: Object.assign({}, st, { deska: null, bloky: [{ t: "hrana", A: 3000, B: 3300, turn: 90, C: 1300 }, { t: "hrana", A: null, B: 2000 }] }), anchor: "bocni" });
  const ks = chyby.meas.missing.map((m) => m.k).sort().join(",") + " | " + chyby.meas.remeasure.map((m) => m.k).sort().join(",");
  if (ks !== "A,deska | A,C") fail("stavba: kontrola měření " + ks);
  for (const anchor of ["patka", "celo"]) {                    // stavba se schody, začátek u zdi – patky / čelo, plotny ke zdi
    const r = check({ stavba: st, anchor, sloupky: true, zed: { start: true, end: true }, podlozka: true }); n++;
    if (r.errs.length) fail("stavba " + anchor + ": " + r.errs.slice(0, 3).join("; "));
    if (r.A.cfg.zed.end) fail("stavba: volný konec se nesmí kotvit ke zdi");
    if (r.A.warns.some((w) => w.lvl === "bad")) fail("stavba " + anchor + ": " + r.A.warns.filter((w) => w.lvl === "bad").map((w) => w.t).join("; "));
  }
  const { errs } = check({ stavba: st, anchor: "bocni" }); n++;
  if (errs.length) fail("stavba: " + errs.slice(0, 3).join("; "));
  else console.log("OK    stavba z bloků – trasa, kontrola měření, schody");
}
console.log((bad ? "\n" + bad + " chyb" : "\nvše v pořádku") + " (" + n + " konfigurací)");
process.exit(bad ? 1 : 0);
