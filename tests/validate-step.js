/*
 * Kontrola STEP souborů generovaných konfigurátorem (bez CAD jádra).
 * Ověřuje: odkazy, uzavřenost a orientaci skořepiny (každá hrana 2× s opačným smyslem),
 * návaznost smyček, ležení vrcholů na křivkách a plochách, orientaci smyček vůči normále.
 *
 * Použití:  node tests/validate-step.js soubor.step [...]
 */
"use strict";
const fs = require("fs");

function parseArgs(s) {
  let i = 0;
  function val() {
    while (s[i] === " ") i++;
    if (s[i] === "(") { i++; const a = []; while (s[i] !== ")") { a.push(val()); if (s[i] === ",") i++; } i++; return a; }
    if (s[i] === "'") { let j = i + 1, out = ""; while (true) { if (s[j] === "'" && s[j + 1] === "'") { out += "'"; j += 2; } else if (s[j] === "'") break; else out += s[j++]; } i = j + 1; return { str: out }; }
    if (s[i] === "#") { let j = i + 1; while (/\d/.test(s[j])) j++; const r = { ref: +s.slice(i + 1, j) }; i = j; return r; }
    if (s[i] === ".") { let j = s.indexOf(".", i + 1); const r = { enum: s.slice(i + 1, j) }; i = j + 1; return r; }
    if (s[i] === "$" || s[i] === "*") { i++; return null; }
    if (/[A-Z]/.test(s[i])) { let j = i; while (/[A-Z0-9_]/.test(s[j])) j++; const name = s.slice(i, j); i = j; const a = val(); return { typed: name, args: a }; }
    let j = i; while (/[-+0-9.E]/.test(s[j])) j++; const n = parseFloat(s.slice(i, j)); if (j === i) throw new Error("parse @" + i + ": " + s.slice(i, i + 20)); i = j; return n;
  }
  return val();
}

function load(text) {
  const ents = {};
  const data = text.split("DATA;")[1].split("ENDSEC;")[0];
  const re = /#(\d+)=([^;]*);/g; let m;
  while ((m = re.exec(data))) {
    const body = m[2].trim();
    if (body.startsWith("(")) { ents[m[1]] = { type: "COMPLEX", raw: body }; continue; }
    const k = body.indexOf("(");
    ents[m[1]] = { type: body.slice(0, k), args: parseArgs(body.slice(k)) };
  }
  return ents;
}

