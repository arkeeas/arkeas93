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
  A.parts.concat(A.lay.members.filter((m) => m.kind === "rod")).forEach((m, i) => {
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
  return { A, errs };
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
console.log((bad ? "\n" + bad + " chyb" : "\nvše v pořádku") + " (" + n + " konfigurací)");
process.exit(bad ? 1 : 0);
