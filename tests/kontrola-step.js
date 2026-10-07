/*
 * Vygeneruje STEP všech tvarů podnoží (core.js + gen.js) a zkontroluje je bez CAD.
 *   node tests/kontrola-step.js [délka] [hloubka] [výška]
 */
"use strict";
const path = require("path");
const ROOT = path.join(__dirname, "..");
require(path.join(ROOT, "core.js")); require(path.join(ROOT, "vyvoj.js")); require(path.join(ROOT, "gen.js"));
const { validate } = require("./validate-step.js");
const K = globalThis.Podnoze, G = globalThis.Generator;
const [L, W, H] = [process.argv[2] || 1600, process.argv[3] || 800, process.argv[4] || 750];
let bad = 0;
// umělecké: všechny kombinace spojení noh × horní část, uchycení k desce u každé
const Vy = globalThis.Vyvoj || { MOUNTS: [], JOINTS: [], TOPS: [] };
const wipVars = [];
Vy.JOINTS.forEach((j) => Vy.TOPS.forEach((tp) => Vy.MOUNTS.forEach((mo) => { if (Vy.mountOk(mo.id, tp.id, 40)) wipVars.push({ joint: j.id, top: tp.id, mount: mo.id }); })));
// plotny X se všemi uchyceními, rámeček z jeklu od nejmenšího po největší
Vy.MOUNTS.forEach((mo) => { if (Vy.mountOk(mo.id, 'plotny')) wipVars.push({ joint: 'spojovak', top: 'plotny', plS: 'x', mount: mo.id }); });
// Vnořené rámy: výšky středního rámu a přesahy
[45, 55, 65].forEach((h) => [300, 600].forEach((o) => wipVars.push({ joint: 'spojovak', top: 'diag', vrH: h, vrO: o, mount: 'vrut', L: 1100, W: 600, H: 450 })));
// Kosočtverec: jekl (všechny profily)
(Vy.KS_JEKL || []).forEach((j) => wipVars.push({ joint: 'spojovak', top: 'diag', ksMat: 'jekl', ksJ: j.id, mount: 'vrut' }));
// Pavouk: obě rozmístění noh
Vy.TOPS && Vy.TOPS.forEach((tp) => wipVars.push({ joint: 'spojovak', top: tp.id, pvLay: 'plus', mount: 'vrut' }));
(Vy.RJ || []).forEach((r) => wipVars.push({ joint: 'zamky', top: 'ramj', rjp: r.id, mount: r.w >= 25 ? 'vrut' : 'lepeni' }));
for (const m of K.allModels()) for (const join of ["weld", "bolt"]) for (const vv of m.wip ? wipVars : [null]) {
  const A = K.analyze(K.normalize(Object.assign({ model: m.id, L, W, H, join }, vv || {})), K.DEFAULT_RATES);
  if (join === "bolt" && !A.bolted) continue;
  const errs = [];
  A.rows.filter((r) => r.kind === "tube").forEach((r) => {
    const res = validate(G.stepFile(r.poz, [K.toLocal(r.part)]), r.poz);
    res.errs.forEach((e) => errs.push(r.poz + " " + r.name + ": " + e));
  });
  if (A.problems.length) A.problems.forEach((e) => errs.push(e));
  const bodies = A.build.parts.map((p) => p.solid).concat(A.build.plateBoxes);
  bodies.forEach((b, i) => { if (!G.checkClosed(b.verts, b.faces)) errs.push("těleso " + (i + 1) + " není uzavřené"); });
  validate(G.stepFile("sestava", bodies), "sestava").errs.forEach((e) => errs.push("sestava: " + e));
  console.log((errs.length ? "CHYBA " : "OK    ") + m.lab + (m.wip ? " [umělecké]" : "") + (join === "bolt" ? " (šroubovaná)" : "") + (vv ? " – " + vv.joint + " / " + vv.top + (vv.plS ? " " + vv.plS : "") + (vv.rjp ? " " + vv.rjp : "") + (vv.pvLay ? " " + vv.pvLay : "") + (vv.ksJ ? " jekl " + vv.ksJ : "") + (vv.vrH ? " nižší " + vv.vrH + " % délka " + vv.vrO : "") + " / " + vv.mount : ""));
  errs.slice(0, 4).forEach((e) => console.log("   - " + e));
  if (errs.length) bad++;
}
console.log("\n" + (bad ? bad + " konfigurací s chybou" : "vše v pořádku"));
process.exit(bad ? 1 : 0);
