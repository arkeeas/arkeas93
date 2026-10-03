/*
 * Kontrola zámků a drážek na všech tvarech, profilech a rozměrech:
 *  1. každý zámek má drážku v protikusu a celý jí projde (dá se zasunout); zámek je kus stěny jeklu,
 *     takže vede po ose dílu (jde vypálit) a lícuje s vnitřní plochou protikusu
 *  2. drážka leží celá v rovné části stěny – ne v rohu jeklu (rádius ~2,4 × tloušťka stěny)
 *  3. drážka je zhruba uprostřed šířky stěny
 *  4. drážka nevychází ven z plochy (nepřetéká přes hranu ani pokos) a nesahá do jiné drážky
 *  5. zámek nevyčnívá z protikusu
 *   node tests/kontrola-zamky.js [-v]
 */
"use strict";
const path = require("path");
require(path.join(__dirname, "..", "core.js"));
const K = globalThis.Podnoze;
const verbose = process.argv.includes("-v");
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a); return mul(a, 1 / l); };

function pip(q, L) { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[i], b = L[j]; if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function segDist(q, a, b) { const ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey; const t = l2 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * ex + (q[1] - a[1]) * ey) / l2)) : 0; return Math.hypot(q[0] - a[0] - ex * t, q[1] - a[1] - ey * t); }
function loopDist(q, L) { let m = Infinity; for (let i = 0; i < L.length; i++) m = Math.min(m, segDist(q, L[i], L[(i + 1) % L.length])); return m; }

function check(cfg) {
  const A = K.analyze(K.normalize(cfg), K.DEFAULT_RATES), B = A.build, s = A.cfg.size, t = A.cfg.t, h = s / 2;
  const errs = [], R = 2.4 * t;                // vnější rádius rohu jeklu (EN 10219 do 2,4 t)
  let nTabs = 0;
  const holeUse = new Map();                   // drážka -> kolik zámků jí prochází
  const ends = [];
  B.parts.forEach((p) => {
    const TF = p.solid.tabFoot || {}, TD = p.solid.tabDir || {};
    [1, 2].forEach((e) => {
      if (!TF[e]) return;
      ends.push({ p, e, n: TF[e].length });
      TF[e].forEach((q) => {               // q = [p_o, q_o, p_i, q_i]
        nTabs++;
        const d = unit(TD[e].d), len = TD[e].len, foot = [q[0], q[1], q[3], q[2]], top = foot.map((x) => add(x, mul(d, len)));
        const mid = mul(add(add(foot[0], foot[1]), add(foot[2], foot[3])), 0.25), probe = add(mid, mul(d, len * 0.5));
        // drážka: otvor v ploše jiného dílu, kterým prochází střed zámku
        let hit = null;
        B.parts.forEach((o) => {
          if (o === p) return;
          const S = o.solid;
          S.faces.forEach((f, fi) => {
            if (!f.inner || !f.inner.length) return;
            const n = unit(f.n), P0 = S.verts[f.outer[0]];
            if (Math.abs(dot(sub(probe, P0), n)) > t + 0.01) return;
            const ax = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = unit(cross(n, ax)), e2 = cross(n, e1);
            const to2 = (x) => [dot(x, e1), dot(x, e2)];
            f.inner.forEach((L, li) => {
              const H = L.map((i) => to2(S.verts[i]));
              if (!hit && pip(to2(probe), H)) hit = { o, f, fi, li, n, H, to2, outer: f.outer.map((i) => to2(S.verts[i])), others: f.inner.filter((_, k) => k !== li).map((L2) => L2.map((i) => to2(S.verts[i]))) };
            });
          });
        });
        const who = p.poz + " " + p.name + " (konec " + e + ")";
        if (!hit) { errs.push(who + ": zámek nemá drážku"); return; }
        const key = B.parts.indexOf(hit.o) + " " + hit.o.poz + "|" + hit.fi + "|" + hit.li; holeUse.set(key, (holeUse.get(key) || 0) + 1);
        const into = hit.o.poz + " " + hit.o.name;
        // 1. zámek projde drážkou: celý obrys zámku uvnitř drážky, směr kolmo na stěnu
        if (![...foot, ...top].every((x) => pip(hit.to2(x), hit.H))) errs.push(who + " → " + into + ": zámek se do drážky nevejde");
        // zámek je kus stěny jeklu: musí vést po ose dílu, jinak by se nedal vypálit (byl by ohnutý)
        if (p.m && Math.abs(Math.abs(dot(d, p.m.u)) - 1) > 1e-6) errs.push(who + ": zámek nevede po ose dílu – nejde vypálit ze stěny");
        // zámek projde celou stěnou protikusu a nekončí v ní (lícuje s vnitřní plochou)
        const depth = (x) => Math.abs(dot(sub(x, hit.o.solid.verts[hit.f.outer[0]]), hit.n));
        if (Math.abs(Math.max(...top.map(depth)) - t) > 0.05 && Math.abs(Math.min(...top.map(depth)) - t) > 0.05) errs.push(who + " → " + into + ": zámek nelícuje s vnitřní stěnou protikusu");
        // 2.+3. poloha napříč stěnou protikusu
        const m = hit.o.m;
        if (m) {
          const across = Math.abs(dot(hit.n, m.v)) > 0.9 ? m.w : m.v;
          const cs = hit.H.map((q2) => 0), pts3 = hit.f.inner[hit.li].map((i) => hit.o.solid.verts[i]);
          const c = pts3.map((x) => dot(sub(x, m.p1), across)), lo = Math.min(...c), hi = Math.max(...c), cen = (lo + hi) / 2;
          void cs;
          if (lo < -h + R - 1e-6 || hi > h - R + 1e-6) errs.push(who + " → " + into + ": drážka v rohu jeklu (" + lo.toFixed(1) + " až " + hi.toFixed(1) + " mm od osy, rovná část ±" + (h - R).toFixed(1) + ")");
          else if (Math.abs(cen) > Math.max(2, 0.1 * s)) errs.push(who + " → " + into + ": drážka mimo střed stěny (" + cen.toFixed(1) + " mm)");
          // 5. zámek nevyčnívá z protikusu
          const out = top.some((x) => { const r = sub(x, m.p1); return Math.abs(dot(r, m.v)) > h + 0.01 || Math.abs(dot(r, m.w)) > h + 0.01; });
          if (out) errs.push(who + " → " + into + ": zámek vyčnívá z protikusu");
        }
        // 4. drážka celá uvnitř plochy, s můstkem k okraji a k jiným drážkám
        const minOut = Math.min(...hit.H.map((x) => (pip(x, hit.outer) ? loopDist(x, hit.outer) : -1)));
        if (minOut < 0) errs.push(who + " → " + into + ": drážka přetéká přes okraj plochy");
        else if (minOut < t - 1e-6) errs.push(who + " → " + into + ": drážka jen " + minOut.toFixed(1) + " mm od okraje plochy");
        hit.others.forEach((O) => { const dd = Math.min(...hit.H.map((x) => loopDist(x, O)), ...O.map((x) => loopDist(x, hit.H))); if (dd < 2 * t) errs.push(who + " → " + into + ": drážka jen " + dd.toFixed(1) + " mm od jiné otvoru"); });
      });
    });
  });
  holeUse.forEach((n, k) => { if (n > 1) errs.push("drážka " + k + " sdílí " + n + " zámky"); });
  return { A, errs: [...new Set(errs)], nTabs, ends };
}

