/*
 * Vygeneruje vzorovou zakázku bez prohlížeče (Node.js 18+) a zkontroluje STEP soubory.
 *   node tests/generuj-vzorek.js [výstupní_složka] [délka] [šířka] [výška]
 */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
for (const f of ["data/katalog.js", "js/brep.js", "js/geometry.js", "js/vendor/pdf-font.js", "js/export.js"]) require(path.join(ROOT, f));
const { validate } = require("./validate-step.js");

const out = process.argv[2] || path.join(ROOT, "vystup");
const par = Object.assign({}, KATALOG.vychozi, { spodniPricky: true });
if (process.argv[3]) par.deskaDelka = +process.argv[3];
if (process.argv[4]) par.deskaSirka = +process.argv[4];
if (process.argv[5]) par.vyskaStolu = +process.argv[5];

const model = GEOMETRY.build(par);
if (model.errors.length) { console.error("Chyby:", model.errors); process.exit(1); }
const d = new Date();
const order = { cislo: EXPORT.orderNumber(d), datum: d.toISOString(), datumText: d.toLocaleString("cs-CZ"),
  zakaznik: { jmeno: "Testovací zákazník", email: "test@example.cz", telefon: "" }, pocet: 1,
  povrch: par.povrch, povrchNazev: KATALOG.povrchy.find((p) => p.id === par.povrch).nazev, poznamka: "" };
const pkg = EXPORT.buildPackage(model, order);
let bad = 0;
for (const f of pkg.files) {
  const p = path.join(out, f.path);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, f.data);
  if (p.endsWith(".step")) {
    const r = validate(typeof f.data === "string" ? f.data : Buffer.from(f.data).toString(), f.path);
    console.log((r.errs.length ? "CHYBA " : "OK    ") + f.path);
    r.errs.forEach((e) => console.log("   - " + e)); if (r.errs.length) bad++;
  } else console.log("      " + f.path);
}
fs.writeFileSync(path.join(out, pkg.zipName), EXPORT.zip(pkg.files, d));
console.log("\nHotovo → " + path.join(out, pkg.folder) + (bad ? "   (" + bad + " STEP s chybou)" : ""));
process.exit(bad ? 1 : 0);