function validate(text, label) {
  const E = load(text);
  const errs = [];
  const get = (r) => { const e = E[r.ref]; if (!e) throw new Error("chybí #" + r.ref); return e; };
  // odkazy
  for (const id in E) {
    const raw = E[id].raw || JSON.stringify(E[id].args);
    const refs = raw.match(/#(\d+)|"ref":(\d+)/g) || [];
    for (const r of refs) { const n = r.replace(/\D/g, ""); if (!E[n]) errs.push("#" + id + " odkazuje na neexistující #" + n); }
  }
  const pt = (r) => get(r).args[1];
  const dir = (r) => get(r).args[1];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(...a);
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const ax = (r) => { const a = get(r).args; const z = dir(a[2]); const x = dir(a[3]); return { o: pt(a[1]), z, x, y: cross(z, x) }; };
  const vpt = (r) => pt(get(r).args[1]);

  function curveInfo(r) {
    const c = get(r);
    if (c.type === "LINE") { const v = get(c.args[2]); return { type: "line", p: pt(c.args[1]), d: dir(v.args[1]) }; }
    if (c.type === "CIRCLE") { return { type: "circle", ax: ax(c.args[1]), r: c.args[2] }; }
    throw new Error("neznámá křivka " + c.type);
  }
  function onCurve(p, c) {
    if (c.type === "line") { const v = sub(p, c.p); return len(cross(v, c.d)) < 1e-4; }
    const v = sub(p, c.ax.o); return Math.abs(dot(v, c.ax.z)) < 1e-4 && Math.abs(len(v) - c.r) < 1e-4;
  }
  // body podél hrany (včetně středu oblouku) ve směru orientované hrany
  function edgeSamples(ecRef, sense) {
    const ec = get(ecRef); const a = ec.args;
    const p0 = vpt(a[1]), p1 = vpt(a[2]); const c = curveInfo(a[3]);
    let pts;
    if (c.type === "line") pts = [p0, p1];
    else {
      const ang = (p) => { const v = sub(p, c.ax.o); return Math.atan2(dot(v, c.ax.y), dot(v, c.ax.x)); };
      let t0 = ang(p0), t1 = ang(p1); let d = t1 - t0; while (d <= 1e-9) d += 2 * Math.PI;
      pts = []; const n = 16; for (let i = 0; i <= n; i++) { const t = t0 + (d * i) / n; pts.push(add(c.ax.o, add(mul(c.ax.x, c.r * Math.cos(t)), mul(c.ax.y, c.r * Math.sin(t))))); }
    }
    if (a[4].enum !== "T") errs.push("EDGE_CURVE same_sense .F. nečekané");
    if (!onCurve(p0, c) || !onCurve(p1, c)) errs.push("vrchol neleží na křivce hrany #" + ecRef.ref);
    return sense ? pts : pts.slice().reverse();
  }

  const shells = Object.keys(E).filter((k) => E[k].type === "CLOSED_SHELL");
  let faceCount = 0, volTotal = 0;
  for (const sid of shells) {
    const use = {};
    let vol = 0;
    for (const fr of E[sid].args[1]) {
      faceCount++;
      const f = get(fr); if (f.type !== "ADVANCED_FACE") { errs.push("není ADVANCED_FACE"); continue; }
      const surf = get(f.args[2]); const same = f.args[3].enum === "T";
      const sa = ax(surf.args[1]);
      const bounds = f.args[1];
      bounds.forEach((br) => {
        const b = get(br); const lp = get(b.args[1]);
        const all = [];
        let prevEnd = null, firstStart = null;
        for (const oer of lp.args[1]) {
          const oe = get(oer); const sense = oe.args[4].enum === "T";
          const ecr = oe.args[3]; const ec = get(ecr);
          const key = ecr.ref; use[key] = use[key] || []; use[key].push(sense);
          const vs = sense ? [ec.args[1].ref, ec.args[2].ref] : [ec.args[2].ref, ec.args[1].ref];
          if (prevEnd !== null && prevEnd !== vs[0]) errs.push("smyčka #" + b.args[1].ref + " nenavazuje");
          if (firstStart === null) firstStart = vs[0];
          prevEnd = vs[1];
          const s = edgeSamples(ecr, sense);
          all.push(...s.slice(0, -1));
          // vzorky musí ležet na ploše
          for (const p of s) {
            if (surf.type === "PLANE") { if (Math.abs(dot(sub(p, sa.o), sa.z)) > 1e-4) errs.push("bod hrany mimo rovinu, plocha #" + fr.ref); }
            else if (surf.type === "CYLINDRICAL_SURFACE") { const v = sub(p, sa.o); const rr = len(sub(v, mul(sa.z, dot(v, sa.z)))); if (Math.abs(rr - surf.args[2]) > 1e-4) errs.push("bod hrany mimo válec, plocha #" + fr.ref); }
          }
        }
        if (prevEnd !== firstStart) errs.push("smyčka #" + b.args[1].ref + " není uzavřená");
        // orientace smyčky válcové plochy: „vlevo“ od hrany (N × t) musí mířit do plochy
        if (surf.type === "CYLINDRICAL_SURFACE") {
          const cen = mul(all.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / all.length);
          const cnt = {}; lp.args[1].forEach((oer) => { const k = get(oer).args[3].ref; cnt[k] = (cnt[k] || 0) + 1; });
          for (const oer of lp.args[1]) {
            const oe = get(oer); if (cnt[oe.args[3].ref] > 1) continue; // šev
            const s = edgeSamples(oe.args[3], oe.args[4].enum === "T");
            const m = Math.floor(s.length / 2); const p = s.length > 2 ? s[m] : mul(add(s[0], s[1]), 0.5);
            const t = s.length > 2 ? sub(s[m + 1], s[m - 1]) : sub(s[1], s[0]);
            const v = sub(p, sa.o); const radial = sub(v, mul(sa.z, dot(v, sa.z))); const rn = mul(radial, 1 / len(radial));
            const N = same ? rn : mul(rn, -1);
            let d = sub(cen, p); d = sub(d, mul(rn, dot(d, rn)));
            if (dot(cross(N, t), d) <= 0) errs.push("smyčka válcové plochy #" + fr.ref + " má špatnou orientaci");
          }
        }
        // orientace smyčky rovinné plochy (Newell)
        if (surf.type === "PLANE") {
          let n = [0, 0, 0];
          for (let i = 0; i < all.length; i++) { const a = all[i], c = all[(i + 1) % all.length]; n = add(n, [(a[1] - c[1]) * (a[2] + c[2]), (a[2] - c[2]) * (a[0] + c[0]), (a[0] - c[0]) * (a[1] + c[1])]); }
          const fn = same ? sa.z : mul(sa.z, -1);
          const s = dot(n, fn);
          const isOuter = b.type === "FACE_OUTER_BOUND";
          if (isOuter && s <= 0) errs.push("vnější smyčka plochy #" + fr.ref + " má špatnou orientaci");
          if (!isOuter && s >= 0) errs.push("vnitřní smyčka plochy #" + fr.ref + " má špatnou orientaci");
          // objem: divergence (jen rovinné plochy: V = 1/3 Σ (p·n) A)
          vol += dot(sa.o, fn) * (dot(n, fn) / 2) / 3;
        }
      });
    }
    // normály rovinných ploch na obalovém kvádru musí mířit ven
    const allPts = [];
    for (const k in use) { const ec = get({ ref: +k }); allPts.push(vpt(ec.args[1]), vpt(ec.args[2])); }
    const lo = [0, 1, 2].map((i) => Math.min(...allPts.map((p) => p[i])));
    const hi = [0, 1, 2].map((i) => Math.max(...allPts.map((p) => p[i])));
    const mid = mul(add(lo, hi), 0.5);
    let bboxFaces = 0;
    for (const fr of E[sid].args[1]) {
      const f = get(fr); const surf = get(f.args[2]); if (surf.type !== "PLANE") continue;
      const sa = ax(surf.args[1]); const fn = f.args[3].enum === "T" ? sa.z : mul(sa.z, -1);
      for (let i = 0; i < 3; i++) {
        if (Math.abs(Math.abs(fn[i]) - 1) > 1e-9) continue;
        const onLo = Math.abs(sa.o[i] - lo[i]) < 1e-6, onHi = Math.abs(sa.o[i] - hi[i]) < 1e-6;
        if (onLo || onHi) { bboxFaces++; if (dot(fn, sub(sa.o, mid)) <= 0) errs.push("plocha #" + fr.ref + " má normálu dovnitř tělesa"); }
      }
    }
    if (!bboxFaces) errs.push("nenalezena žádná obalová plocha pro kontrolu orientace");
    for (const k in use) {
      const u = use[k];
      if (u.length !== 2 || u[0] === u[1]) errs.push("hrana #" + k + " použita " + u.length + "× (" + u.join(",") + ") – skořepina není uzavřená/orientovaná");
    }
    volTotal += vol;
  }
  return { label, errs: [...new Set(errs)], shells: shells.length, faces: faceCount, entities: Object.keys(E).length };
}

module.exports = { validate, load };

if (require.main === module) {
  let bad = 0;
  for (const f of process.argv.slice(2)) {
    const r = validate(fs.readFileSync(f, "utf8"), f);
    console.log((r.errs.length ? "CHYBA " : "OK    ") + f + "  těles: " + r.shells + ", ploch: " + r.faces + ", entit: " + r.entities);
    r.errs.slice(0, 15).forEach((e) => console.log("   - " + e));
    if (r.errs.length) bad++;
  }
  process.exit(bad ? 1 : 0);
}