const SIZES = [[1600, 800, 750], [900, 600, 720], [2400, 1100, 1050], [1200, 700, 450]];
let bad = 0, total = 0;
for (const m of K.MODELS) {
  const rows = [];
  for (const [L, W, H] of SIZES) for (const size of K.SIZES) for (const t of K.THK[size]) for (const join of ["weld", "bolt"]) {
    let r;
    try { r = check({ model: m.id, L, W, H, size, t, join }); } catch (e) { rows.push({ tag: size + "×" + t + " " + L + "×" + W + "×" + H + " " + join, errs: ["výjimka: " + e.message] }); continue; }
    if (join === "bolt" && !r.A.bolted) continue;
    total++;
    const one = r.ends.filter((x) => x.n < 2).length;
    rows.push({ tag: size + "×" + t + " " + L + "×" + W + "×" + H + (join === "bolt" ? " šroub." : ""), errs: r.errs, nTabs: r.nTabs, one });
  }
  const badRows = rows.filter((x) => x.errs.length);
  bad += badRows.length;
  const tabs = rows.map((x) => x.nTabs || 0), one = Math.max(...rows.map((x) => x.one || 0));
  console.log((badRows.length ? "CHYBA " : "OK    ") + m.lab.padEnd(18) + " konfigurací " + String(rows.length).padStart(2) + "  zámků " + Math.min(...tabs) + "–" + Math.max(...tabs) + (one ? "  (konců jen s 1 zámkem: " + one + ")" : "") + (badRows.length ? "  chybných " + badRows.length : ""));
  badRows.slice(0, verbose ? 99 : 1).forEach((x) => { console.log("   " + x.tag); x.errs.slice(0, verbose ? 20 : 3).forEach((e) => console.log("     - " + e)); });
}
console.log("\n" + total + " konfigurací, " + (bad ? bad + " s chybou" : "všechny zámky v pořádku"));
process.exit(bad ? 1 : 0);
