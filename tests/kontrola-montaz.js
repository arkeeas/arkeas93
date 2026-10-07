/*
 * Kontrola jádra stránky Testing (montaz-core.js) na všech tvarech bez prohlížeče:
 * díly, zámky, svary, návrh pořadí, směry nasazení (zámky + dosedací plochy), kontrola cesty
 * na místo (nenarazí do položených dílů) a přístup hořáku.
 *   node tests/kontrola-montaz.js [délka] [hloubka] [výška] [-v]
 */
"use strict";
const path = require("path");
const ROOT = path.join(__dirname, "..");
require(path.join(ROOT, "core.js")); require(path.join(ROOT, "vyvoj.js")); require(path.join(ROOT, "montaz-core.js"));
const K = globalThis.Podnoze, Mz = globalThis.Montaz;
const args = process.argv.slice(2), verbose = args.includes("-v"), num = args.filter((a) => a !== "-v");
const [L, W, H] = [num[0] || 1600, num[1] || 800, num[2] || 750];
let bad = 0;
// umělecké: každé spojení noh × horní část
const Vy = globalThis.Vyvoj || { JOINTS: [], TOPS: [] }, wipVars = [];
Vy.JOINTS.forEach((j) => Vy.TOPS.forEach((tp) => wipVars.push({ joint: j.id, top: tp.id })));
Vy.TOPS.forEach((tp) => wipVars.push({ joint: 'spojovak', top: tp.id, pvLay: 'plus' }));
wipVars.push({ joint: 'spojovak', top: 'diag', ksMat: 'jekl' });
for (const m of K.allModels()) for (const join of ["weld", "bolt"]) for (const vv of m.wip ? wipVars : [null]) {
  const t0 = Date.now();
  const A = K.analyze(K.normalize(Object.assign({ model: m.id, L, W, H, join }, vv || {})), K.DEFAULT_RATES);
  if (join === "bolt" && !A.bolted) continue;
  const M = Mz.prepare(A);
  const errs = [];
  const tubes = M.items.filter((it) => it.kind === "tube");
  // každý jekl (kromě šroubované spojky) musí mít aspoň jeden svar nebo zámek
  tubes.forEach((it) => { const i = M.items.indexOf(it); if (!it.bolted && !it.seams.length && !M.tabLinks.some((l) => l.from === i || l.to === i)) errs.push("bez svaru: " + it.label); });
  // každý díl se zámky má najít protikus
  tubes.forEach((it) => it.tabs.forEach((tb) => { if (tb.to < 0) errs.push("zámek bez drážky: " + it.label); }));
  const order = Mz.suggestOrder(M), placed = new Set(), stepOf = {};
  const conflicts = [], blocked = [], dirs = [];
  order.forEach((i, k) => {
    const r = Mz.insertCheck(M, i, placed);
    if (k && r.conflict) conflicts.push(M.items[i].label);
    if (k && r.blocked && r.blocked.length) blocked.push(M.items[i].label + " → " + r.blocked.map((j) => M.items[j].label).join(", "));
    dirs.push(r);
    placed.add(i); stepOf[i] = k + 1;
  });
  // každý zámek: díl se zámky se musí nasazovat přesně ve směru zámku
  order.forEach((i, k) => { const r = dirs[k]; if (r.tabs && !r.conflict && !M.tabLinks.some((l) => (l.from === i && Math.abs(r.dir[0] * l.d[0] + r.dir[1] * l.d[1] + r.dir[2] * l.d[2]) > 0.995) || (l.to === i && Math.abs(r.dir[0] * l.d[0] + r.dir[1] * l.d[1] + r.dir[2] * l.d[2]) > 0.995))) errs.push("směr nasazení nesedí se zámkem: " + M.items[i].label); });
  // přístup hořáku ke každému svaru v kroku, kdy vzniká
  const st = { ok: 0, tight: 0, no: 0 };
  const tr = Date.now();
  M.seams.forEach((sm) => {
    const k = Mz.seamStep(M, sm, stepOf);
    const obst = order.slice(0, k);
    const r = Mz.reach(M, sm.mid, sm.ideal, obst, Mz.TORCH.mig, null, { n: 40 });
    st[r.status]++;
    if (verbose && r.status !== "ok") {
      const d = Mz.diagnose(M, sm.mid, sm.ideal, [sm.a, sm.b], obst, Mz.TORCH.mig, null, r);
      const why = d.cause === "shape" ? "ostrý úhel" + (d.angle ? " " + Math.round(d.angle) + "°" : "") : d.cause === "parts" ? "překáží " + d.blockers.map((j) => M.items[j].label).join(", ") : "stůl";
      console.log("     " + r.status + "  krok " + k + "  " + M.items[sm.a].label + " × " + M.items[sm.b].label + " (" + sm.kind + ") – " + why);
    }
  });
  const ms = Date.now() - t0, msR = Date.now() - tr;
  if (conflicts.length) errs.push("konflikt nasazení v navrženém pořadí: " + conflicts.join(", "));
  if (blocked.length) errs.push("cestou narazí (navržené pořadí): " + blocked.join("; "));
  console.log((errs.length ? "CHYBA " : "OK    ") + (m.lab + (join === "bolt" ? " (šroubovaná)" : "") + (vv ? " " + (vv.ksMat ? "jekl" : vv.pvLay ? "plus" : vv.joint) + "/" + vv.top : "")).padEnd(32) +
    " dílů " + String(M.items.length).padStart(2) + "  zámků " + String(M.tabLinks.length).padStart(2) + "  svarů " + String(M.seams.length).padStart(3) +
    "  přístup ok/omez/ne " + st.ok + "/" + st.tight + "/" + st.no + "  (" + ms + " ms, hořák " + msR + " ms)");
  const dirW = (d) => { const a = d.map(Math.abs), m = Math.max(...a); return m === a[2] ? (d[2] < 0 ? "shora" : "zespodu") : m === a[0] ? (d[0] < 0 ? "zprava" : "zleva") : (d[1] < 0 ? "zezadu" : "zepředu"); };
  if (verbose) console.log("     pořadí: " + order.map((i, k) => M.items[i].label + (k ? " [" + dirW(dirs[k].dir) + "]" : "")).join(" → "));
  errs.slice(0, 5).forEach((e) => console.log("   - " + e));
  if (errs.length) bad++;
}
console.log("\n" + (bad ? bad + " konfigurací s chybou" : "vše v pořádku"));
process.exit(bad ? 1 : 0);
