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
  if (!(A.price > 0)) errs.push("cena nevyšla");
  return { A, errs };
}
let n = 0;
for (const typ of ["A", "B"]) for (const pr of Z.PRESETS) for (const anchor of ["bocni", "patka", "bez"]) for (const side of ["L", "R"]) {
  const variants = typ === "A" ? Z.PROF_A.flatMap((p) => Z.BAR_A.map((b) => ({ profA: p.id, barA: b.id }))) : [{ madlo: true }, { madlo: false }];
  for (const v of variants) {
    const cfg = Object.assign({ typ, segs: pr.segs, anchor, side, vyska: typ === "A" ? 1050 : 1000 }, v);
    const nc = Z.normalize(cfg);
    if (nc.anchor !== anchor) continue;                       // patka jen u typu A na rovině
    const { A, errs } = check(cfg); n++;
    const lab = typ + " " + pr.id + " " + anchor + " " + side + " " + JSON.stringify(v) + " – " + A.parts.length + " dílů, " + A.rows.length + " pozic, zámky " + (A.locks.ok ? "ano" : "ne");
    if (errs.length) { fail(lab); errs.slice(0, 5).forEach((e) => console.log("   - " + e)); }
    else if (verbose) console.log("OK    " + lab);
  }
}
console.log((bad ? "\n" + bad + " chyb" : "\nvše v pořádku") + " (" + n + " konfigurací)");
process.exit(bad ? 1 : 0);
