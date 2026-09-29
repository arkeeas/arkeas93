/*
 * Vygeneruje STEP všech tvarů podnoží (core.js + gen.js) a zkontroluje je bez CAD.
 *   node tests/kontrola-step.js [délka] [hloubka] [výška]
 */
"use strict";
const path = require("path");
const ROOT = path.join(__dirname, "..");
require(path.join(ROOT, "core.js")); require(path.join(ROOT, "gen.js"));
const { validate } = require("./validate-step.js");
const K = globalThis.Podnoze, G = globalThis.Generator;
const [L, W, H] = [process.argv[2] || 1600, process.argv[3] || 800, process.argv[4] || 750];
let bad = 0;
for (const m of K.MODELS) for (const join of ["weld", "bolt"]) {
  const A = K.analyze(K.normalize({ model: m.id, L, W, H, join }), K.DEFAULT_RATES);
  if (join === "bolt" && !A.bolted) continue;
  const errs = [];
  A.rows.filter((r) => r.kind === "tube").forEach((r) => {
    const res = validate(G.stepFile(r.poz, [K.toLocal(r.part)]), r.poz);
    res.errs.forEach((e) => errs.push(r.poz + " " + r.name + ": " + e));
  });
  const bodies = A.build.parts.map((p) => p.solid).concat(A.build.plateBoxes);
  validate(G.stepFile("sestava", bodies), "sestava").errs.forEach((e) => errs.push("sestava: " + e));
  console.log((errs.length ? "CHYBA " : "OK    ") + m.lab + (join === "bolt" ? " (šroubovaná)" : ""));
  errs.slice(0, 4).forEach((e) => console.log("   - " + e));
  if (errs.length) bad++;
}
console.log("\n" + (bad ? bad + " konfigurací s chybou" : "vše v pořádku"));
process.exit(bad ? 1 : 0);
